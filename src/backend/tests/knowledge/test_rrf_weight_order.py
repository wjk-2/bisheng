"""TDD: P0-3 RRF 权重顺序对齐。

背景：tool/domain/langchain/knowledge.py:103
  rrf_rerank.compress_documents(documents=[es_docs, milvus_docs], query=query)
documents 顺序（es在前）与 retrievers=[vector_retriever, elastic_retriever]（:100，milvus在前）、
weights=self.rrf_weights（来自 workflow/common/knowledge.py:244 [vector_weight, keyword_weight]）不一致。
rrf_rerank.py:68 zip(documents, weights) 按位配对 → es_docs 配 vector_weight、milvus_docs 配 keyword_weight，
权重对调。默认 0.5/0.5 无影响，用户调不等权重时静默错配。

正道：documents 顺序对齐 retrievers/weights（向量 milvus 在前，关键词 es 在后）。
rrf_rerank.py:55-56 已有长度断言，不重复添加。
"""
import os


def _read_kb_tool_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "tool", "domain", "langchain", "knowledge.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_rrf_documents_order_matches_weights_order():
    """P0-3: documents 顺序必须与 weights 顺序一致（向量 milvus 在前，关键词 es 在后）"""
    src = _read_kb_tool_src()
    # retrievers=[self.vector_retriever, self.elastic_retriever]（向量在前）
    # weights=[vector_weight, keyword_weight]（向量权重在前）
    # documents 必须同为 [milvus_docs, es_docs]（向量在前）
    assert "documents=[milvus_docs, es_docs]" in src, \
        "RRF documents 顺序仍与 weights 不一致（应为 [milvus_docs, es_docs]，向量在前）"
