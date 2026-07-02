"""TDD: P0-4 rerank 调用阶段降级。

背景：tool/domain/langchain/knowledge.py:57-58（同步）、:93-94（异步）rerank 调用
无 try/except。初始化阶段有降级（workflow/common/knowledge.py:296-312 失败置 None），
但调用阶段 rerank 服务挂掉直接抛异常中断整个检索。与初始化降级语义不对称。

正道：抽 compress_with_degrade / acompress_with_degrade 纯函数，调用点失败时
记 warning 并返回原 docs（不中断检索），与初始化降级语义对称。
"""
import asyncio
import importlib.util
import os


def _load_rerank_degrade():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "workflow", "common", "rerank_degrade.py")
    spec = importlib.util.spec_from_file_location("rerank_degrade", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_sync_rerank_failure_degrades_to_original_docs():
    """rerank 调用失败时降级返回原 docs，不抛异常"""
    mod = _load_rerank_degrade()

    class BoomRerank:
        def compress_documents(self, docs, query):
            raise RuntimeError("rerank service down")

    docs = [{"page_content": "x"}]
    out, degraded = mod.compress_with_degrade(BoomRerank(), docs, "q", logger=None)
    assert out == docs
    assert degraded is True


def test_sync_no_rerank_passthrough():
    """rerank=None 时直接返回原 docs，不降级"""
    mod = _load_rerank_degrade()
    docs = [{"page_content": "x"}]
    out, degraded = mod.compress_with_degrade(None, docs, "q", logger=None)
    assert out == docs
    assert degraded is False


def test_sync_rerank_success_returns_compressed():
    """rerank 成功时返回压缩后 docs，不降级"""
    mod = _load_rerank_degrade()

    class OkRerank:
        def compress_documents(self, docs, query):
            return [{"page_content": "compressed"}]

    out, degraded = mod.compress_with_degrade(OkRerank(), [{"page_content": "x"}], "q", logger=None)
    assert out == [{"page_content": "compressed"}]
    assert degraded is False


def test_async_rerank_failure_degrades_to_original_docs():
    """异步 rerank 调用失败时降级返回原 docs，不抛异常"""
    mod = _load_rerank_degrade()

    class BoomRerank:
        async def acompress_documents(self, docs, query):
            raise RuntimeError("rerank service down")

    docs = [{"page_content": "x"}]
    out, degraded = asyncio.run(mod.acompress_with_degrade(BoomRerank(), docs, "q", logger=None))
    assert out == docs
    assert degraded is True


def test_async_no_rerank_passthrough():
    mod = _load_rerank_degrade()
    out, degraded = asyncio.run(mod.acompress_with_degrade(None, [{"page_content": "x"}], "q", logger=None))
    assert degraded is False
