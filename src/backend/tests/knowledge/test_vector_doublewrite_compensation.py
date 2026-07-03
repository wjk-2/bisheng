"""TDD: C2 Milvus→ES 双写补偿。

背景：knowledge_imp.py:670-674 add_file_embedding 内 Milvus add_texts 成功后
ES add_texts 裸调用无 try，ES 失败 Milvus 残留（脏状态）。

正道：ES 失败时回滚已写 Milvus（delete_vector_files）+ raise（不掩盖原异常）。
C3 统一删除服务未落地前，用现有 delete_vector_files（C3 后改 VectorDeleteService）。
"""
import os


def _read_knowledge_imp_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "knowledge_imp_legacy.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def _add_file_embedding_body(src):
    start = src.find("def add_file_embedding(")
    if start == -1:
        return ""
    end = src.find("\ndef ", start + 10)
    return src[start:end]


def test_es_write_failure_rolls_back_milvus():
    """ES add_texts 失败时回滚已写 Milvus"""
    src = _read_knowledge_imp_src()
    body = _add_file_embedding_body(src)
    # 双写处应有 try 包裹 ES add_texts
    assert "es_client.add_texts" in body
    # ES 失败回滚 Milvus（delete_vector_files 或 VectorDeleteService）
    assert ("delete_vector_files" in body or "VectorDeleteService" in body
            or "delete_by_file_ids" in body), \
        "ES 失败未回滚已写 Milvus（双写无补偿）"


def test_es_write_failure_reraises():
    """ES 失败应 raise（不吞原异常）"""
    src = _read_knowledge_imp_src()
    body = _add_file_embedding_body(src)
    # 定位 ES add_texts 后的 except 块
    es_pos = body.find("es_client.add_texts")
    after_es = body[es_pos:]
    # except 块内应有 raise（不静默吞）
    assert "raise" in after_es, "ES 失败未 raise（吞掉原异常）"


def test_es_rollback_uses_knowledge_id_not_undefined_knowledge():
    """ES 回滚块用 KnowledgeDao.query_by_id(knowledge_id) 取 knowledge，不引用未定义变量"""
    src = _read_knowledge_imp_src()
    body = _add_file_embedding_body(src)
    es_pos = body.find("es_client.add_texts")
    after_es = body[es_pos:]
    assert "KnowledgeDao.query_by_id(knowledge_id)" in after_es, \
        "ES 回滚未用 KnowledgeDao.query_by_id 取 knowledge（会 NameError）"
