"""D5: 超时文件定时回收。

原 get_knowledge_files 懒触发（仅列表查询时检测 >86400 秒），长期不查询的文件永久卡 PROCESSING。
改为 Celery beat 每小时扫描，把 PROCESSING/WAITING 超 86400 秒（24h）的文件置 TIMEOUT。
"""
from datetime import datetime, timedelta

from loguru import logger

from bisheng.common.errcode.knowledge import KnowledgeFileFailedError
from bisheng.core.logger import trace_id_var
from bisheng.knowledge.domain.models.knowledge_file import (
    KnowledgeFile, KnowledgeFileDao, KnowledgeFileStatus,
)
from bisheng.worker.main import bisheng_celery

TIMEOUT_THRESHOLD_SECONDS = 86400  # 24h


@bisheng_celery.task(name='knowledge.timeout_sweeper')
def timeout_sweeper():
    """扫描超时文件，标记 TIMEOUT。每小时由 beat 触发。"""
    trace_id_var.set('timeout_sweeper')
    from bisheng.database.session import get_sync_db_session
    threshold = datetime.now() - timedelta(seconds=TIMEOUT_THRESHOLD_SECONDS)
    timeout_ids = []
    with get_sync_db_session() as session:
        rows = session.query(KnowledgeFile.id).filter(
            KnowledgeFile.status.in_([KnowledgeFileStatus.PROCESSING.value,
                                      KnowledgeFileStatus.WAITING.value]),
            KnowledgeFile.update_time < threshold,
        ).all()
        timeout_ids = [r[0] for r in rows]
    if timeout_ids:
        KnowledgeFileDao.update_file_status(
            timeout_ids, KnowledgeFileStatus.TIMEOUT,
            KnowledgeFileFailedError(
                data={"exception": "Parsing time exceeds 24 hours (sweeper)"}).to_json_str())
        logger.info(f"timeout_sweeper marked {len(timeout_ids)} files TIMEOUT: {timeout_ids}")
    else:
        logger.debug("timeout_sweeper: no timeout files")
