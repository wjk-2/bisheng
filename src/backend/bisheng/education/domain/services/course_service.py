"""
课程服务 - 处理课程列表和详情逻辑
"""
from typing import List, Optional
from loguru import logger
from sqlalchemy import func
from sqlmodel import select

from bisheng.core.database import get_sync_db_session
from bisheng.education.domain.models.education import (
    Course, Chapter, UserProgress,
    CourseDao, ChapterDao, UserProgressDao
)
from bisheng.education.domain.schemas.education_schema import (
    CourseListResponse, CourseDetailResponse, ChapterInfo
)


class CourseService:
    """课程服务"""

    @staticmethod
    def get_courses(
        level: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[CourseListResponse]:
        """
        获取课程列表，支持按难度和类别筛选

        Args:
            level: 课程难度 (beginner/intermediate/advanced)
            category: 课程类别

        Returns:
            课程列表，包含章节数和学习人数
        """
        try:
            with get_sync_db_session() as session:
                # 构建查询：课程 + 章节数统计
                query = session.query(
                    Course,
                    func.count(Chapter.id).label('chapters_count')
                ).outerjoin(
                    Chapter,
                    Chapter.course_id == Course.id
                )

                # 筛选条件
                if level:
                    query = query.filter(Course.level == level)
                if category:
                    query = query.filter(Course.category == category)

                query = query.group_by(Course.id)
                rows = query.all()

                course_list = []
                for course, chapters_count in rows:
                    # 获取学习人数
                    learning_users = UserProgressDao.get_user_count_by_course(course.id)

                    course_list.append(
                        CourseListResponse(
                            id=course.id,
                            title=course.title,
                            description=course.description or "",
                            level=course.level,
                            category=course.category or "",
                            duration=course.duration or 0,
                            thumbnail=course.thumbnail or "",
                            total_chapters=int(chapters_count or 0),
                            completed_chapters=0,  # 列表视图不需要用户维度数据
                            learning_users=learning_users
                        )
                    )

                return course_list

        except Exception as e:
            logger.error(f"获取课程列表失败: {str(e)}")
            raise

    @staticmethod
    def get_course_detail(
        course_id: int,
        user_id: Optional[int] = None
    ) -> Optional[CourseDetailResponse]:
        """
        获取课程详情，包含章节列表和用户进度

        Args:
            course_id: 课程ID
            user_id: 用户ID（可选，用于获取学习进度）

        Returns:
            课程详情，包含章节信息和进度
        """
        try:
            # 获取课程基础信息
            course = CourseDao.get_course_by_id(course_id)
            if not course:
                return None

            # 获取章节列表
            chapters = ChapterDao.get_chapters_by_course_id(course_id)

            # 获取用户进度（如果提供了 user_id）
            user_progress_map = {}
            completed_count = 0
            if user_id:
                user_progress_list = UserProgressDao.get_user_progress_by_course(user_id, course_id)
                user_progress_map = {progress.chapter_id: progress for progress in user_progress_list}
                completed_count = sum(1 for p in user_progress_list if p.completed)

            # 构建章节信息
            chapter_infos = []
            for chapter in chapters:
                progress_record = user_progress_map.get(chapter.id)
                chapter_infos.append(
                    ChapterInfo(
                        id=chapter.id,
                        title=chapter.title,
                        description=chapter.description or "",
                        video_url=chapter.video_url or "",
                        duration=chapter.duration or 0,
                        order_index=chapter.order_index,
                        progress=progress_record.progress if progress_record else 0.0,
                        completed=progress_record.completed if progress_record else False,
                        last_position=progress_record.last_position if progress_record else 0
                    )
                )

            # 获取学习人数
            learning_users = UserProgressDao.get_user_count_by_course(course_id)

            return CourseDetailResponse(
                id=course.id,
                title=course.title,
                description=course.description or "",
                level=course.level,
                category=course.category or "",
                duration=course.duration or 0,
                thumbnail=course.thumbnail or "",
                chapters=chapter_infos,
                total_chapters=len(chapters),
                completed_chapters=completed_count,
                learning_users=learning_users
            )

        except Exception as e:
            logger.error(f"获取课程详情失败 (course_id={course_id}): {str(e)}")
            raise
