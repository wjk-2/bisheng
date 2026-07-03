"""G4: parent-child / small-to-big 层级检索（轻量实现）。

报告 P2 G4：parent-child/small-to-big 层级检索——命中碎片 chunk 后回溯父段返回。
彭总定案"仅新切片启用 + NULL 容错"。

本实现选轻量 small-to-big（不引入 parent_chunk_id schema 改动、不需回填、存量自动兼容）：
- 检索命中 chunk 后，按 document_id + 相邻 chunk_index 回溯扩展上下文
- 相邻 chunk（chunk_index ±1）拼成更大上下文返回 LLM
- fetch_adjacent 由调用方注入（部署后接 Milvus 按 document_id + chunk_index 范围查询）

真正 parent-child（两层切分 + 显式 parent_id）留下一期，与 abstract 升级统一设计（见 G2 决策）。
"""
import logging
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)


def expand_to_parent_context(
    hit_docs: list,
    fetch_adjacent: Optional[Callable[[object, List[int]], list]] = None,
    window: int = 1,
) -> list:
    """命中 chunk 后，按 document_id + 相邻 chunk_index 回溯扩展上下文。

    Args:
        hit_docs: 检索命中的 chunk 列表（每个含 metadata.document_id / chunk_index）
        fetch_adjacent: 回调 (document_id, chunk_indices) → 相邻 chunk 列表。
            部署后接 Milvus 查询；本机/无向量库时传 None，回退为原 hit_docs（不扩展）。
        window: 向前后各扩展的 chunk 数（默认 1，即 chunk_index ±1）

    Returns:
        扩展后的 chunk 列表（含命中 + 相邻），按 document_id + chunk_index 排序去重。
    """
    if not hit_docs:
        return []
    if fetch_adjacent is None:
        # 无回调（本机/未接向量库），不扩展，原样返回（NULL 容错，存量兼容）
        return list(hit_docs)

    # 按 document_id 分组，收集每文档命中的 chunk_index
    by_doc = {}
    for doc in hit_docs:
        meta = getattr(doc, "metadata", {}) or {}
        doc_id = meta.get("document_id")
        idx = meta.get("chunk_index")
        if doc_id is None or idx is None:
            # 存量 chunk 无 chunk_index，不扩展（NULL 容错）
            continue
        by_doc.setdefault(doc_id, []).append(idx)

    # 对每文档，收集相邻 chunk_index 范围
    wanted = {}  # doc_id -> set(chunk_index)
    for doc_id, idxs in by_doc.items():
        want = set()
        for idx in idxs:
            for w in range(-window, window + 1):
                want.add(idx + w)
        wanted[doc_id] = want

    # 回调取相邻 chunk，保留 rerank 相关性序：
    # 命中 chunk 保持原序（rerank 已按相关性排序），相邻 chunk 去重后追加在后（不重排，避免最相关 chunk 被 trim 裁掉）
    expanded = list(hit_docs)
    seen = set()
    for doc in hit_docs:
        key = (getattr(doc, "page_content", ""),)
        seen.add(key)
    for doc_id, idxs in wanted.items():
        try:
            adj = fetch_adjacent(doc_id, sorted(idxs))
            for doc in adj or []:
                key = (getattr(doc, "page_content", ""),)
                if key not in seen:
                    seen.add(key)
                    expanded.append(doc)
        except Exception as e:
            logger.warning(f"fetch_adjacent failed doc={doc_id}: {e}")
    return expanded
