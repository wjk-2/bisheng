"""I3: 逻辑备份（未真实现，placeholder 模块，勿接入主流程）。

原计划：rebuild 删前先备份 Milvus/ES 向量到 MinIO（防删后不可回退）。
降级方案：Milvus 2.3.3 无原生 snapshot、ES snapshot 需改生产配置触禁令，改逻辑备份。

**当前状态：未真实现**。本模块函数体仅构造 object_name 字符串，未 query Milvus、
未 scroll ES、未调 minio_client.put_object。rebuild 已移除伪备份接线（避免误导）。

真实现需补全：vector_client.col.query 全量 → 序列化 JSON → minio_client.put_object 全链路。
实现前不要在 rebuild 或其他主流程调用 backup_before_rebuild。
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def backup_milvus_to_minio(collection_name: str, knowledge_id: int,
                            minio_client=None, bucket: str = "kb-backup") -> Optional[str]:
    """Milvus collection 全量 query 导出到 MinIO（JSON）。

    部署后接真实实现：vector_client.col.query 全量 → JSON → minio_client.put_object。
    本机/无 Milvus 时返回 None（placeholder，不阻断 rebuild）。
    """
    if minio_client is None:
        logger.info(f"backup_milvus placeholder（no minio_client）collection={collection_name}")
        return None
    try:
        # TODO 部署后接真实导出：vector_client.col.query(expr="knowledge_id >= 0", output_fields=["*"])
        object_name = f"milvus/{knowledge_id}/{collection_name}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
        logger.info(f"backup_milvus to_minio collection={collection_name} object={object_name}")
        return object_name
    except Exception as e:
        logger.warning(f"backup_milvus failed collection={collection_name}: {e}（rebuild 继续，无备份）")
        return None


def backup_es_to_minio(index_name: str, knowledge_id: int,
                        minio_client=None, bucket: str = "kb-backup") -> Optional[str]:
    """ES index scroll + bulk dump 到 MinIO 文件。

    部署后接真实实现：es_client.scroll 全量 → bulk JSON → minio_client.put_object。
    本机/无 ES 时返回 None。
    """
    if minio_client is None:
        logger.info(f"backup_es placeholder（no minio_client）index={index_name}")
        return None
    try:
        object_name = f"es/{knowledge_id}/{index_name}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
        logger.info(f"backup_es to_minio index={index_name} object={object_name}")
        return object_name
    except Exception as e:
        logger.warning(f"backup_es failed index={index_name}: {e}（rebuild 继续，无备份）")
        return None


def backup_before_rebuild(knowledge, minio_client=None) -> dict:
    """rebuild 删向量前调——先备份 Milvus + ES 到 MinIO。

    备份失败不阻断 rebuild（仅 warning），因 rebuild 是用户主动触发重建，原向量本就要删；
    备份是为"重建失败时回退"提供可能，非强制。
    """
    result = {"milvus": None, "es": None}
    try:
        result["milvus"] = backup_milvus_to_minio(
            knowledge.collection_name, knowledge.id, minio_client)
        result["es"] = backup_es_to_minio(
            knowledge.index_name or knowledge.collection_name, knowledge.id, minio_client)
        logger.info(f"backup_before_rebuild knowledge={knowledge.id} result={result}")
    except Exception as e:
        logger.warning(f"backup_before_rebuild failed knowledge={knowledge.id}: {e}（继续 rebuild）")
    return result
