"""
教育模块数据模型
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Column, DateTime, Integer, String, Text, Float, Boolean, ForeignKey, UniqueConstraint, Index, JSON
from sqlalchemy.sql import text
from sqlmodel import Field

from bisheng.common.models.base import SQLModelSerializable
from bisheng.core.database import get_sync_db_session


# ==================== Course 模型 ====================

class CourseBase(SQLModelSerializable):
    """课程基类"""
    title: str = Field(sa_column=Column(String(200), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    level: str = Field(sa_column=Column(String(20), nullable=False))
    category: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    duration: Optional[int] = Field(default=None, sa_column=Column(Integer))
    thumbnail: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    create_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )
    update_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
    )


class Course(CourseBase, table=True):
    """课程表"""
    __tablename__ = 'education_courses'

    id: Optional[int] = Field(default=None, sa_column=Column(Integer, primary_key=True, autoincrement=True))


# ==================== Chapter 模型 ====================

class ChapterBase(SQLModelSerializable):
    """章节基类"""
    course_id: int = Field(sa_column=Column(Integer, ForeignKey('education_courses.id', ondelete='CASCADE'), nullable=False))
    title: str = Field(sa_column=Column(String(200), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    video_url: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    duration: Optional[int] = Field(default=None, sa_column=Column(Integer))
    order_index: int = Field(sa_column=Column(Integer, nullable=False))
    create_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )


class Chapter(ChapterBase, table=True):
    """章节表"""
    __tablename__ = 'education_chapters'

    id: Optional[int] = Field(default=None, sa_column=Column(Integer, primary_key=True, autoincrement=True))

    __table_args__ = (
        Index('idx_course_id', 'course_id'),
    )


# ==================== UserProgress 模型 ====================

class UserProgressBase(SQLModelSerializable):
    """用户学习进度基类"""
    user_id: int = Field(sa_column=Column(Integer, nullable=False))
    course_id: int = Field(sa_column=Column(Integer, ForeignKey('education_courses.id', ondelete='CASCADE'), nullable=False))
    chapter_id: int = Field(sa_column=Column(Integer, ForeignKey('education_chapters.id', ondelete='CASCADE'), nullable=False))
    progress: float = Field(default=0.0, sa_column=Column(Float, default=0.0))
    last_position: int = Field(default=0, sa_column=Column(Integer, default=0))
    completed: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    learning_time: int = Field(default=0, sa_column=Column(Integer, default=0))
    create_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )
    update_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
    )


class UserProgress(UserProgressBase, table=True):
    """用户学习进度表"""
    __tablename__ = 'education_user_progress'

    id: Optional[int] = Field(default=None, sa_column=Column(Integer, primary_key=True, autoincrement=True))

    __table_args__ = (
        UniqueConstraint('user_id', 'chapter_id', name='uk_user_chapter'),
        Index('idx_user_id', 'user_id'),
    )


# ==================== GuidedProgress 模型 ====================

class GuidedProgressBase(SQLModelSerializable):
    """引导式学习进度基类"""
    user_id: int = Field(sa_column=Column(Integer, nullable=False))
    step_id: str = Field(sa_column=Column(String(50), nullable=False))
    completed: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    config_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    create_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    )
    update_time: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
    )


class GuidedProgress(GuidedProgressBase, table=True):
    """引导式学习进度表"""
    __tablename__ = 'education_guided_progress'

    id: Optional[int] = Field(default=None, sa_column=Column(Integer, primary_key=True, autoincrement=True))

    __table_args__ = (
        UniqueConstraint('user_id', 'step_id', name='uk_user_step'),
    )


# ==================== CourseDao ====================

class CourseDao:
    """课程数据访问对象"""

    @staticmethod
    def get_all_courses(level: Optional[str] = None, category: Optional[str] = None) -> List[Course]:
        """获取所有课程（支持过滤）"""
        with get_sync_db_session() as session:
            query = session.query(Course)

            if level:
                query = query.filter(Course.level == level)
            if category:
                query = query.filter(Course.category == category)

            return query.all()

    @staticmethod
    def get_course_by_id(course_id: int) -> Optional[Course]:
        """根据ID获取课程"""
        with get_sync_db_session() as session:
            return session.query(Course).filter(Course.id == course_id).first()

    @staticmethod
    def get_course_count() -> int:
        """获取课程总数"""
        with get_sync_db_session() as session:
            return session.query(Course).count()


# ==================== ChapterDao ====================

class ChapterDao:
    """章节数据访问对象"""

    @staticmethod
    def get_chapters_by_course_id(course_id: int) -> List[Chapter]:
        """获取课程的所有章节（按顺序排序）"""
        with get_sync_db_session() as session:
            return session.query(Chapter).filter(
                Chapter.course_id == course_id
            ).order_by(Chapter.order_index).all()

    @staticmethod
    def get_chapter_by_id(chapter_id: int) -> Optional[Chapter]:
        """根据ID获取章节"""
        with get_sync_db_session() as session:
            return session.query(Chapter).filter(Chapter.id == chapter_id).first()


# ==================== UserProgressDao ====================

class UserProgressDao:
    """用户学习进度数据访问对象"""

    @staticmethod
    def get_user_progress_by_course(user_id: int, course_id: int) -> List[UserProgress]:
        """获取用户在某课程的所有学习进度"""
        with get_sync_db_session() as session:
            return session.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.course_id == course_id
            ).all()

    @staticmethod
    def get_user_progress(user_id: int, chapter_id: int) -> Optional[UserProgress]:
        """获取用户在某章节的学习进度"""
        with get_sync_db_session() as session:
            return session.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.chapter_id == chapter_id
            ).first()

    @staticmethod
    def create_or_update_progress(
        user_id: int,
        course_id: int,
        chapter_id: int,
        **kwargs
    ) -> UserProgress:
        """创建或更新学习进度"""
        with get_sync_db_session() as session:
            progress = session.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.chapter_id == chapter_id
            ).first()

            if progress:
                # 更新现有记录
                for key, value in kwargs.items():
                    if hasattr(progress, key):
                        setattr(progress, key, value)
            else:
                # 创建新记录
                progress = UserProgress(
                    user_id=user_id,
                    course_id=course_id,
                    chapter_id=chapter_id,
                    **kwargs
                )
                session.add(progress)

            session.commit()
            session.refresh(progress)
            return progress

    @staticmethod
    def get_user_all_progress(user_id: int) -> List[UserProgress]:
        """获取用户的所有学习进度"""
        with get_sync_db_session() as session:
            return session.query(UserProgress).filter(
                UserProgress.user_id == user_id
            ).all()

    @staticmethod
    def get_completed_count_by_course(user_id: int, course_id: int) -> int:
        """获取用户在某课程已完成的章节数"""
        with get_sync_db_session() as session:
            return session.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.course_id == course_id,
                UserProgress.completed == True
            ).count()

    @staticmethod
    def get_user_count_by_course(course_id: int) -> int:
        """获取学习某课程的用户数"""
        with get_sync_db_session() as session:
            return session.query(UserProgress.user_id).filter(
                UserProgress.course_id == course_id
            ).distinct().count()


# ==================== GuidedProgressDao ====================

class GuidedProgressDao:
    """引导式学习进度数据访问对象"""

    @staticmethod
    def get_user_guided_progress(user_id: int) -> List[GuidedProgress]:
        """获取用户的所有引导式学习进度"""
        with get_sync_db_session() as session:
            return session.query(GuidedProgress).filter(
                GuidedProgress.user_id == user_id
            ).all()

    @staticmethod
    def save_progress(
        user_id: int,
        step_id: str,
        completed: bool,
        config_data: Optional[dict] = None
    ) -> GuidedProgress:
        """保存引导式学习进度"""
        with get_sync_db_session() as session:
            progress = session.query(GuidedProgress).filter(
                GuidedProgress.user_id == user_id,
                GuidedProgress.step_id == step_id
            ).first()

            if progress:
                # 更新现有记录
                progress.completed = completed
                if config_data is not None:
                    progress.config_data = config_data
            else:
                # 创建新记录
                progress = GuidedProgress(
                    user_id=user_id,
                    step_id=step_id,
                    completed=completed,
                    config_data=config_data
                )
                session.add(progress)

            session.commit()
            session.refresh(progress)
            return progress
