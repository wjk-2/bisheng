"""query 改写——历史感知 standalone query 生成。

方向3：在 retrieve_question 前把原 query + 对话历史压成 standalone query，
消解指代（它/这个/接着）后再送检索，提升多轮对话召回相关性。
- should_rewrite_query：纯决策，有历史才改写、空历史省一次调用。
- rewrite_query_with_history：调 LLM 生成 standalone query，失败降级原 query 不阻断。

langchain import 延迟到函数内，使 should_rewrite_query 可被 importlib 直加载单测
（本机无 langchain_core 也能测纯决策，与 rerank_default 同范式）。
"""
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Optional, TYPE_CHECKING

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from langchain_core.language_models import BaseChatModel

_REWRITE_PROMPT = (
    "给定以下对话历史和用户最新问题，把最新问题改写成一个不依赖历史也能独立理解的完整问题。"
    "只输出改写后的问题，不要解释。\n\n对话历史:\n{history}\n\n最新问题: {question}\n\n独立问题:"
)

# 复用线程池，避免每次改写都新建线程；query 改写是 IO 阻塞型，少量线程即可。
_rewrite_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="query-rewrite")


def should_rewrite_query(history_text: Optional[str]) -> bool:
    """有非空白对话历史才触发改写，首轮省一次 LLM 调用。"""
    return bool(history_text and history_text.strip())


# HyDE（review 后降级不做）：原计划 LLM 生成假设答案做向量检索，但财经容器 35B 增延迟
# 且 ES 关键词路不能用假设答案（丢词），接线需谨慎权衡。诚实删函数，待明确需求再实现。

def rewrite_query_with_history(
    question: str,
    history_text: str,
    llm: "BaseChatModel",
    timeout: int = 5,
) -> str:
    """用小 LLM 把 question + history 压成 standalone query。

    超时（默认 5s）或失败时降级为原 question，不阻断检索（query 改写是增益项，非必需）。
    用 ThreadPoolExecutor 包同步 invoke 实现超时，不依赖 langchain 版本的 timeout 配置。
    """
    if not should_rewrite_query(history_text):
        return question
    try:
        prompt = _REWRITE_PROMPT.format(history=history_text, question=question)
        future = _rewrite_executor.submit(llm.invoke, prompt)
        rewritten = future.result(timeout=timeout)
        content = rewritten.content if hasattr(rewritten, "content") else str(rewritten)
        content = content.strip() if content else ""
        return content or question
    except FuturesTimeoutError:
        logger.warning(f"query rewrite timeout ({timeout}s), fallback to original")
        return question
    except Exception as e:
        logger.warning(f"query rewrite failed, fallback to original: {e}")
        return question
