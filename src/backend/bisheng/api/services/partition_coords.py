"""Partition bbox 坐标换算（G2 步2 Task8）。

adapter（eagent-ocr-adapter）产归一 bbox [0,1]：
- 文字页：PyMuPDF block bbox（PDF 点）/ 页面尺寸 → [0,1]
- 扫描页：DeepSeek-OCR-2 grounding 0-999 整数 / 999 → [0,1]

E-Agent merge_partitions 消费时要换算成像素——crop_image（extract_pdf_images）
用 page.get_pixmap() 默认 72DPI 渲染（像素 = PDF 点），故换算用页面 PDF 点尺寸
（page.rect.width/height）。

归一是比例，与 adapter 渲染 DPI（文字页 PyMuPDF 原生 / 扫描页 OCR 200DPI）无关——
同一页面区域在任何 DPI 下归一比例一致，× 72DPI 像素 = crop 图上的像素位置。

controller deviation（2026-07-04）：计划 A Task5 原写 DPI=200 换算，但实测 E-Agent
crop_image 用 page.get_pixmap() 默认 72DPI（extract_pdf_images:115），改用 page.rect
（72DPI 像素 = PDF 点）。归一比例与 DPI 无关，结论不变。

兼容：bbox 值 >1.0 视为已像素（旧 etl4llm 像素坐标），直接 int。
"""


def normalize_bbox_to_pixel(bbox, pix_w, pix_h):
    """归一 bbox [0,1] → 像素（× 页面尺寸）；已像素(>1) 直接 int。

    Args:
        bbox: [x0, y0, x1, y1]，归一 [0,1] 或已像素(>1)
        pix_w / pix_h: 页面像素尺寸（72DPI = PDF 点，= page.rect.width/height）
    Returns:
        [x0, y0, x1, y1] int 像素。pix_w/h 为 None（拿不到尺寸）时 bbox 直接 int 兜底。
    """
    if not bbox:
        return []
    if pix_w is None or pix_h is None:
        return [int(v) for v in bbox]
    if max(bbox) <= 1.0:  # 归一 [0,1]
        return [
            int(bbox[0] * pix_w), int(bbox[1] * pix_h),
            int(bbox[2] * pix_w), int(bbox[3] * pix_h),
        ]
    return [int(v) for v in bbox]  # 已像素（兼容旧 etl4llm 像素坐标）
