"""TDD: P0-5 检索异常不再喂 LLM。

背景：workflow/nodes/rag/rag.py:82 检索失败时
  source_documents = [Document(page_content=str(e), metadata={})]
把异常文本塞进 Document 当检索结果喂 LLM（错答而非降级）。
knowledge_retriever.py:41 question_answer = str(e) 同样把异常字符串当节点输出。

正道：on_retrieval_failure 返回空 docs + error 标记，绝不把异常文本当结果喂 LLM。
空 context 的 prompt 润色（"未检索到相关文档"提示）延至 G3，A5 只保证不含异常文本。
"""
import importlib.util
import os


def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "retrieval_fallback.py")
    spec = importlib.util.spec_from_file_location("retrieval_fallback", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_retrieval_failure_returns_empty_docs():
    """检索失败返回空 docs，不塞 Document(page_content=str(e))"""
    mod = _load()
    docs, err = mod.on_retrieval_failure(RuntimeError("connect lost"), logger=None)
    assert docs == []
    assert err == "retrieval_failed"


def test_no_exception_text_leaks_into_docs():
    """异常文本绝不进 docs（防喂 LLM）"""
    mod = _load()
    docs, _ = mod.on_retrieval_failure(RuntimeError("secret connect lost"), logger=None)
    assert all("connect lost" not in (getattr(d, "page_content", "") or "") for d in docs)


def test_returns_error_marker_for_node_output():
    """返回 error 标记供节点输出/日志，不外泄异常文本"""
    mod = _load()
    _, err = mod.on_retrieval_failure(ValueError("boom"), logger=None)
    assert err == "retrieval_failed"
    assert "boom" not in err
