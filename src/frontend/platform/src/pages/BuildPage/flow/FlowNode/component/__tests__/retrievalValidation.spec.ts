import { describe, it, expect } from 'vitest';
import { validateRetrievalWeights } from '../retrievalValidation';

describe('B3 检索权重校验', () => {
  it('合法权重通过', () => {
    expect(validateRetrievalWeights(0.5, 0.5)).toBe(false);
    expect(validateRetrievalWeights(0.3, 0.7)).toBe(false);
    expect(validateRetrievalWeights(1, 0)).toBe(false);
    expect(validateRetrievalWeights(0, 1)).toBe(false);
  });
  it('vector 超界报错', () => {
    expect(validateRetrievalWeights(1.5, 0.5)).toBe('vector_weight_range');
    expect(validateRetrievalWeights(-0.1, 0.5)).toBe('vector_weight_range');
  });
  it('keyword 超界报错', () => {
    expect(validateRetrievalWeights(0.5, 1.5)).toBe('keyword_weight_range');
    expect(validateRetrievalWeights(0.5, -0.1)).toBe('keyword_weight_range');
  });
});
