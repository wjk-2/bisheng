from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, select, delete, func, text, update

from bisheng.common.models.base import SQLModelSerializable
from bisheng.core.database import get_sync_db_session


# ── ConversationTag ──────────────────────────────────────────

class ConversationTagBase(SQLModelSerializable):
    user_id: int = Field(description='用户ID')
    tag: str = Field(max_length=200, description='标签名')
    description: Optional[str] = Field(default='', max_length=500)
    position: int = Field(default=0)
    count: int = Field(default=0)
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')),
    )
    update_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False,
                         server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
    )


class ConversationTag(ConversationTagBase, table=True):
    __tablename__ = 'conversation_tag'
    __table_args__ = (UniqueConstraint('user_id', 'tag', name='uk_user_tag'),)
    id: Optional[int] = Field(default=None, primary_key=True)


# ── ConversationTagLink ─────────────────────────────────────

class ConversationTagLinkBase(SQLModelSerializable):
    conversation_id: str = Field(max_length=100)
    tag: str = Field(max_length=200)
    user_id: int = Field(description='用户ID')
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')),
    )


class ConversationTagLink(ConversationTagLinkBase, table=True):
    __tablename__ = 'conversation_tag_link'
    __table_args__ = (UniqueConstraint('conversation_id', 'tag', name='uk_convo_tag'),)
    id: Optional[int] = Field(default=None, primary_key=True)


# ── DAO ──────────────────────────────────────────────────────

class ConversationTagDao(ConversationTag):

    @classmethod
    def get_by_user(cls, user_id: int) -> List[ConversationTag]:
        stmt = (select(ConversationTag)
                .where(ConversationTag.user_id == user_id)
                .order_by(ConversationTag.position.asc()))
        with get_sync_db_session() as session:
            return session.exec(stmt).all()

    @classmethod
    def get_by_user_and_tag(cls, user_id: int, tag: str) -> Optional[ConversationTag]:
        stmt = select(ConversationTag).where(
            ConversationTag.user_id == user_id,
            ConversationTag.tag == tag,
        )
        with get_sync_db_session() as session:
            return session.exec(stmt).first()

    @classmethod
    def insert(cls, record: ConversationTag) -> ConversationTag:
        with get_sync_db_session() as session:
            session.add(record)
            session.commit()
            session.refresh(record)
            return record

    @classmethod
    def update_tag(cls, user_id: int, old_tag: str, data: dict) -> Optional[ConversationTag]:
        with get_sync_db_session() as session:
            record = session.exec(
                select(ConversationTag).where(
                    ConversationTag.user_id == user_id,
                    ConversationTag.tag == old_tag,
                )
            ).first()
            if not record:
                return None
            new_tag_name = data.get('tag')
            for k, v in data.items():
                if hasattr(record, k):
                    setattr(record, k, v)
            session.add(record)
            # 如果 tag 名称变了，同步更新 link 表
            if new_tag_name and new_tag_name != old_tag:
                session.exec(
                    update(ConversationTagLink)
                    .where(ConversationTagLink.user_id == user_id,
                           ConversationTagLink.tag == old_tag)
                    .values(tag=new_tag_name)
                )
            session.commit()
            session.refresh(record)
            return record

    @classmethod
    def delete_tag(cls, user_id: int, tag: str) -> bool:
        with get_sync_db_session() as session:
            session.exec(delete(ConversationTagLink).where(
                ConversationTagLink.user_id == user_id,
                ConversationTagLink.tag == tag,
            ))
            session.exec(delete(ConversationTag).where(
                ConversationTag.user_id == user_id,
                ConversationTag.tag == tag,
            ))
            session.commit()
            return True


class ConversationTagLinkDao(ConversationTagLink):

    @classmethod
    def get_tags_for_conversation(cls, conversation_id: str, user_id: int) -> List[str]:
        stmt = select(ConversationTagLink.tag).where(
            ConversationTagLink.conversation_id == conversation_id,
            ConversationTagLink.user_id == user_id,
        )
        with get_sync_db_session() as session:
            return list(session.exec(stmt).all())

    @classmethod
    def set_tags_for_conversation(cls, conversation_id: str, user_id: int, tags: List[str]) -> List[str]:
        """完全替换一个会话的 tag 列表，并同步更新 count"""
        with get_sync_db_session() as session:
            # 获取旧 tags
            old_tags = set(session.exec(
                select(ConversationTagLink.tag).where(
                    ConversationTagLink.conversation_id == conversation_id,
                    ConversationTagLink.user_id == user_id,
                )
            ).all())
            new_tags = set(tags)

            to_remove = old_tags - new_tags
            to_add = new_tags - old_tags

            # 删除不再需要的
            if to_remove:
                session.exec(delete(ConversationTagLink).where(
                    ConversationTagLink.conversation_id == conversation_id,
                    ConversationTagLink.user_id == user_id,
                    ConversationTagLink.tag.in_(to_remove),
                ))
                # count -1
                for t in to_remove:
                    session.exec(
                        update(ConversationTag)
                        .where(ConversationTag.user_id == user_id, ConversationTag.tag == t)
                        .values(count=ConversationTag.count - 1)
                    )

            # 添加新的
            for t in to_add:
                session.add(ConversationTagLink(
                    conversation_id=conversation_id, tag=t, user_id=user_id))
                # count +1
                session.exec(
                    update(ConversationTag)
                    .where(ConversationTag.user_id == user_id, ConversationTag.tag == t)
                    .values(count=ConversationTag.count + 1)
                )

            session.commit()
            return tags

    @classmethod
    def rebuild_counts(cls, user_id: int) -> None:
        """重新计算所有 tag 的 count"""
        with get_sync_db_session() as session:
            # 获取用户所有 tag
            all_tags = session.exec(
                select(ConversationTag).where(ConversationTag.user_id == user_id)
            ).all()
            for ct in all_tags:
                cnt = session.scalar(
                    select(func.count(ConversationTagLink.id)).where(
                        ConversationTagLink.user_id == user_id,
                        ConversationTagLink.tag == ct.tag,
                    )
                )
                ct.count = cnt
                session.add(ct)
            session.commit()
