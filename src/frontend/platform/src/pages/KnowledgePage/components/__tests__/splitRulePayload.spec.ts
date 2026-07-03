import { describe, it, expect } from 'vitest';
import { buildFileProcessPayload } from '../splitRulePayload';

describe('B1 前后端类型对齐', () => {
  it('chunk_size/chunk_overlap 转 number（后端期望 int）', () => {
    const p = buildFileProcessPayload({
      chunkSize: '1000', chunkOverlap: '100',
      retainImages: true, enableFormula: true, forceOcr: true,
      pageHeaderFooter: true,
    });
    expect(p.chunk_size).toBe(1000);
    expect(typeof p.chunk_size).toBe('number');
    expect(p.chunk_overlap).toBe(100);
    expect(typeof p.chunk_overlap).toBe('number');
  });

  it('retain_images/enable_formula/force_ocr 转 0|1（后端期望 int）', () => {
    const p = buildFileProcessPayload({
      chunkSize: '500', chunkOverlap: '50',
      retainImages: true, enableFormula: false, forceOcr: true,
      pageHeaderFooter: false,
    });
    expect(p.retain_images).toBe(1);
    expect(p.enable_formula).toBe(0);
    expect(p.force_ocr).toBe(1);
    expect(p.filter_page_header_footer).toBe(0);
  });

  it('filter_page_header_footer 转 0|1', () => {
    const p = buildFileProcessPayload({
      chunkSize: '1', chunkOverlap: '0',
      retainImages: false, enableFormula: false, forceOcr: false,
      pageHeaderFooter: true,
    });
    expect(p.filter_page_header_footer).toBe(1);
    expect(p.retain_images).toBe(0);
  });

  it('空字符串/NaN/非正数 chunk_size 回退默认 1000', () => {
    for (const bad of ['', 'abc', '-1', '0']) {
      const p = buildFileProcessPayload({
        chunkSize: bad, chunkOverlap: '0',
        retainImages: true, enableFormula: true, forceOcr: true,
        pageHeaderFooter: true,
      });
      expect(p.chunk_size).toBe(1000);
    }
  });

  it('负数 chunk_overlap 回退 0', () => {
    const p = buildFileProcessPayload({
      chunkSize: '1000', chunkOverlap: '-5',
      retainImages: true, enableFormula: true, forceOcr: true,
      pageHeaderFooter: true,
    });
    expect(p.chunk_overlap).toBe(0);
  });
});
