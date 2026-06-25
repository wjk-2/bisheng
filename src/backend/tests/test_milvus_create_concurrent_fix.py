"""验证 _create_collection 并发兜底决策逻辑（本地无 pymilvus，用 mock）。

本地环境无 pymilvus/langchain_community 全套依赖，无法 import 真实 milvus 模块跑
集成测试。本脚本把 _create_collection 的待测决策逻辑提取为纯函数 _decide_create_or_load，
用 mock 验证决策分支对不对。这是逻辑层验证，真实集成验证在服务器端到端做。
"""


def _decide_create_or_load(has_collection_before, create_raises, has_collection_after):
    """模拟 _create_collection 的两层防御决策，返回 ('load'|'create'|'raise', reason)。

    对应待实现的逻辑：
    - 主路径：进方法 has_collection=True → load 已有，return
    - create 路径：has_collection=False → 尝试 create
        - create 成功 → done
        - create 抛 MilvusException → 兜底 has_collection 检查
            - 已存在（被别 worker 建了）→ load，return
            - 不存在（真异常）→ raise
    """
    if has_collection_before:
        return ('load', 'main-path: already exists')
    if create_raises:
        if has_collection_after:
            return ('load', 'fallback: race, load existing')
        return ('raise', 'real exception, re-raise')
    return ('create', 'normal create')


def test_main_path_load_when_exists():
    """主路径：collection 已存在 → load，不 create。"""
    action, _ = _decide_create_or_load(True, False, False)
    assert action == 'load'


def test_normal_create_when_not_exists():
    """正常路径：不存在 + create 不抛 → create。"""
    action, _ = _decide_create_or_load(False, False, False)
    assert action == 'create'


def test_fallback_load_on_race():
    """兜底路径：create 抛异常但已被别 worker 建好 → load。"""
    action, _ = _decide_create_or_load(False, True, True)
    assert action == 'load'


def test_re_raise_real_exception():
    """真异常：create 抛且确实没建成 → raise，不吞。"""
    action, _ = _decide_create_or_load(False, True, False)
    assert action == 'raise'
