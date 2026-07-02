"""G3: 上下文裁剪按 token + 元数据透传。

原 knowledge.py:112 用 len(doc.page_content) 字符数裁剪，中文下 15000 字符逼近 30k token
有超窗口风险。正道：按 token 裁剪（优先 tiktoken，回退 chars/4 粗估保守值）。

元数据透传：把每个 chunk 的 document_name/page/chunk_index 注入 context 文本前缀，
让 LLM 能引用"见第X页/第X节"。空 context 时返回空列表（A5 友好提示由 prompt 兜底）。

抽纯函数便于 importlib 直加载单测（不连 LLM、不连向量库）。
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

try:
    import tiktoken as _tiktoken
    _ENC = _tiktoken.get_encoding("cl100k_base")  # 兼容大多数模型
except Exception:
    _tiktoken = None
    _ENC = None


def estimate_tokens(text: str) -> int:
    """估算 text 的 token 数。优先 tiktoken，回退 chars/4 粗估（中文保守偏低估）。"""
    if not text:
        return 0
    if _ENC is not None:
        try:
            return len(_ENC.encode(text))
        except Exception:
            pass
    # 回退：中文 1 字符≈1-2 token，chars/4 偏低估（安全，少裁不超窗口的相反是可能超窗口）
    # 用 chars/2 更安全（偏高估，裁更多，防超窗口）
    return max(1, len(text) // 2)


def trim_by_token(docs, max_tokens: int):
    """按 token 累加裁剪 docs，返回裁剪后的子列表（不超 max_tokens）。"""
    if not docs:
        return []
    total = 0
    kept = []
    for doc in docs:
        content = getattr(doc, "page_content", "") or ""
        t = estimate_tokens(content)
        if total + t > max_tokens and kept:
            break
        total += t
        kept.append(doc)
    return kept


def render_context_with_metadata(docs) -> str:
    """把 docs 渲染成带元数据前缀的 context 文本（来源/页码/chunk_index 透传给 LLM）。

    每个 chunk 前缀格式：[来源: {document_name} 第{page}页 chunk{chunk_index}]
    无元数据时退化为纯 page_content 拼接。
    """
    if not docs:
        return ""
    parts = []
    for doc in docs:
        content = getattr(doc, "page_content", "") or ""
        meta = getattr(doc, "metadata", {}) or {}
        doc_name = meta.get("document_name") or meta.get("source") or ""
        page = meta.get("page")
        chunk_idx = meta.get("chunk_index")
        prefix_parts = []
        if doc_name:
            prefix_parts.append(f"来源: {doc_name}")
        if page is not None:
            prefix_parts.append(f"第{page}页")
        if chunk_idx is not None:
            prefix_parts.append(f"chunk{chunk_idx}")
        prefix = f"[{' '.join(prefix_parts)}]\n" if prefix_parts else ""
        parts.append(prefix + content)
    return "\n\n".join(parts)
