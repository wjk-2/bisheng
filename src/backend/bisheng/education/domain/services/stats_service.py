"""
统计服务 - 处理平台和用户统计数据
"""
from typing import Dict, Any
from loguru import logger
from fastapi import HTTPException
from sqlalchemy import func

from bisheng.core.database import get_sync_db_session
from bisheng.education.domain.models.education import (
    CourseDao, ChapterDao, UserProgressDao, UserProgress
)


class StatsService:
    """统计服务"""

    @staticmethod
    def get_learning_overview() -> Dict[str, Any]:
        """
        获取平台学习统计概览

        Returns:
            平台统计数据（总课程数、总学员数等）
        """
        try:
            # 获取课程总数
            total_courses = CourseDao.get_course_count()

            # 获取总学员数（有学习记录的唯一用户数）
            with get_sync_db_session() as session:
                total_students = session.query(
                    func.count(func.distinct(UserProgress.user_id))
                ).scalar() or 0

            # 计算总课程时长
            all_courses = CourseDao.get_all_courses()
            total_duration = sum(course.duration or 0 for course in all_courses)

            # 平均评分（暂时硬编码，未来可接入评价系统）
            average_rating = 4.8

            return {
                'total_courses': total_courses,
                'total_students': total_students,
                'average_rating': average_rating,
                'total_duration': total_duration
            }

        except Exception as e:
            logger.error(f"获取平台统计概览失败: {str(e)}")
            # 返回默认值，避免前端崩溃
            return {
                'total_courses': 0,
                'total_students': 0,
                'average_rating': 4.8,
                'total_duration': 0
            }

    @staticmethod
    def get_user_learning_stats(user_id: int) -> Dict[str, Any]:
        """
        获取用户学习统计

        Args:
            user_id: 用户ID

        Returns:
            用户统计数据
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 获取用户所有进度
            user_progress_list = UserProgressDao.get_user_all_progress(user_id)

            # 计算总学习时长
            total_learning_time = sum(p.learning_time for p in user_progress_list)

            # 计算完成的课程数（每门课所有章节都完成才算）
            course_completion = {}
            for progress in user_progress_list:
                if progress.course_id not in course_completion:
                    course_completion[progress.course_id] = {
                        'completed': 0
                    }
                if progress.completed:
                    course_completion[progress.course_id]['completed'] += 1

            completed_courses = 0
            for course_id, data in course_completion.items():
                chapters = ChapterDao.get_chapters_by_course_id(course_id)
                if data['completed'] >= len(chapters) and len(chapters) > 0:
                    completed_courses += 1

            # 计算已完成章节总数
            completed_chapters = sum(1 for p in user_progress_list if p.completed)

            return {
                'user_id': user_id,
                'total_learning_time': total_learning_time,
                'completed_courses': completed_courses,
                'completed_chapters': completed_chapters,
                'current_streak': 0,  # TODO: 未来实现连续学习天数
                'total_achievements': 0  # TODO: 未来实现成就系统
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取用户统计失败 (user_id={user_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="获取用户统计失败")

    @staticmethod
    def get_course_stats(course_id: int) -> Dict[str, Any]:
        """
        获取课程统计

        Args:
            course_id: 课程ID

        Returns:
            课程统计数据
        """
        try:
            # 验证课程是否存在
            course = CourseDao.get_course_by_id(course_id)
            if not course:
                raise HTTPException(status_code=404, detail="课程不存在")

            # 获取学习该课程的用户数
            total_students = UserProgressDao.get_user_count_by_course(course_id)

            # 获取课程的所有进度记录
            with get_sync_db_session() as session:
                course_progress_list = session.query(UserProgress).filter(
                    UserProgress.course_id == course_id
                ).all()

            # 计算完成率（完成所有章节的用户数 / 总用户数）
            chapters = ChapterDao.get_chapters_by_course_id(course_id)
            total_chapters = len(chapters)

            user_completion = {}
            for progress in course_progress_list:
                if progress.user_id not in user_completion:
                    user_completion[progress.user_id] = 0
                if progress.completed:
                    user_completion[progress.user_id] += 1

            completed_students = sum(
                1 for count in user_completion.values()
                if count == total_chapters and total_chapters > 0
            )

            completion_rate = completed_students / total_students if total_students > 0 else 0.0

            return {
                'course_id': course_id,
                'total_students': total_students,
                'completion_rate': round(completion_rate, 2),
                'average_rating': 4.8,  # TODO: 未来接入评价系统
                'average_completion_time': 120  # TODO: 未来计算实际平均完成时间（分钟）
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取课程统计失败 (course_id={course_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="获取课程统计失败")
