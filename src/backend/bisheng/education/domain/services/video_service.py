"""
视频服务 - 处理视频信息和观看进度
"""
import os
from loguru import logger
from typing import Optional
from fastapi import HTTPException

from bisheng.education.domain.models.education import (
    ChapterDao, UserProgressDao
)
from bisheng.education.domain.schemas.education_schema import (
    VideoInfoResponse
)


class VideoService:
    """视频服务"""

    @staticmethod
    def get_video_info(chapter_id: int, user_id: int) -> VideoInfoResponse:
        """
        获取视频信息和用户上次观看位置

        Args:
            chapter_id: 章节ID
            user_id: 用户ID

        Returns:
            视频信息（包含观看进度）
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                logger.error(f"无效的 user_id: {user_id}")
                raise HTTPException(status_code=400, detail="无效的用户ID")

            # 获取章节信息
            chapter = ChapterDao.get_chapter_by_id(chapter_id)
            if not chapter:
                raise HTTPException(status_code=404, detail="章节不存在")

            # 获取用户进度
            progress = UserProgressDao.get_user_progress(user_id, chapter_id)

            # 处理视频 URL（如果是相对路径，添加 CDN 前缀）
            video_url = chapter.video_url or ""
            if video_url and not video_url.startswith(('http://', 'https://')):
                cdn_base_url = os.getenv('CDN_BASE_URL', 'https://cdn.example.com/education/')
                video_url = cdn_base_url.rstrip('/') + '/' + video_url.lstrip('/')

            return VideoInfoResponse(
                chapter_id=chapter.id,
                title=chapter.title,
                video_url=video_url,
                duration=chapter.duration or 0,
                progress=progress.progress if progress else 0.0,
                last_position=progress.last_position if progress else 0,
                completed=progress.completed if progress else False,
                learning_time=progress.learning_time if progress else 0
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取视频信息失败 (chapter_id={chapter_id}): {str(e)}")
            raise HTTPException(status_code=500, detail="获取视频信息失败")

    @staticmethod
    def update_progress(
        chapter_id: int,
        user_id: int,
        position: int,
        completed: Optional[bool] = None
    ) -> bool:
        """
        更新视频观看进度

        自动逻辑：
        - 观看进度 >= 90% 自动标记为完成
        - 累计学习时长（仅统计向前播放）

        Args:
            chapter_id: 章节ID
            user_id: 用户ID
            position: 当前观看位置（秒）
            completed: 是否完成（可选，如不提供则自动判断）

        Returns:
            是否更新成功
        """
        try:
            # 验证用户ID
            if not user_id or user_id <= 0:
                logger.error(f"无效的 user_id: {user_id}")
                return False

            # 验证观看位置
            if position < 0:
                logger.error(f"无效的 position: {position}")
                return False

            # 获取章节信息
            chapter = ChapterDao.get_chapter_by_id(chapter_id)
            if not chapter:
                logger.error(f"章节不存在: {chapter_id}")
                return False

            # 获取现有进度（用于计算增量学习时长）
            existing_progress = UserProgressDao.get_user_progress(user_id, chapter_id)
            previous_position = existing_progress.last_position if existing_progress else 0
            previous_learning_time = existing_progress.learning_time if existing_progress else 0

            # 计算进度百分比
            chapter_duration = chapter.duration or 0
            progress_percentage = 0.0
            if chapter_duration > 0:
                progress_percentage = min(position / chapter_duration, 1.0)

            # 自动判断是否完成（>=90% 视为完成）
            auto_completed = progress_percentage >= 0.9
            final_completed = completed if completed is not None else auto_completed

            # 计算增量学习时长（仅统计向前播放）
            additional_time = max(0, position - previous_position) if position > previous_position else 0
            total_learning_time = previous_learning_time + additional_time

            # 更新进度
            UserProgressDao.create_or_update_progress(
                user_id=user_id,
                course_id=chapter.course_id,
                chapter_id=chapter_id,
                progress=progress_percentage,
                last_position=position,
                completed=final_completed,
                learning_time=total_learning_time
            )

            logger.info(
                f"视频进度更新成功 - user_id={user_id}, chapter_id={chapter_id}, "
                f"progress={progress_percentage:.2f}, completed={final_completed}"
            )
            return True

        except Exception as e:
            logger.error(f"更新视频进度失败 (chapter_id={chapter_id}): {str(e)}")
            return False
