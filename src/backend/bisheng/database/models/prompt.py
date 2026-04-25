from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime
from sqlmodel import Field, select, delete, func, text

from bisheng.common.models.base import SQLModelSerializable
from bisheng.core.database import get_sync_db_session


# ── PromptGroup ──────────────────────────────────────────────

class PromptGroupBase(SQLModelSerializable):
    name: str = Field(max_length=200, description='提示词组名称')
    author: int = Field(description='创建者用户ID')
    author_name: Optional[str] = Field(default='', max_length=100, description='创建者显示名')
    command: Optional[str] = Field(default=None, max_length=100)
    oneliner: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=100)
    production_id: Optional[int] = Field(default=None, description='生产版本 prompt id')
    number_of_generations: int = Field(default=0)
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')),
    )
    update_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False,
                         server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
    )


class PromptGroup(PromptGroupBase, table=True):
    __tablename__ = 'prompt_group'
    id: Optional[int] = Field(default=None, primary_key=True)


# ── Prompt ───────────────────────────────────────────────────

class PromptBase(SQLModelSerializable):
    group_id: int = Field(description='所属 prompt_group id')
    author: int = Field(description='创建者用户ID')
    prompt: str = Field(description='提示词内容')
    type: str = Field(default='text', max_length=10)
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')),
    )
    update_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False,
                         server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
    )


class Prompt(PromptBase, table=True):
    __tablename__ = 'prompt'
    id: Optional[int] = Field(default=None, primary_key=True)


# ── DAO ──────────────────────────────────────────────────────

class PromptGroupDao(PromptGroup):

    @classmethod
    def get_by_id(cls, group_id: int) -> Optional[PromptGroup]:
        with get_sync_db_session() as session:
            return session.exec(select(PromptGroup).where(PromptGroup.id == group_id)).first()

    @classmethod
    def get_all(cls, author: Optional[int] = None) -> List[PromptGroup]:
        stmt = select(PromptGroup).order_by(PromptGroup.update_time.desc())
        if author is not None:
            stmt = stmt.where(PromptGroup.author == author)
        with get_sync_db_session() as session:
            return session.exec(stmt).all()

    @classmethod
    def get_page(cls, *, category: str = None, name: str = None,
                 author: int = None, page: int = 1, page_size: int = 10) -> tuple:
        """返回 (groups, total)"""
        stmt = select(PromptGroup)
        count_stmt = select(func.count(PromptGroup.id))
        if category:
            stmt = stmt.where(PromptGroup.category == category)
            count_stmt = count_stmt.where(PromptGroup.category == category)
        if name:
            stmt = stmt.where(PromptGroup.name.like(f'%{name}%'))
            count_stmt = count_stmt.where(PromptGroup.name.like(f'%{name}%'))
        if author is not None:
            stmt = stmt.where(PromptGroup.author == author)
            count_stmt = count_stmt.where(PromptGroup.author == author)
        stmt = stmt.order_by(PromptGroup.update_time.desc()).offset((page - 1) * page_size).limit(page_size)
        with get_sync_db_session() as session:
            groups = session.exec(stmt).all()
            total = session.scalar(count_stmt)
        return groups, total

    @classmethod
    def insert(cls, group: PromptGroup) -> PromptGroup:
        with get_sync_db_session() as session:
            session.add(group)
            session.commit()
            session.refresh(group)
            return group

    @classmethod
    def update(cls, group_id: int, data: dict) -> Optional[PromptGroup]:
        with get_sync_db_session() as session:
            group = session.exec(select(PromptGroup).where(PromptGroup.id == group_id)).first()
            if not group:
                return None
            for k, v in data.items():
                if hasattr(group, k):
                    setattr(group, k, v)
            session.add(group)
            session.commit()
            session.refresh(group)
            return group

    @classmethod
    def delete_by_id(cls, group_id: int) -> bool:
        with get_sync_db_session() as session:
            session.exec(delete(Prompt).where(Prompt.group_id == group_id))
            session.exec(delete(PromptGroup).where(PromptGroup.id == group_id))
            session.commit()
            return True

    @classmethod
    def get_random(cls, limit: int = 4, skip: int = 0) -> List[PromptGroup]:
        stmt = (select(PromptGroup)
                .where(PromptGroup.production_id.is_not(None))
                .order_by(func.rand())
                .offset(skip).limit(limit))
        with get_sync_db_session() as session:
            return session.exec(stmt).all()


class PromptDao(Prompt):

    @classmethod
    def get_by_id(cls, prompt_id: int) -> Optional[Prompt]:
        with get_sync_db_session() as session:
            return session.exec(select(Prompt).where(Prompt.id == prompt_id)).first()

    @classmethod
    def get_by_group(cls, group_id: int) -> List[Prompt]:
        stmt = select(Prompt).where(Prompt.group_id == group_id).order_by(Prompt.create_time.desc())
        with get_sync_db_session() as session:
            return session.exec(stmt).all()

    @classmethod
    def insert(cls, prompt: Prompt) -> Prompt:
        with get_sync_db_session() as session:
            session.add(prompt)
            session.commit()
            session.refresh(prompt)
            return prompt

    @classmethod
    def delete_by_id(cls, prompt_id: int) -> bool:
        with get_sync_db_session() as session:
            session.exec(delete(Prompt).where(Prompt.id == prompt_id))
            session.commit()
            return True
