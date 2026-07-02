"""rerank 调用阶段降级决策纯函数。

与初始化阶段降级（workflow/common/knowledge.py:init_rerank_model 失败置 None）语义对称：
调用阶段 rerank 服务运行时异常时，降级返回 RRF 结果（不中断检索），记 warning。

抽成纯函数使其可被 importlib 直加载单测（不连 DB、不拉 bisheng init）。
"""
import logging


def compress_with_degrade(rerank, docs, query, logger=None):
    """同步 rerank 调用，失败时降级返回原 docs。

    Returns: (docs, degraded: bool)
    """
    if rerank is None:
        return docs, False
    log = logger or logging.getLogger(__name__)
    try:
        return rerank.compress_documents(docs, query), False
    except Exception as e:
        log.warning(f"rerank compress_documents failed, degrade to RRF-only result: {e}")
        return docs, True


async def acompress_with_degrade(rerank, docs, query, logger=None):
    """异步 rerank 调用，失败时降级返回原 docs。

    Returns: (docs, degraded: bool)
    """
    if rerank is None:
        return docs, False
    log = logger or logging.getLogger(__name__)
    try:
        return await rerank.acompress_documents(docs, query), False
    except Exception as e:
        log.warning(f"rerank acompress_documents failed, degrade to RRF-only result: {e}")
        return docs, True
