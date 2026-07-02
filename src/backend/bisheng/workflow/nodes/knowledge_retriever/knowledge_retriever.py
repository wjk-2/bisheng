from typing import Any

from loguru import logger

from bisheng.workflow.common.knowledge import RagUtils
from bisheng.workflow.common.retrieval_fallback import on_retrieval_failure


class KnowledgeRetriever(RagUtils):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._output_keys = [one.get("key") for one in self.node_params.get('retrieved_result', [])]

    def _run(self, unique_id: str):
        try:
            self.user_questions = self.init_user_question()
            self.init_user_info()
            self.init_multi_retriever()
            ret = {}
            for index, question in enumerate(self.user_questions):
                output_key = self._output_keys[index]
                if question is None:
                    question = ""
                try:
                    self.init_rerank_model()
                    question_answer = self.retrieve_question(question)
                    question_answer = [{
                        "text": one.page_content,
                        "metadata": {
                            "chunk_index": one.metadata.get('chunk_index'),
                            "knowledge_id": one.metadata.get('knowledge_id'),
                            "document_id": one.metadata.get('document_id'),
                            "document_name": one.metadata.get('document_name'),
                            "upload_time": one.metadata.get('upload_time'),
                            "update_time": one.metadata.get('update_time'),
                            "uploader": one.metadata.get('uploader'),
                            "updater": one.metadata.get('updater'),
                            "user_metadata": one.metadata.get('user_metadata'),
                        }
                    } for one in question_answer]
                except Exception as e:
                    # 检索失败降级为空列表 + error 标记，绝不把 str(e) 当输出喂下游
                    question_answer, err = on_retrieval_failure(e, logger=logger)
                    ret.setdefault("_errors", []).append(err)
                ret[output_key] = question_answer
        except Exception as e:
            logger.exception(f"KnowledgeRetriever node run error: {e}")
            # 外层失败也降级为空列表，不把 str(e) 喂输出
            ret = {one: [] for one in self._output_keys}
            ret.setdefault("_errors", []).append("retrieval_failed")
        return ret

    def parse_log(self, unique_id: str, result: dict) -> Any:
        ret = []
        for index, question in enumerate(self.user_questions):
            output_key = self._output_keys[index]
            one_ret = [
                {'key': f'{self.id}.user_question', 'value': question, "type": "variable"},
                {'key': f'{self.id}.{output_key}', 'value': result[output_key], "type": "variable"},
            ]
            ret.append(one_ret)
        return ret
