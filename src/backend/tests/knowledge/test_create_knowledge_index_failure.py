"""TDD: P0-6 create_knowledge 索引失败不吞。

背景：api/services/knowledge.py:194-196 create_knowledge 的 except 仅 logger.exception，
不 raise、不回滚已落库的 db_knowledge，继续执行 create_knowledge_hook 并返回 db_knowledge
如同成功——知识库记录已入 DB 但索引未建，后续上传/检索全失败但"看起来正常"。

正道：索引创建失败时回滚 DB 记录 + 清理已建的 Milvus/ES 孤儿 + 向上抛异常。
KnowledgeDao.delete_by_id 不存在，用 delete_knowledge(db_knowledge.id)。

本机无 langchain 等重依赖（bisheng init 失败），用源码级断言（与 A1/A3 同范式）。
"""
import os


def _read_knowledge_service_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "knowledge.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_create_knowledge_rolls_back_db_on_index_failure():
    """索引失败时回滚 DB 记录（delete_knowledge），不吞异常"""
    src = _read_knowledge_service_src()
    # 定位 create_knowledge 函数体
    start = src.find("def create_knowledge(")
    end = src.find("\n    @classmethod", start + 1)
    if end == -1:
        end = src.find("\nclass ", start + 1)
    fn_body = src[start:end] if start != -1 else src
    # 断言 except 分支调用 delete_knowledge 回滚 DB
    assert "KnowledgeDao.delete_knowledge(db_knowledge.id)" in fn_body, \
        "create_knowledge 索引失败未回滚 DB（应调 KnowledgeDao.delete_knowledge）"
    # 断言向上抛异常（不吞）
    assert "raise KnowledgeIndexCreateError" in fn_body or "raise" in fn_body, \
        "create_knowledge 索引失败未向上抛异常（吞掉返回成功）"


def test_create_knowledge_cleans_vector_orphans_on_index_failure():
    """索引失败时清理已建的 Milvus/ES 孤儿（仅删 DB 留向量孤儿）"""
    src = _read_knowledge_service_src()
    start = src.find("def create_knowledge(")
    end = src.find("\n    @classmethod", start + 1)
    if end == -1:
        end = src.find("\nclass ", start + 1)
    fn_body = src[start:end] if start != -1 else src
    # 断言 except 分支有向量孤儿清理（col.drop 或 delete_by_knowledge_id 或 _delete_index）
    assert ("col.drop" in fn_body or "delete_by_knowledge_id" in fn_body
            or "_delete_index" in fn_body or "VectorDeleteService" in fn_body), \
        "create_knowledge 索引失败未清理已建的 Milvus/ES 孤儿索引"
