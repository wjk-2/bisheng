"""检索异常降级纯函数。

失败时返回空 docs + error 标记，绝不把异常文本当结果喂 LLM
（修复 rag.py:82 / knowledge_retriever.py:41 把 str(e) 塞进 Document/输出的 bug）。

抽成纯函数使其可被 importlib 直加载单测（不连 DB、不拉 bisheng init）。
"""
import logging


def on_retrieval_failure(exc, logger=None):
    """检索/初始化失败时调用。

    Returns: (docs: list, error_msg: str)
      - docs 恒为空列表（不塞 Document(page_content=str(e))）
      - error_msg 仅供节点输出/日志使用，不进 LLM context，不含异常文本
    """
    log = logger or logging.getLogger(__name__)
    log.exception("retrieval failed, degrade to empty result")
    return [], "retrieval_failed"
