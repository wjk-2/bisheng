"""TDD: G4 parent-child / small-to-big 层级检索（轻量实现）。"""
import importlib.util
import os
from types import SimpleNamespace


def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "parent_context.py")
    spec = importlib.util.spec_from_file_location("parent_context", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _doc(content, doc_id, idx):
    return SimpleNamespace(page_content=content, metadata={"document_id": doc_id, "chunk_index": idx})


def test_empty_returns_empty():
    mod = _load()
    assert mod.expand_to_parent_context([]) == []


def test_no_callback_falls_back_to_hits():
    """无 fetch_adjacent（本机/未接向量库），原样返回（NULL 容错，存量兼容）"""
    mod = _load()
    hits = [_doc("a", 1, 0), _doc("b", 1, 1)]
    out = mod.expand_to_parent_context(hits, fetch_adjacent=None)
    assert len(out) == 2
    assert [d.page_content for d in out] == ["a", "b"]


def test_expand_fetches_adjacent_chunks():
    """命中 chunk_index=2，window=1，应取 chunk_index 1/2/3 的相邻 chunk"""
    mod = _load()
    hits = [_doc("hit", 1, 2)]

    def fetch(doc_id, idxs):
        # 返回相邻 chunk（除命中本身）
        return [_doc(f"adj{i}", doc_id, i) for i in idxs if i != 2]

    out = mod.expand_to_parent_context(hits, fetch_adjacent=fetch, window=1)
    contents = [d.page_content for d in out]
    assert "hit" in contents
    assert "adj1" in contents  # 前邻
    assert "adj3" in contents  # 后邻


def test_dedup_by_page_content():
    """相邻扩展去重（命中与相邻 page_content 不重复）"""
    mod = _load()
    hits = [_doc("same", 1, 0)]

    def fetch(doc_id, idxs):
        return [_doc("same", doc_id, 1)]  # 相同 page_content

    out = mod.expand_to_parent_context(hits, fetch_adjacent=fetch)
    assert len(out) == 1  # 去重


def test_chunk_index_none_skips_expand():
    """存量 chunk 无 chunk_index（NULL 容错），不扩展"""
    mod = _load()
    hit = SimpleNamespace(page_content="x", metadata={"document_id": 1, "chunk_index": None})

    def fetch(doc_id, idxs):
        raise AssertionError("不应调 fetch，chunk_index None 应跳过")

    out = mod.expand_to_parent_context([hit], fetch_adjacent=fetch)
    assert len(out) == 1


def test_fetch_failure_falls_back_to_hits():
    """fetch_adjacent 抛异常时降级为原命中（不阻断检索）"""
    mod = _load()
    hits = [_doc("hit", 1, 0)]

    def fetch(doc_id, idxs):
        raise RuntimeError("milvus down")

    out = mod.expand_to_parent_context(hits, fetch_adjacent=fetch)
    assert len(out) == 1
    assert out[0].page_content == "hit"
