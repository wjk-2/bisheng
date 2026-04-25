import asyncio
from typing import Dict, List, Tuple

from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStore
from langchain_elasticsearch import AsyncElasticsearchStore, ElasticsearchStore
from langchain_milvus import Milvus

from bisheng.common.errcode.http_error import NotFoundError
from bisheng.knowledge.domain.models.knowledge import Knowledge, KnowledgeDao
from bisheng.knowledge.rag.elasticsearch_factory import ElasticsearchFactory
from bisheng.knowledge.rag.milvus_factory import MilvusFactory
from bisheng.llm.domain import LLMService


class KnowledgeRag:
    """ initialize knowledge rag components """

    @classmethod
    async def _get_knowledge(cls, knowledge: Knowledge = None, knowledge_id: int = None) -> Knowledge:
        if not knowledge:
            knowledge = await KnowledgeDao.aquery_by_id(knowledge_id)
            if not knowledge:
                raise NotFoundError.http_exception()
        return knowledge

    @classmethod
    def _get_knowledge_sync(cls, knowledge: Knowledge = None, knowledge_id: int = None):
        if not knowledge:
            knowledge = KnowledgeDao.query_by_id(knowledge_id)
            if not knowledge:
                raise NotFoundError.http_exception()
        return knowledge

    @classmethod
    async def init_knowledge_milvus_vectorstore(cls, invoke_user_id: int, knowledge: Knowledge = None,
                                                knowledge_id: int = None, **kwargs) -> Milvus:
        knowledge = await cls._get_knowledge(knowledge, knowledge_id)
        embedding = await LLMService.get_bisheng_knowledge_embedding(model_id=int(knowledge.model),
                                                                     invoke_user_id=invoke_user_id)
        return cls.init_milvus_vectorstore(knowledge.collection_name, embedding, **kwargs)

    @classmethod
    def init_knowledge_milvus_vectorstore_sync(cls, invoke_user_id: int, knowledge: Knowledge = None,
                                               knowledge_id: int = None, **kwargs) -> Milvus:
        knowledge = cls._get_knowledge_sync(knowledge, knowledge_id)
        embedding = LLMService.get_eagent_knowledge_embedding_sync(model_id=int(knowledge.model),
                                                                    invoke_user_id=invoke_user_id)
        return cls.init_milvus_vectorstore(knowledge.collection_name, embedding, **kwargs)

    @classmethod
    async def init_knowledge_es_vectorstore(cls, knowledge: Knowledge = None, knowledge_id: int = None,
                                            **kwargs) -> AsyncElasticsearchStore:
        knowledge = await cls._get_knowledge(knowledge, knowledge_id)
        return cls.init_es_vectorstore(knowledge.index_name, **kwargs)

    @classmethod
    def init_knowledge_es_vectorstore_sync(cls, knowledge: Knowledge = None, knowledge_id: int = None,
                                           **kwargs) -> ElasticsearchStore:
        knowledge = cls._get_knowledge_sync(knowledge, knowledge_id)
        return cls.init_es_vectorstore_sync(knowledge.index_name, **kwargs)

    @classmethod
    def get_multi_knowledge_vectorstore_sync(cls, invoke_user_id: int, knowledge_ids: list[int], user_name: str = None,
                                             check_auth: bool = True, include_es: bool = True,
                                             include_milvus: bool = True) \
            -> Dict[int, Dict[str, VectorStore | Knowledge]]:
        """ get multiple knowledge vectorstore, including milvus and es
            return: {
                knowledge_id: {
                    "knowledge": Knowledge
                    "milvus": Milvus,
                    "es": ElasticsearchStore,
                },
            }
        """
        if not include_es and not include_milvus:
            raise RuntimeError('at least one of include_es and include_milvus must be True')

        if check_auth:
            if not user_name:
                raise RuntimeError('knowledge check auth user_name must be provided')
            knowledge_list = KnowledgeDao.judge_knowledge_permission(user_name, knowledge_ids)
        else:
            knowledge_list = KnowledgeDao.get_list_by_ids(knowledge_ids)
        ret = {}
        for knowledge in knowledge_list:
            ret[knowledge.id] = {
                "knowledge": knowledge,
                "milvus": None,
                "es": None,
            }
            if include_milvus:
                vectorstore = cls.init_knowledge_milvus_vectorstore_sync(invoke_user_id, knowledge)
                ret[knowledge.id]["milvus"] = vectorstore
            if include_es:
                es_vectorstore = cls.init_knowledge_es_vectorstore_sync(knowledge)
                ret[knowledge.id]["es"] = es_vectorstore
        return ret

    @classmethod
    async def get_multi_knowledge_vectorstore(cls, invoke_user_id: int, knowledge_ids: list[int], user_name: str = None,
                                              check_auth: bool = True, include_es: bool = True,
                                              include_milvus: bool = True) \
            -> Dict[int, Dict[str, VectorStore | Knowledge]]:
        """ get multiple knowledge vectorstore, including milvus and es
            return: {
                knowledge_id: {
                    "knowledge": Knowledge
                    "milvus": Milvus,
                    "es": ElasticsearchStore,
                },
            }

            Optimized: Use asyncio.gather for parallel initialization of multiple knowledge bases.
            This reduces initialization time from N*300ms to ~300ms for N knowledge bases.
        """

        if knowledge_ids is None or len(knowledge_ids) == 0:
            return {}

        if not include_es and not include_milvus:
            raise RuntimeError('at least one of include_es and include_milvus must be True')
        if check_auth:
            if not user_name:
                raise RuntimeError('knowledge check auth user_name must be provided')
            knowledge_list = await KnowledgeDao.ajudge_knowledge_permission(user_name, knowledge_ids)
        else:
            knowledge_list = await KnowledgeDao.aget_list_by_ids(knowledge_ids)

        # Initialize result dict with knowledge info
        ret = {knowledge.id: {"knowledge": knowledge, "milvus": None, "es": None} for knowledge in knowledge_list}

        # Collect all initialization tasks for parallel execution
        tasks: List[Tuple[int, str, asyncio.Task]] = []
        for knowledge in knowledge_list:
            if include_milvus:
                tasks.append((knowledge.id, "milvus",
                              asyncio.create_task(cls.init_knowledge_milvus_vectorstore(invoke_user_id, knowledge))))
            if include_es:
                tasks.append((knowledge.id, "es",
                              asyncio.create_task(cls.init_knowledge_es_vectorstore(knowledge))))

        # Wait for all tasks to complete in parallel
        if tasks:
            results = await asyncio.gather(*[t[2] for t in tasks], return_exceptions=True)
            # Map results back to the return dict
            for i, (kid, store_type, _) in enumerate(tasks):
                if isinstance(results[i], Exception):
                    # Log error but don't fail - let individual retrievers handle missing stores
                    from loguru import logger
                    logger.error(f"Failed to initialize {store_type} for knowledge {kid}: {results[i]}")
                else:
                    ret[kid][store_type] = results[i]

        return ret

    @classmethod
    def init_milvus_vectorstore(cls, collection_name: str, embeddings: Embeddings, **kwargs) -> Milvus:
        """ init milvus vectorstore by collection name and model id """
        return MilvusFactory.init_vectorstore(collection_name, embeddings, **kwargs)

    @classmethod
    def init_es_vectorstore(cls, index_name: str, **kwargs) -> AsyncElasticsearchStore:
        """ init es vectorstore by index name """
        return ElasticsearchFactory.init_vectorstore(index_name, **kwargs)

    @classmethod
    def init_es_vectorstore_sync(cls, index_name: str, **kwargs) -> ElasticsearchStore:
        """ init es vectorstore by index name """
        return ElasticsearchFactory.init_vectorstore_sync(index_name, **kwargs)
