/** 文件处理参数 payload 转换：前端 state → 后端 FileProcessBase（int）。
 *
 * B1 修复：前端 chunk_size/chunk_overlap 原发 string，retain_images 等发 boolean，
 * 后端 FileProcessBase 期望 int。抽纯函数集中转换，便于单测。
 */

export interface FileProcessState {
  chunkSize: string | number;
  chunkOverlap: string | number;
  retainImages: boolean;
  enableFormula: boolean;
  forceOcr: boolean;
  pageHeaderFooter: boolean;
}

export interface FileProcessPayload {
  chunk_size: number;
  chunk_overlap: number;
  retain_images: 0 | 1;
  enable_formula: 0 | 1;
  force_ocr: 0 | 1;
  filter_page_header_footer: 0 | 1;
}

export function buildFileProcessPayload(s: FileProcessState): FileProcessPayload {
  // Number('')===0、Number('abc')===NaN，空/非法输入回退默认（chunk_size 1000、overlap 0），避免发 0/NaN 给后端
  const chunkSize = Number(s.chunkSize);
  const chunkOverlap = Number(s.chunkOverlap);
  return {
    chunk_size: Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : 1000,
    chunk_overlap: Number.isFinite(chunkOverlap) && chunkOverlap >= 0 ? chunkOverlap : 0,
    retain_images: s.retainImages ? 1 : 0,
    enable_formula: s.enableFormula ? 1 : 0,
    force_ocr: s.forceOcr ? 1 : 0,
    filter_page_header_footer: s.pageHeaderFooter ? 1 : 0,
  };
}
