"""TDD: D1 rerank httpx 显式 timeout 防回归。

背景：common_rerank.py:29,31,82,107 四处 httpx 调用无 timeout，
rerank 服务卡死会无限等待。正道：显式 timeout=10s。
"""
import os


def _read():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, "bisheng", "core", "ai", "rerank", "common_rerank.py"), encoding="utf-8") as f:
        return f.read()


def test_rerank_timeout_constant_defined():
    src = _read()
    assert "RERANK_TIMEOUT" in src, "未定义 RERANK_TIMEOUT 常量"


def test_client_init_has_timeout():
    src = _read()
    # Client/AsyncClient 构造含 timeout
    assert "Client(base_url=self.base_url, timeout=" in src or "timeout=RERANK_TIMEOUT" in src
    assert "AsyncClient(base_url=self.base_url, timeout=" in src or "timeout=RERANK_TIMEOUT" in src


def test_post_calls_have_timeout():
    src = _read()
    # 两处 post 调用含 timeout
    assert src.count("timeout=RERANK_TIMEOUT") >= 4, "四处 httpx 调用未全部加 timeout（Client/AsyncClient 构造 + 同步/异步 post）"
