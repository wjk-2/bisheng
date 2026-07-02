"""TDD: G3 上下文裁剪按 token + 元数据透传。"""
import importlib.util
import os
from types import SimpleNamespace


def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "context_trimming.py")
    spec = importlib.util.spec_from_file_location("context_trimming", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _doc(content, **meta):
    return SimpleNamespace(page_content=content, metadata=meta)


def test_estimate_tokens_positive():
    mod = _load()
    assert mod.estimate_tokens("") == 0
    assert mod.estimate_tokens("hello world") > 0


def test_trim_by_token_respects_limit():
    mod = _load()
    docs = [_doc("a" * 1000), _doc("b" * 1000), _doc("c" * 1000)]
    # 每条约 500 token（chars/2），max 600 应只保留 1 条
    trimmed = mod.trim_by_token(docs, 600)
    assert len(trimmed) == 1
    assert trimmed[0].page_content == "a" * 1000


def test_trim_empty_returns_empty():
    mod = _load()
    assert mod.trim_by_token([], 1000) == []


def test_render_context_with_metadata():
    mod = _load()
    docs = [
        _doc("正文A", document_name="doc1.pdf", page=3, chunk_index=0),
        _doc("正文B", document_name="doc1.pdf", page=3, chunk_index=1),
    ]
    out = mod.render_context_with_metadata(docs)
    assert "来源: doc1.pdf" in out
    assert "第3页" in out
    assert "chunk0" in out
    assert "正文A" in out
    assert "正文B" in out


def test_render_empty_returns_empty():
    mod = _load()
    assert mod.render_context_with_metadata([]) == ""


def test_render_no_metadata_degrades_to_plain():
    mod = _load()
    docs = [_doc("纯正文", )]
    out = mod.render_context_with_metadata(docs)
    assert out == "纯正文"
