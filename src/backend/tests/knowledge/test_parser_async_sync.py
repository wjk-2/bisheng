"""TDD: F2 同步异步重复消除——错误类型统一（务实子集）。

背景：read_chunk_text / async_read_chunk_text 410 行逐行复制，async 版错误类型
悄悄降级为裸 Exception（KnowledgeLLMError→Exception、KnowledgeFileDamagedError→Exception、
KnowledgeFileNotSupportedError→Exception），语义弱于 sync 版。

正道（完整）：抽 _read_chunk_text_core(io_runner) 公共 core，sync/async 薄包装。
务实子集（本任务）：至少统一 async 版错误类型与 sync 版一致，消除语义弱化。
完整 core 抽取留后续（200 行 I/O 调度器抽象风险中等，非本轮范围）。

本机无 langchain 等重依赖，用源码级断言。
"""
import os


def _read_legacy():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "knowledge_imp_legacy.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def _extract_fn(src: str, name: str) -> str:
    start = src.find(f"def {name}(")
    if start == -1:
        return ""
    next_def = src.find("\ndef ", start + 10)
    return src[start:next_def if next_def != -1 else len(src)]


def test_async_version_raises_knowledge_llm_error():
    """async 版 LLM 错误用 KnowledgeLLMError（非裸 Exception）"""
    fn = _extract_fn(_read_legacy(), "async_read_chunk_text")
    assert "raise KnowledgeLLMError" in fn, \
        "async_read_chunk_text LLM 错误未用 KnowledgeLLMError（语义弱化为裸 Exception）"


def test_async_version_raises_knowledge_file_damaged_error():
    """async 版文件损坏用 KnowledgeFileDamagedError"""
    fn = _extract_fn(_read_legacy(), "async_read_chunk_text")
    assert "raise KnowledgeFileDamagedError" in fn, \
        "async_read_chunk_text 文件损坏未用 KnowledgeFileDamagedError"


def test_async_version_raises_knowledge_file_not_supported_error():
    """async 版类型不支持用 KnowledgeFileNotSupportedError"""
    fn = _extract_fn(_read_legacy(), "async_read_chunk_text")
    assert "raise KnowledgeFileNotSupportedError" in fn, \
        "async_read_chunk_text 类型不支持未用 KnowledgeFileNotSupportedError"


def test_sync_and_async_error_types_consistent():
    """sync 与 async 版错误类型一致"""
    src = _read_legacy()
    sync_fn = _extract_fn(src, "read_chunk_text")
    async_fn = _extract_fn(src, "async_read_chunk_text")
    for err in ["KnowledgeLLMError", "KnowledgeFileDamagedError", "KnowledgeFileNotSupportedError"]:
        assert err in async_fn, f"async 版缺 {err}"
        assert err in sync_fn, f"sync 版缺 {err}"
