"""TDD: G1 query_rewrite 默认启用（HyDE 降级不做）。

G1：query_rewrite_enabled 默认 True（多轮指代消解提升召回）。
HyDE 原 plan 提议但 review 后降级不做（35B 增延迟 + ES 关键词路丢词），函数已删。
"""
import os


def _read_settings():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, "bisheng", "core", "config", "settings.py"), encoding="utf-8") as f:
        return f.read()


def test_query_rewrite_enabled_default_true():
    """G1: query_rewrite_enabled 默认 True"""
    src = _read_settings()
    assert "query_rewrite_enabled: bool = Field(default=True" in src, \
        "query_rewrite_enabled 默认未改为 True"


def test_hyde_not_in_settings():
    """HyDE 降级不做：settings 无 hyde_enabled"""
    src = _read_settings()
    assert "hyde_enabled" not in src, "settings 仍含 hyde_enabled（应删）"
