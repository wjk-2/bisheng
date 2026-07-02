"""TDD: P0-1 filter_page_header_footer 端到端接缝贯通（E-Agent 端）。

背景：审核报告 P0-1 指出"过滤页眉页脚"配置端到端断链——
- 后端 etl4lm_loader.py:207,281 TODO 未转发 filter_page_header_footer 给 etl4llm payload
- 前端 5 处拼写错 fileter（漏 r），后端收 filter，Pydantic 静默丢弃
- 前端默认 true 后端默认 0 语义相反

经财经容器实证：etl4llm 服务侧（OCR Adapter @ 8180）当前不消费该字段
（Etl4llmRequest 无该字段、routes 不读、首版 text 退化无 bbox）。
彭总定案"本期只打通接缝占位"：E-Agent 端转发 + 前端修正 + adapter 透传到 OcrContext，
剥离逻辑待 adapter G2 grounding 实现后补。

本测试验证 E-Agent 端（源码级断言，不 exec_module 触发重依赖 aiofiles 等）：
1. etl4lm_loader payload 构造处转发 filter_page_header_footer
2. TODO 注释已删除

源码级断言受"不连真实服务/不拉 bisheng init"约束（与 importlib 直加载纯函数范式的差异：
etl4lm_loader 是有重依赖的类，exec_module 会触发 aiofiles 等导入失败，故改读源码文本）。
"""
import os


def _read_etl4lm_loader_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "etl4lm_loader.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_etl4lm_payload_forwards_filter_page_header_footer():
    """P0-1: etl4lm_loader 构造的 payload 必须转发 filter_page_header_footer 给 etl4llm 服务"""
    src = _read_etl4lm_loader_src()
    # 条件1: TODO 注释已删除
    assert "TODO: add filter_page_header_footer" not in src, "etl4lm_loader TODO 注释仍在"
    # 条件2: payload 构造处含 filter_page_header_footer 键（转发给 etl4llm）
    assert "filter_page_header_footer=bool(self.filter_page_header_footer)" in src, \
        "etl4lm_loader 仍未把 filter_page_header_footer 转发进 payload"
