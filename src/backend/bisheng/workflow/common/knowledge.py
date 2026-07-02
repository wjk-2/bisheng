from datetime import datetime
from typing import List, Dict, Any, Literal

from langchain_core.documents import Document
from loguru import logger
from pydantic import BaseModel, Field

from bisheng.common.constants.enums.telemetry import ApplicationTypeEnum
from bisheng.common.constants.vectorstore_metadata import KNOWLEDGE_RAG_METADATA_SCHEMA
from bisheng.core.vectorstore.multi_retriever import MultiRetriever
from bisheng.knowledge.domain.knowledge_rag import KnowledgeRag
from bisheng.knowledge.domain.models.knowledge import Knowledge, MetadataFieldType
from bisheng.knowledge.domain.models.knowledge_file import KnowledgeFileDao
from bisheng.llm.domain import LLMService
from bisheng.llm.domain.const import LLMModelType
from bisheng.llm.domain.models import LLMModel
from bisheng.tool.domain.langchain.knowledge import KnowledgeRetrieverTool
from bisheng.workflow.common.condition import ComparisonType
from bisheng.workflow.common.query_rewrite import rewrite_query_with_history
from bisheng.workflow.common.rerank_default import resolve_rerank_config
from bisheng.workflow.nodes.base import BaseNode


class ConditionOne(BaseModel):
    id: str = Field(..., description='Unique id for condition')
    knowledge_id: int = Field(..., description='metadata filed belong for knowledge`s id')
    metadata_field: str = Field(..., description='knowledge metadata field')
    comparison_operation: str = Field(..., description='Compare type')
    right_value_type: str = Field(..., description='Right value type')
    right_value: str = Field(..., description='Right value')

    def convert_right_value(self, field_type: str, right_value: Any, is_preset: bool) -> Any:
        # no need to convert right value for is_empty and is_not_empty
        if self.comparison_operation in ['is_empty', 'is_not_empty'] or is_preset:
            return right_value

        # only for user metadata field, need to convert right value type
        if field_type in [MetadataFieldType.STRING.value]:
            right_value = str(right_value)
            if not right_value:
                raise ValueError("Right value cannot be empty for the selected comparison operation")
        elif field_type in [MetadataFieldType.NUMBER.value]:
            right_value = int(right_value)
        elif field_type == MetadataFieldType.TIME.value:
            if isinstance(right_value, int):
                # timestamp
                right_value = datetime.fromtimestamp(right_value)
            else:
                # iso format
                right_value = datetime.fromisoformat(right_value)
            right_value = int(right_value.timestamp())
        else:
            raise ValueError(f"Unsupported metadata field type: {field_type}")
        return right_value

    def convert_preset_filed(self) -> (str, str):
        """ convert preset field to mysql field in knowledge file table"""
        if self.metadata_field == "document_id":
            return "id"
        elif self.metadata_field == "document_name":
            return "file_name"
        elif self.metadata_field == "upload_time":
            return "create_time"
        elif self.metadata_field == "update_time":
            return "update_time"
        elif self.metadata_field == "uploader":
            return "user_name"
        elif self.metadata_field == "updater":
            return "updater_name"
        else:
            raise ValueError(f"Unsupported preset metadata field: {self.metadata_field}")

    def get_knowledge_file_filter(self, field_info: Dict, parent_node: BaseNode, is_preset: bool) -> (str, List[Dict]):
        """ get knowledge file filter field info for mysql """
        right_value = self.right_value
        if self.right_value_type == 'ref' and self.right_value:
            right_value = parent_node.get_other_node_variable(self.right_value)
        field_type = field_info.get('field_type')
        right_value = self.convert_right_value(field_type, right_value, is_preset)
        if is_preset:
            field_key = self.convert_preset_filed()
        else:
            field_key = f"JSON_UNQUOTE(JSON_EXTRACT(`user_metadata`, '$.{self.metadata_field}.field_value'))"

        key_info = {}
        if self.comparison_operation == ComparisonType.EQUAL:
            key_info['comparison'] = '='
            key_info['value'] = right_value
        elif self.comparison_operation == ComparisonType.NOT_EQUAL:
            key_info['comparison'] = '!='
            key_info['value'] = right_value
        elif self.comparison_operation == ComparisonType.CONTAINS:
            key_info['comparison'] = 'like'
            key_info['value'] = f"%{right_value}%"
        elif self.comparison_operation == ComparisonType.NOT_CONTAINS:
            key_info['comparison'] = 'not like'
            key_info['value'] = f"%{right_value}%"
        elif self.comparison_operation == ComparisonType.STARTS_WITH:
            key_info['comparison'] = 'like'
            key_info['value'] = f"{right_value}%"
        elif self.comparison_operation == ComparisonType.ENDS_WITH:
            key_info['comparison'] = 'like'
            key_info['value'] = f"%{right_value}"
        elif self.comparison_operation == ComparisonType.IS_EMPTY:
            key_info['comparison'] = '='
            key_info['value'] = 'null'
        elif self.comparison_operation == ComparisonType.IS_NOT_EMPTY:
            key_info['comparison'] = '!='
            key_info['value'] = 'null'
        elif self.comparison_operation == ComparisonType.GREATER_THAN:
            key_info['comparison'] = '>'
            key_info['value'] = right_value
        elif self.comparison_operation == ComparisonType.GREATER_THAN_OR_EQUAL:
            key_info['comparison'] = '>='
            key_info['value'] = right_value
        elif self.comparison_operation == ComparisonType.LESS_THAN:
            key_info['comparison'] = '<'
            key_info['value'] = right_value
        elif self.comparison_operation == ComparisonType.LESS_THAN_OR_EQUAL:
            key_info['comparison'] = '<='
            key_info['value'] = right_value
        else:
            raise ValueError(f"Unsupported comparison operation: {self.comparison_operation}")
        if not is_preset and self.comparison_operation in [ComparisonType.GREATER_THAN,
                                                           ComparisonType.GREATER_THAN_OR_EQUAL,
                                                           ComparisonType.LESS_THAN,
                                                           ComparisonType.LESS_THAN_OR_EQUAL]:
            key_info['extra_filter'] = [{
                'comparison': '!=',
                'value': 'null'
            }]
        return {field_key: key_info}


class ConditionCases(BaseModel):
    id: str = Field(default=None, description='Unique id for condition case')
    conditions: List[ConditionOne] = Field(default_factory=list, description='List of conditions')
    operator: Literal['and', 'or'] = Field(default='and', description='Logical operator to combine conditions')
    enabled: bool = Field(default=False, description='Whether the condition case is enabled')

    def get_knowledge_filter(self, knowledge: Knowledge, parent_node: BaseNode) -> (str, Dict):
        """ if return is None, filter file is empty, don't need to retrieve from this knowledge """
        if not self.enabled or not self.conditions:
            return "", {}

        metadata_field_info = {}
        if knowledge.metadata_fields:
            metadata_field_info = {one["field_name"]: one for one in knowledge.metadata_fields}

        # Built-in metadata fields
        preset_field_info = {
            one.field_name: one.model_dump() for one in KNOWLEDGE_RAG_METADATA_SCHEMA if
            one.field_name != "user_metadata"
        }
        all_filter_field = []
        for condition in self.conditions:
            if int(condition.knowledge_id) != knowledge.id:
                continue
            if field_info := preset_field_info.get(condition.metadata_field):
                filter_field_info = condition.get_knowledge_file_filter(field_info, parent_node, True)
            elif field_info := metadata_field_info.get(condition.metadata_field):
                filter_field_info = condition.get_knowledge_file_filter(field_info, parent_node, False)
            else:
                logger.warning(f"condition field {condition.metadata_field} not in knowledge metadata fields")
                raise ValueError(f"field {condition.metadata_field} not in knowledge metadata fields")
            all_filter_field.append(filter_field_info)
        if not all_filter_field:
            return "", {}

        file_ids = KnowledgeFileDao.filter_file_by_metadata_fields(knowledge.id, self.operator, all_filter_field)
        if not file_ids:
            # no file match the filter condition
            logger.debug(f'knowledge {knowledge.id} no file match the filter condition')
            return None, None
        milvus_filter = f"document_id in {file_ids}"
        es_filter = {"filter": [{"terms": {"metadata.document_id": file_ids}}]}
        return milvus_filter, es_filter


class RagUtils(BaseNode):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._knowledge_type = self.node_params.get('knowledge', {}).get('type', "knowledge")
        self._knowledge_value = [
            one['key'] for one in self.node_params.get('knowledge', {}).get('value', [])
        ]

        self._advance_kwargs = self.node_params.get('advanced_retrieval_switch', {})
        self._metadata_filter = ConditionCases(**self.node_params.get('metadata_filter', {}))
        # A3 + G2-b: rerank 默认决策统一归后端。查一次 DB 默认 rerank 模型，
        # 两种入口（有/无 advanced_retrieval_switch 块）共用 resolve_rerank_config：
        # 老 flow（无块）按默认模型决定；新 flow（有块）尊重用户显式选择，
        # 仅在「开但没选模型」时补默认模型，手动关一律尊重。
        default_rerank = LLMModel.get_model_by_type(LLMModelType.RERANK)
        default_rerank_id = default_rerank.id if default_rerank else None
        if self._advance_kwargs:
            self._advance_kwargs = self.node_params.get('advanced_retrieval_switch', {})
            self._knowledge_auth = self._advance_kwargs['user_auth']
            self._max_chunk_size = int(self._advance_kwargs['max_chunk_size'])
            self._keyword_weight = float(self._advance_kwargs['keyword_weight'])
            self._vector_weight = float(self._advance_kwargs['vector_weight'])
            self._rerank_flag, self._rerank_model_id = resolve_rerank_config(
                self._advance_kwargs.get('rerank_flag'),
                self._advance_kwargs.get('rerank_model', ''),
                default_rerank_id,
            )
        else:
            self._knowledge_auth = self.node_params.get('user_auth', False)
            self._max_chunk_size = int(self.node_params.get('max_chunk_size', 15000))
            self._keyword_weight = 0.5
            self._vector_weight = 0.5
            self._rerank_flag, self._rerank_model_id = resolve_rerank_config(
                None, '', default_rerank_id,
            )

        self._multi_milvus_retriever = None
        self._multi_es_retriever = None
        self._knowledge_vector_list = []
        self._retriever_kwargs = {"k": 100, "param": {"ef": 110}}
        self._rerank_model = None
        self._knowledge_retriever_tool = None

    def _run(self, unique_id: str) -> Dict[str, Any]:
        raise NotImplementedError()

    @staticmethod
    def format_timestamp(timestamp: int) -> str:
        try:
            return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%dT%H:%M:%S')
        except Exception as e:
            logger.error(f"Error formatting timestamp {timestamp}: {e}")
            return str(timestamp)

    def retrieve_question(self, question: str) -> List[Document]:
        # 方向3: 检索前历史感知 query 改写（指代消解）。两节点（RagNode/KnowledgeRetriever）
        # 共用此入口，故改写在基类一处生效。无 LLM 或无历史的节点安全降级为原 question。
        question = self._maybe_rewrite_query(question)
        # 1: retrieve documents from multi retrievers
        knowledge_retriever_tool = KnowledgeRetrieverTool(
            vector_retriever=self._multi_milvus_retriever,
            elastic_retriever=self._multi_es_retriever,
            max_content=self._max_chunk_size,
            rrf_weights=[self._vector_weight, self._keyword_weight],
            rrf_remove_zero_score=True,
            rerank=self._rerank_model,
            sort_by_source_and_index=True
        )
        finally_docs = knowledge_retriever_tool.invoke(input={"query": question})
        all_file_id = set([one.metadata.get("document_id") for one in finally_docs])
        file_map = {}
        if finally_docs:
            if self._knowledge_type == 'knowledge':
                file_info = KnowledgeFileDao.get_file_by_ids(list(all_file_id))
                file_map = {one.id: one for one in file_info}
            for one in finally_docs:
                if "upload_time" in one.metadata:
                    one.metadata["upload_time"] = self.format_timestamp(one.metadata["upload_time"])
                if "update_time" in one.metadata:
                    one.metadata["update_time"] = self.format_timestamp(one.metadata["update_time"])
                file_id = one.metadata.get('document_id') or one.metadata.get('file_id')
                if file_id and file_map.get(file_id):
                    for user_key, user_value in one.metadata.get('user_metadata', {}).items():
                        field_info = file_map[file_id].user_metadata.get(user_key)
                        if field_info and field_info.get('field_type') == MetadataFieldType.TIME.value:
                            one.metadata["user_metadata"][user_key] = self.format_timestamp(user_value)
        return finally_docs

    def _maybe_rewrite_query(self, question: str) -> str:
        """检索前历史感知 query 改写。开关默认关（部署态坐实 output 慢后开），
        无 LLM / 无历史 / 开关关时安全降级为原 question。"""
        from bisheng.common.services.config_service import settings
        if not settings.workflow_conf.query_rewrite_enabled:
            return question
        llm = getattr(self, '_llm', None)
        if llm is None:
            return question
        history_memory = getattr(self.graph_state, 'history_memory', None)
        if history_memory is None:
            return question
        try:
            history_text = self.graph_state.get_history_memory(0)
        except Exception:
            return question
        return rewrite_query_with_history(
            question, history_text, llm, timeout=settings.workflow_conf.query_rewrite_timeout
        )

    def init_user_question(self) -> List[str]:
        # Convert all user questions to strings by default
        ret = []
        for one in self.node_params['user_question']:
            ret.append(f"{self.get_other_node_variable(one)}")
        return ret

    def init_rerank_model(self):
        if not self._rerank_flag or not self._rerank_model_id:
            return
        if self._rerank_model:
            return
        # 模型被删/model_id 无效时 get_bisheng_rerank_sync 抛异常，降级为无 rerank
        # 而非让整条检索静默失败（rerank 是增益项，缺则走纯向量+BM25 召回）。
        try:
            self._rerank_model = LLMService.get_bisheng_rerank_sync(model_id=self._rerank_model_id,
                                                                    app_id=self.workflow_id,
                                                                    app_name=self.workflow_name,
                                                                    app_type=ApplicationTypeEnum.WORKFLOW,
                                                                    user_id=self.user_id)
        except Exception as e:
            logger.warning(f"init_rerank_model failed (model_id={self._rerank_model_id}), "
                           f"degrade to no rerank: {e}")
            self._rerank_model = None

    def init_multi_retriever(self):
        if self._knowledge_type == "knowledge":
            self.init_knowledge_retriever()
        else:
            self.init_file_retriever()

    def init_knowledge_retriever(self):
        """ retriever from knowledge base """
        if not self._knowledge_vector_list:
            self._knowledge_vector_list = KnowledgeRag.get_multi_knowledge_vectorstore_sync(
                invoke_user_id=self.user_id,
                knowledge_ids=self._knowledge_value,
                user_name=self.user_info.user_name,
                check_auth=self._knowledge_auth,
                include_es=self._keyword_weight > 0,
                include_milvus=self._vector_weight > 0,
            )
        all_milvus = []
        all_milvus_filter = []
        all_es = []
        all_es_filter = []
        self._multi_milvus_retriever = None
        self._multi_es_retriever = None
        for knowledge_id, knowledge_info in self._knowledge_vector_list.items():
            knowledge = knowledge_info.get('knowledge')
            milvus_vector = knowledge_info.get('milvus')
            es_vector = knowledge_info.get('es')
            milvus_filter, es_filter = self._metadata_filter.get_knowledge_filter(knowledge=knowledge,
                                                                                  parent_node=self)
            if milvus_filter is None and es_filter is None:
                continue
            if milvus_vector:
                all_milvus.append(milvus_vector)
                milvus_filter = {"expr": milvus_filter} if milvus_filter else {}
                logger.debug(f'retrieve milvus filter: {milvus_filter}')
                all_milvus_filter.append(milvus_filter | self._retriever_kwargs)
            if es_vector:
                all_es.append(es_vector)
                logger.debug(f'retrieve es filter: {es_filter}')
                all_es_filter.append(es_filter | self._retriever_kwargs)

        if all_milvus:
            self._multi_milvus_retriever = MultiRetriever(
                vectors=all_milvus,
                search_kwargs=all_milvus_filter,
                finally_k=self._retriever_kwargs["k"]
            )
        if all_es:
            self._multi_es_retriever = MultiRetriever(
                vectors=all_es,
                search_kwargs=all_es_filter,
                finally_k=self._retriever_kwargs["k"]
            )

    def init_file_retriever(self):
        """ retriever from file user upload """
        file_ids = []
        for one in self._knowledge_value:
            file_metadata = self.get_other_node_variable(one)
            if not file_metadata:
                # No corresponding temporary file data found, User did not upload file
                continue
            file_ids.append(file_metadata[0]['document_id'])
        if not file_ids:
            self._multi_es_retriever = None
            self._multi_milvus_retriever = None
            return
        embeddings = LLMService.get_knowledge_default_embedding(self.user_id)
        if not embeddings:
            raise Exception('No knowledge base defaults configuredembeddingModels')

        # vectorstore use different collection_name for different embedding model
        tmp_collection_name = self.get_milvus_collection_name(getattr(embeddings, 'model_id'))
        es_index_name = self.get_es_index_name(getattr(embeddings, 'model_id'))
        # C4 创建即注册，结束统一 drop
        self.register_tmp_collection(getattr(embeddings, 'model_id'), tmp_collection_name, es_index_name)
        milvus_vector = KnowledgeRag.init_milvus_vectorstore(collection_name=tmp_collection_name, embeddings=embeddings)
        milvus_extra = {"expr": f"document_id in {file_ids}"}
        self._multi_milvus_retriever = milvus_vector.as_retriever(search_kwargs=self._retriever_kwargs | milvus_extra)

        es_extra = {"filter": [{"terms": {"metadata.document_id": file_ids}}]}
        es_vector = KnowledgeRag.init_es_vectorstore_sync(index_name=es_index_name)
        self._multi_es_retriever = es_vector.as_retriever(search_kwargs=self._retriever_kwargs | es_extra)
