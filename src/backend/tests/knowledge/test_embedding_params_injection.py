"""TDD: D2 embedding request_timeout/max_retries 注入防回归。

背景：embedding.py:93-94 定义 request_timeout=200/max_retries=6 但 _get_openai_params
从未注入 OpenAIEmbeddings，实际退回 langchain 默认（无超时、max_retries=2）。死代码。

正道：_get_openai_params 注入 request_timeout/max_retries（默认 200/6，与 EagentEmbedding 字段一致）。
"""
import os


def _read():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, "bisheng", "llm", "domain", "llm", "embedding.py"), encoding="utf-8") as f:
        return f.read()


def test_get_openai_params_injects_timeout_and_retries():
    """_get_openai_params 返回值含 request_timeout 与 max_retries"""
    src = _read()
    start = src.find("def _get_openai_params(")
    end = src.find("\ndef _get_azure_openai_params(", start)
    fn = src[start:end] if start != -1 else src
    assert "request_timeout" in fn, "_get_openai_params 未注入 request_timeout（死代码）"
    assert "max_retries" in fn, "_get_openai_params 未注入 max_retries（死代码）"
