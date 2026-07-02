"""TDD: E1 split_rule 改 JSON 列防回归。

背景：knowledge_file.py:51 split_rule 用 Text 存 JSON 字符串，与 metadata_fields/user_metadata
用 JSON 列不一致（失去 MySQL 8 JSON 校验）。使用处需 json.loads，写入处 json.dumps。
正道：改 JSON 列，写入侧直接赋 dict，使用处直接取 dict。
"""
import os


def _read(rel):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, rel), encoding="utf-8") as f:
        return f.read()


def test_model_split_rule_is_json_column():
    """knowledge_file.split_rule 用 JSON 列（非 Text）"""
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    # 找 split_rule 字段定义
    import re
    m = re.search(r'split_rule.*?Field\([^)]*sa_column\s*=\s*Column\(\s*(\w+)', src, re.DOTALL)
    assert m, "未找到 split_rule 字段定义"
    assert m.group(1) == "JSON", f"split_rule 列类型应为 JSON，实际 {m.group(1)}"


def test_write_side_no_json_dumps_for_split_rule():
    """写入侧不再对 split_rule 做 json.dumps（JSON 列自动序列化）"""
    src = _read("bisheng/api/services/knowledge.py")
    # 不应再有 split_rule = json.dumps(...) 赋值
    assert "split_rule = json.dumps" not in src, "写入侧仍用 json.dumps（JSON 列会双重编码）"
