/** 检索配置校验纯函数（B3 抽离，使 onValidate 不再恒通过）。
 *
 * 原 RetrievalWeightSlider:57 onValidate(() => false) 使检索配置校验恒通过。
 * 改为真实权重范围校验：权重应 ∈ [0,1]。rerank 模型留空由后端兜底（G2-b 决策）。
 */

export function validateRetrievalWeights(
  vectorWeight: number,
  keywordWeight: number,
): string | false {
  if (vectorWeight < 0 || vectorWeight > 1) return 'vector_weight_range';
  if (keywordWeight < 0 || keywordWeight > 1) return 'keyword_weight_range';
  return false; // 通过
}
