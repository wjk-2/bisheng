"""TDD: G1 query_rewrite 默认启用 + HyDE。

G1：
- query_rewrite_enabled 默认改 True（多轮指代消解提升召回）
- 新增 hyde_question 函数（HyDE：LLM 生成假设答案供向量检索）+ hyde_enabled 开关
- HyDE 超时/失败降级原 query（与 rewrite_query_with_history 同范式）

importlib 直加载纯函数测试（HyDE 决策逻辑：失败降级）。
"""
import importlib.util
import os


def _load_query_rewrite():
    path = os.path.join(
        os.path.dirname(__file__), "..", "..", "bisheng", "workflow", "common", "query_rewrite.py"
    )
    spec = importlib.util.spec_from_file_location("query_rewrite_g1", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _read_settings():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, "bisheng", "core", "config", "settings.py"), encoding="utf-8") as f:
        return f.read()


def test_hyde_question_function_exists():
    """query_rewrite.py 提供 hyde_question 函数"""
    mod = _load_query_rewrite()
    assert hasattr(mod, "hyde_question"), "query_rewrite.py 缺 hyde_question 函数"


def test_hyde_failure_falls_back_to_original():
    """HyDE LLM 调用失败时降级为原 question，不抛异常"""
    mod = _load_query_rewrite()

    class BoomLLM:
        def invoke(self, prompt):
            raise RuntimeError("llm down")

    out = mod.hyde_question("学术问题", BoomLLM(), timeout=2)
    assert out == "学术问题", "HyDE 失败未降级为原 question"


def test_hyde_success_returns_hypothetical_answer():
    """HyDE 成功时返回假设答案（非原 query）"""
    mod = _load_query_rewrite()

    class FakeLLM:
        def invoke(self, prompt):
            class R:
                content = "假设答案正文"
            return R()

    out = mod.hyde_question("问题", FakeLLM(), timeout=2)
    assert out == "假设答案正文"


def test_query_rewrite_enabled_default_true():
    """G1: query_rewrite_enabled 默认改 True"""
    src = _read_settings()
    # 定位 query_rewrite_enabled 字段，断言 default=True
    assert "query_rewrite_enabled: bool = Field(default=True" in src, \
        "query_rewrite_enabled 默认未改为 True"


def test_hyde_enabled_setting_exists():
    """G1: settings 新增 hyde_enabled 开关"""
    src = _read_settings()
    assert "hyde_enabled" in src, "settings 缺 hyde_enabled 字段"
