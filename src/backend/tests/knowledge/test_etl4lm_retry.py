"""TDD: D3 OCR 重试 + 修 timemout 拼写防回归。

背景：etl4lm_loader.py:194 属性拼写 self.timemout（应 timeout）；:217-242 超时直接抛 FAILED，
无重试，配置即硬依赖。正道：属性名修正 + 3 次重试 + backoff。
"""
import os


def _read():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, "bisheng", "api", "services", "etl4lm_loader.py"), encoding="utf-8") as f:
        return f.read()


def test_no_timemout_typo():
    """属性名应为 self.timeout，非 self.timemout"""
    src = _read()
    assert "self.timemout" not in src, "属性拼写 timemout 未修正为 timeout"
    assert "self.timeout = timeout" in src, "未赋值 self.timeout"


def test_ocr_has_retry():
    """OCR 调用有重试逻辑（3 次或 retry 循环）"""
    src = _read()
    # 重试循环或 tenacity 或 _post_with_retry
    assert ("_post_with_retry" in src or "for attempt" in src
            or "range(1, OCR_MAX_RETRIES" in src or "max_retries" in src.lower()), \
        "OCR 调用无重试逻辑（超时即抛 FAILED）"


def test_ocr_retry_constant():
    """定义重试次数常量"""
    src = _read()
    assert "OCR_MAX_RETRIES" in src or "OCR_RETRIES" in src, "未定义 OCR 重试次数常量"
