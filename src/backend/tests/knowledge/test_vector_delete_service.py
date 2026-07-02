"""TDD: C3 统一向量删除服务防回归。

背景：3 套删除并行（delete_vector_files/delete_vector_data/delete_knowledge_file_in_vector）
用 3 个不同 Milvus 字段（document_id/file_id/knowledge_id），delete_vector_data 错配键。
正道：单一 VectorDeleteService，按 file_id 删统一用 document_id（写入键）。

本机无 langchain 等重依赖（bisheng init 失败），用源码级断言。
"""
import os


def _read_service_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "common", "vector_delete_service.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_service_has_delete_by_file_ids():
    """统一服务提供 delete_by_file_ids（按 file_id 删，统一 document_id 键）"""
    src = _read_service_src()
    assert "def delete_by_file_ids(" in src
    assert "document_id in {file_ids}" in src, "delete_by_file_ids 应统一用 document_id 键"


def test_service_has_delete_by_knowledge_id():
    """统一服务提供 delete_by_knowledge_id（整库 drop）"""
    src = _read_service_src()
    assert "def delete_by_knowledge_id(" in src
    assert "col.drop()" in src, "delete_by_knowledge_id 应 drop collection"


def test_service_not_use_file_id_key():
    """统一服务按 file_id 删时不用 file_id in {...}（错配键），用 document_id"""
    src = _read_service_src()
    # delete_by_file_ids 内不应有 file_id in {...} 的 Milvus expr（错配键）
    assert 'expr=f"file_id in' not in src, "统一服务不应使用 file_id in 错配键"


def test_service_imports_knowledge_rag_from_correct_path():
    """KnowledgeRag 必须从 knowledge.domain.knowledge_rag import（core.ai.rag 不存在）"""
    src = _read_service_src()
    assert "from bisheng.knowledge.domain.knowledge_rag import KnowledgeRag" in src, \
        "KnowledgeRag import 路径错（应为 bisheng.knowledge.domain.knowledge_rag，非 core.ai.rag）"
    assert "from bisheng.core.ai.rag import" not in src, \
        "core.ai.rag 路径不存在，会导致 ImportError"
