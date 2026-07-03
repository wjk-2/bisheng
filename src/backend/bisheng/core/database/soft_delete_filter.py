"""E3: 软删除全局过滤——do_orm_execute event。

为带 is_deleted 字段的模型（Knowledge / KnowledgeFile）的 SELECT 全局注入
is_deleted=False 过滤，避免散点遗漏（≥15 处查询点改易漏）。

注册到 Session.do_orm_execute（SQLAlchemy 2.0 ORM 执行事件），对所有 ORM 查询生效。
purge 硬删通过 .execution_options(include_deleted=True) 绕过过滤（回收站管理用）。

启动时 import 本模块即注册（main.py 或 connection.py 引用）。
"""
import logging

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

logger = logging.getLogger(__name__)

_SOFT_DELETE_MODELS = None


def _get_soft_delete_models():
    """延迟加载带 is_deleted 字段的模型（避免循环 import）。

    失败时不缓存（保持 None 下次重试），避免启动早期模型未加载完毕时永久固化空 tuple
    致软删过滤静默失效。用 None 与 () 区分：None=未加载（重试），()=已加载但无模型。
    """
    global _SOFT_DELETE_MODELS
    if _SOFT_DELETE_MODELS is not None:
        return _SOFT_DELETE_MODELS
    try:
        from bisheng.knowledge.domain.models.knowledge import Knowledge
        from bisheng.knowledge.domain.models.knowledge_file import KnowledgeFile
        _SOFT_DELETE_MODELS = (Knowledge, KnowledgeFile)
    except Exception as e:
        # 不缓存，保持 None 下次重试；error 级日志便于发现
        logger.error(f"soft delete models not loaded yet (will retry): {e}")
        return None
    return _SOFT_DELETE_MODELS


@event.listens_for(Session, "do_orm_execute")
def _filter_soft_deleted(execute_state):
    """SELECT 查询全局注入 is_deleted=False 过滤（带 include_deleted 选项绕过）

    用 with_loader_criteria 对每个带 is_deleted 的模型注入条件。
    一次性遍历所有软删模型，options() 可叠加多个 with_loader_criteria。
    """
    if not execute_state.is_select:
        return
    if execute_state.execution_options.get("include_deleted", False):
        return  # purge/回收站查询绕过
    models = _get_soft_delete_models()
    if not models:
        return
    stmt = execute_state.statement
    for model in models:
        stmt = stmt.options(
            with_loader_criteria(
                model,
                lambda cls: cls.is_deleted.is_(False),
                include_aliases=True,
            )
        )
    execute_state.statement = stmt
