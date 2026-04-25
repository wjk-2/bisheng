"""
教育模块服务层
"""
from bisheng.education.domain.services.course_service import CourseService
from bisheng.education.domain.services.video_service import VideoService
from bisheng.education.domain.services.progress_service import ProgressService
from bisheng.education.domain.services.stats_service import StatsService
from bisheng.education.domain.services.guided_builder_service import GuidedBuilderService

__all__ = [
    'CourseService',
    'VideoService',
    'ProgressService',
    'StatsService',
    'GuidedBuilderService',
]
