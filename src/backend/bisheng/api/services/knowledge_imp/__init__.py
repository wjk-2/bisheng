"""knowledge_imp 包（F1 架构改造：包结构 + re-export）。

原 knowledge_imp.py（1555 行上帝模块）改名 knowledge_imp_legacy.py，
本包 __init__.py re-export 其全部公开符号，保持向后兼容
（`from bisheng.api.services.knowledge_imp import X` 仍可用）。

F1 决策（彭总 2026-07-02）：物理拆分 8 子模块风险高且 re-export 仍让旧路径可用
（接缝倒置不强制解除），故降级为"包结构 + re-export + DeprecationWarning"。
接缝倒置的治本由 F3 承担（改 linsight/workflow 调用方用窄接口）。

新增代码应优先从子模块路径 import（待子模块物理拆分后）。
"""
import warnings as _w

_w.warn(
    "bisheng.api.services.knowledge_imp is a re-export shim over knowledge_imp_legacy; "
    "new code should import from the specific submodule (F1/F3 接缝倒置收敛)",
    DeprecationWarning,
    stacklevel=2,
)

from bisheng.api.services.knowledge_imp_legacy import *  # noqa: F401,F403
# 显式 re-export 顶层公开符号（确保 from knowledge_imp import X 可用）
from bisheng.api.services.knowledge_imp_legacy import (  # noqa: F401
    KnowledgeUtils,
    QA_save_knowledge,
    addEmbedding,
    add_file_embedding,
    add_qa,
    add_text_into_vector,
    async_decide_knowledge_llm,
    async_images_to_minio,
    async_read_chunk_text,
    async_upload_preview_file_to_minio,
    decide_knowledge_llm,
    decide_vectorstores,
    delete_es,
    delete_knowledge_file_vectors,
    delete_minio_files,
    delete_vector,
    delete_vector_data,
    delete_vector_files,
    extract_code_blocks,
    list_qa_by_knowledge_id,
    parse_document_title,
    parse_partitions,
    process_file_task,
    put_images_to_minio,
    qa_status_change,
    read_chunk_text,
    recommend_question,
    text_knowledge,
    upload_preview_file_to_minio,
)
