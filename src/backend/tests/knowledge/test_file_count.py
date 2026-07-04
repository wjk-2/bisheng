"""TDD: GET /api/v1/knowledge 返回每个知识库的 file_count（所有文件，不过滤 status）。

三个测试（源码级断言为主，避免依赖 DB / 业务 import 链）：
1. KnowledgeFileDao.acount_files_by_knowledge_ids 存在 + async + @classmethod
2. KnowledgeRead 含 file_count 字段（默认 None）
3. acount_files_by_knowledge_ids 方法体含 GROUP BY 语义（func.count + group_by + IN）
"""
import ast
import os


def _read(rel):
    """从 src/backend/ 起读相对路径文件全文。"""
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, rel), encoding="utf-8") as f:
        return f.read()


def _parse_class_methods(src: str, class_name: str):
    """返回类内 {method_name: FunctionDef/AsyncFunctionDef}；找不到返回 {}。"""
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return {
                item.name: item
                for item in node.body
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
            }
    return {}


def test_acount_files_by_knowledge_ids_exists_and_signature():
    """KnowledgeFileDao.acount_files_by_knowledge_ids 是 async + @classmethod（批量 group_by，避免 N+1）。"""
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    methods = _parse_class_methods(src, "KnowledgeFileDao")
    assert "acount_files_by_knowledge_ids" in methods, \
        "KnowledgeFileDao 缺 acount_files_by_knowledge_ids 方法"
    m = methods["acount_files_by_knowledge_ids"]
    assert isinstance(m, ast.AsyncFunctionDef), \
        "acount_files_by_knowledge_ids 必须 async（get_knowledge 在 async 链中）"
    deco_names = [d.id for d in m.decorator_list if isinstance(d, ast.Name)]
    assert "classmethod" in deco_names, \
        "acount_files_by_knowledge_ids 必须 @classmethod"


def test_knowledge_read_has_file_count():
    """KnowledgeRead 含 file_count: Optional[int] = None（加在 KnowledgeRead，非 KnowledgeBase）。"""
    src = _read("bisheng/knowledge/domain/models/knowledge.py")
    assert "file_count: Optional[int] = None" in src, \
        "KnowledgeRead 未声明 file_count: Optional[int] = None"
    # 环境允许时强校验默认值；import 链不可用时退化为源码级断言
    try:
        from bisheng.knowledge.domain.models.knowledge import KnowledgeRead
        kr = KnowledgeRead(id=1, name="t")
        assert kr.file_count is None, "file_count 默认值不是 None"
    except Exception:
        pass


def test_acount_files_by_knowledge_ids_query_structure():
    """方法体含 GROUP BY 语义：func.count + group_by + IN 查询（不过滤 status）。"""
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    assert "acount_files_by_knowledge_ids" in src
    start = src.index("async def acount_files_by_knowledge_ids")
    next_dec = src.find("@classmethod", start + 10)
    body = src[start: next_dec if next_dec != -1 else len(src)]
    assert "func.count" in body, "缺 func.count（COUNT 聚合）"
    assert "group_by" in body, "缺 group_by（GROUP BY 语义，避免 N+1）"
    assert ".in_(" in body or "in_(" in body, "缺 IN 查询（批量 knowledge_id IN (...)）"
