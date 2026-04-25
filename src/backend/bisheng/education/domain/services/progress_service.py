"""
学习进度服务 - 处理用户学习进度统计
"""
from typing import Dict, Any, Optional
from loguru import logger
from fastapi import HTTPException

from bisheng.education.domain.models.education import (
    Chapter, CourseDao, ChapterDao, UserProgressDao
)


class ProgressService:
    """学习进度服务"""

    @staticmethod
    def get_user_progress(user_id: int) -> Dict[str, Any]:
        """
        获取用户综合学习统计

        包含：
        - 总课程数、已完成课程数
        - 总学习时长
        - 每门课程的进度详情

        Args:
            user_id: 用户ID

        Returns:
            用户学习统计数据
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 获取所有课程
            all_courses = CourseDao.get_all_courses()
            total_courses = len(all_courses)

            # 获取用户的所有进度记录
            user_progress_list = UserProgressDao.get_user_all_progress(user_id)

            # 统计完成的课程（一门课所有章节都完成才算完成）
            completed_courses_set = set()
            total_learning_time = 0
            course_progress_map = {}

            for progress in user_progress_list:
                total_learning_time += progress.learning_time

                # 按课程聚合数据
                if progress.course_id not in course_progress_map:
                    course_progress_map[progress.course_id] = {
                        'completed_chapters': 0,
                        'total_progress': 0.0,
                        'learning_time': 0
                    }

                course_data = course_progress_map[progress.course_id]
                course_data['total_progress'] += progress.progress
                course_data['learning_time'] += progress.learning_time

                if progress.completed:
                    course_data['completed_chapters'] += 1

            # 从数据库获取每门课的总章节数，判断课程是否完成
            for course_id, data in course_progress_map.items():
                chapters = ChapterDao.get_chapters_by_course_id(course_id)
                data['total_chapters'] = len(chapters)

                if data['completed_chapters'] == len(chapters) and len(chapters) > 0:
                    completed_courses_set.add(course_id)

            completed_courses = len(completed_courses_set)

            # 构建课程进度列表
            courses_progress = []
            course_title_map = {course.id: course.title for course in all_courses}

            for course_id, data in course_progress_map.items():
                total_ch = data['total_chapters']
                avg_progress = data['total_progress'] / total_ch if total_ch > 0 else 0
                courses_progress.append({
                    'course_id': course_id,
                    'course_title': course_title_map.get(course_id, "未知课程"),
                    'progress': round(avg_progress, 2),
                    'completed_chapters': data['completed_chapters'],
                    'total_chapters': total_ch,
                    'learning_time': data['learning_time']
                })

            return {
                'total_courses': total_courses,
                'completed_courses': completed_courses,
                'total_learning_time': total_learning_time,
                'courses_progress': courses_progress
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取用户学习进度失败 (user_id={user_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="获取学习进度失败")

    @staticmethod
    def mark_chapter_complete(chapter_id: int, user_id: int) -> Dict[str, Any]:
        """
        标记章节完成

        Args:
            chapter_id: 章节ID
            user_id: 用户ID

        Returns:
            操作结果，包含下一章节信息和课程进度
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 获取章节信息
            chapter = ChapterDao.get_chapter_by_id(chapter_id)
            if not chapter:
                raise HTTPException(status_code=404, detail="章节不存在")

            # 获取现有进度（保留已累计的学习时长）
            existing_progress = UserProgressDao.get_user_progress(user_id, chapter_id)
            chapter_duration = chapter.duration or 0
            learning_time = existing_progress.learning_time if existing_progress else chapter_duration

            # 标记为完成
            UserProgressDao.create_or_update_progress(
                user_id=user_id,
                course_id=chapter.course_id,
                chapter_id=chapter_id,
                progress=1.0,
                last_position=chapter_duration,
                completed=True,
                learning_time=learning_time
            )

            # 获取下一章节
            next_chapter = ProgressService._get_next_chapter(chapter)

            # 计算课程完成度
            course_progress = ProgressService._calculate_course_progress(user_id, chapter.course_id)

            return {
                'success': True,
                'chapter_completed': True,
                'next_chapter_id': next_chapter.id if next_chapter else None,
                'next_chapter_unlocked': next_chapter is not None,
                'course_progress': course_progress
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"标记章节完成失败 (chapter_id={chapter_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="标记章节完成失败")

    @staticmethod
    def _get_next_chapter(current_chapter: Chapter) -> Optional[Chapter]:
        """获取下一章节"""
        try:
            chapters = ChapterDao.get_chapters_by_course_id(current_chapter.course_id)
            sorted_chapters = sorted(chapters, key=lambda c: c.order_index)

            for i, chapter in enumerate(sorted_chapters):
                if chapter.id == current_chapter.id and i + 1 < len(sorted_chapters):
                    return sorted_chapters[i + 1]
            return None
        except Exception:
            return None

    @staticmethod
    def _calculate_course_progress(user_id: int, course_id: int) -> float:
        """计算课程完成百分比"""
        try:
            chapters = ChapterDao.get_chapters_by_course_id(course_id)
            if not chapters:
                return 0.0

            user_progress_list = UserProgressDao.get_user_progress_by_course(user_id, course_id)
            completed_count = sum(1 for p in user_progress_list if p.completed)

            return round(completed_count / len(chapters), 2)
        except Exception:
            return 0.0
