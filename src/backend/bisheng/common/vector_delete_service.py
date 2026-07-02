"""统一的向量删除服务（C3 收口 3 套并行删除）。

背景：3 套删除并存，用 3 个不同 Milvus 字段：
- delete_vector_files: document_id in {...}（正确键，写入时 metadata.document_id = db_file.id）
- delete_knowledge_file_in_vector: knowledge_id=="{id}"（整库 drop）
- delete_vector_data: file_id in {...}（错配键，应废弃）

正道：单一服务，按 file_id 删统一用 document_id（写入键），整库 drop 单独方法。
旧 3 套函数改 thin wrapper 调本服务 + DeprecationWarning，逼调用方迁移。

本服务依赖 KnowledgeRag/decide_vectorstores（重），测试用源码级断言（不可 importlib）。
"""
import warnings
from typing import List

from bisheng.api.services.knowledge_imp import decide_vectorstores
from bisheng.common.constants.vectorstore_metadata import KNOWLEDGE_RAG_METADATA_SCHEMA
from bisheng.knowledge.domain.knowledge_rag import KnowledgeRag
from bisheng.database.models.knowledge import Knowledge
from pymilvus import Collection


class VectorDeleteService:
    """统一的向量删除服务（单一真理源）。"""

    @staticmethod
    def delete_by_file_ids(
        knowledge: Knowledge,
        file_ids: List[int],
        del_es: bool = True,
        del_milvus: bool = True,
    ) -> bool:
        """按 file_id 删向量。统一用 document_id（写入时 metadata.document_id = db_file.id）。

        替代旧 delete_vector_files（document_id，正确）与 delete_vector_data（file_id，错配）。
        """
        if not file_ids:
            return True
        if del_milvus:
            vector_client = KnowledgeRag.init_knowledge_milvus_vectorstore_sync(
                0, knowledge=knowledge, metadata_schemas=KNOWLEDGE_RAG_METADATA_SCHEMA
            )
            if vector_client.col:
                vector_client.col.delete(expr=f"document_id in {file_ids}", timeout=10)
        if del_es:
            es_client = KnowledgeRag.init_knowledge_es_vectorstore_sync(
                knowledge=knowledge, metadata_schemas=KNOWLEDGE_RAG_METADATA_SCHEMA
            )
            if es_client.client.indices.exists(index=knowledge.index_name):
                es_client.client.delete_by_query(
                    index=knowledge.index_name,
                    query={"terms": {"metadata.document_id": file_ids}},
                )
        return True

    @staticmethod
    def delete_by_knowledge_id(knowledge: Knowledge, del_es: bool = True) -> bool:
        """整库 drop Milvus collection + ES index（替代 delete_knowledge_file_in_vector）。"""
        embeddings = None
        from bisheng.api.services.knowledge_imp import FakeEmbedding
        embeddings = FakeEmbedding()
        vector_client = decide_vectorstores(knowledge.collection_name, "Milvus", embeddings)
        if isinstance(vector_client.col, Collection):
            vector_client.col.drop()
        if del_es:
            es_client = decide_vectorstores(knowledge.index_name, "ElasticKeywordsSearch", embeddings)
            if es_client.client.indices.exists(index=knowledge.index_name):
                es_client.client.indices.delete(index=knowledge.index_name, ignore=[400, 404])
        return True


def _deprecated(old_name: str, new_name: str):
    warnings.warn(
        f"{old_name} is deprecated, use {new_name} instead (C3 统一向量删除服务)",
        DeprecationWarning,
        stacklevel=3,
    )
