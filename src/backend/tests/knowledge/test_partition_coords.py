"""TDD: partition_coords 归一 bbox → 像素换算（G2 步2 Task8）。

adapter 产归一 [0,1]（文字页 PyMuPDF / 扫描页 grounding），E-Agent crop 用 72DPI
（page.rect）。本测试用 importlib spec 加载 partition_coords.py 单文件（不触发
bisheng/langchain init），实测换算数学。
"""
import importlib.util
import os


def _load():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "partition_coords.py")
    spec = importlib.util.spec_from_file_location("partition_coords", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_normalized_bbox_to_pixel():
    """归一 bbox [0,1] × 页面尺寸 → 像素 int。"""
    mod = _load()
    # 463.pdf 第1页 612×783，bbox 归一 [0.087,0.095,0.556,0.223]（实测 grounding）
    result = mod.normalize_bbox_to_pixel([0.087, 0.095, 0.556, 0.223], 612, 783)
    expected = [int(0.087 * 612), int(0.095 * 783), int(0.556 * 612), int(0.223 * 783)]
    assert result == expected, f"归一换算错: {result} != {expected}"
    assert all(isinstance(v, int) for v in result)


def test_already_pixel_bbox_passthrough():
    """已像素 bbox(>1.0) 直接 int（兼容旧 etl4llm 像素坐标）。"""
    mod = _load()
    result = mod.normalize_bbox_to_pixel([100, 200, 300, 400], 612, 783)
    assert result == [100, 200, 300, 400]


def test_none_pix_size_fallback_int():
    """pix_w/h 为 None（拿不到尺寸，如 file_name 无效）→ bbox 直接 int 兜底。"""
    mod = _load()
    result = mod.normalize_bbox_to_pixel([0.5, 0.5, 1.0, 1.0], None, None)
    assert result == [0, 0, 1, 1]  # int(0.5)=0, int(1.0)=1


def test_empty_bbox():
    """空 bbox 返回空。"""
    mod = _load()
    assert mod.normalize_bbox_to_pixel([], 612, 783) == []


def test_boundary_max_le_1_treated_as_normalized():
    """max(bbox)==1.0 视为归一（边界，全页 bbox [0,0,1,1] → 全页像素）。"""
    mod = _load()
    result = mod.normalize_bbox_to_pixel([0.0, 0.0, 1.0, 1.0], 612, 783)
    assert result == [0, 0, 612, 783]
