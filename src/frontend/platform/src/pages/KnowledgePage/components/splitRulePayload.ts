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
  return {
    chunk_size: Number(s.chunkSize),
    chunk_overlap: Number(s.chunkOverlap),
    retain_images: s.retainImages ? 1 : 0,
    enable_formula: s.enableFormula ? 1 : 0,
    force_ocr: s.forceOcr ? 1 : 0,
    filter_page_header_footer: s.pageHeaderFooter ? 1 : 0,
  };
}
