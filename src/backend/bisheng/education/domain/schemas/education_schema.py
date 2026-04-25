"""
教育模块 API Schema 定义
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ==================== Course 相关 Schema ====================

class CourseListResponse(BaseModel):
    """课程列表响应"""
    id: int
    title: str
    description: Optional[str] = None
    level: str
    category: Optional[str] = None
    duration: Optional[int] = None
    thumbnail: Optional[str] = None
    total_chapters: int = Field(default=0, description="章节总数")
    completed_chapters: int = Field(default=0, description="已完成章节数")
    learning_users: int = Field(default=0, description="学习人数")


class ChapterInfo(BaseModel):
    """章节信息"""
    id: int
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    duration: Optional[int] = None
    order_index: int
    progress: float = Field(default=0.0, description="学习进度 0-1")
    completed: bool = Field(default=False, description="是否完成")
    last_position: int = Field(default=0, description="上次观看位置(秒)")


class CourseDetailResponse(BaseModel):
    """课程详情响应"""
    id: int
    title: str
    description: Optional[str] = None
    level: str
    category: Optional[str] = None
    duration: Optional[int] = None
    thumbnail: Optional[str] = None
    chapters: List[ChapterInfo] = []
    total_chapters: int = Field(default=0, description="章节总数")
    completed_chapters: int = Field(default=0, description="已完成章节数")
    learning_users: int = Field(default=0, description="学习人数")


# ==================== Video 相关 Schema ====================

class VideoInfoResponse(BaseModel):
    """视频信息响应"""
    chapter_id: int
    title: str
    video_url: Optional[str] = None
    duration: Optional[int] = None
    progress: float = Field(default=0.0, description="学习进度 0-1")
    last_position: int = Field(default=0, description="上次观看位置(秒)")
    completed: bool = Field(default=False, description="是否完成")
    learning_time: int = Field(default=0, description="累计学习时间(秒)")


# ==================== Progress 相关 Schema ====================

class ProgressUpdateRequest(BaseModel):
    """进度更新请求"""
    chapter_id: int
    progress: float = Field(ge=0.0, le=1.0, description="进度 0-1")
    last_position: int = Field(ge=0, description="观看位置(秒)")
    completed: bool = Field(default=False, description="是否完成")
    learning_time: int = Field(default=0, ge=0, description="本次学习时长(秒)")


class UserProgressResponse(BaseModel):
    """用户学习进度响应"""
    course_id: int
    chapter_id: int
    progress: float
    last_position: int
    completed: bool
    learning_time: int
    update_time: datetime


# ==================== Guided 相关 Schema ====================

class GuidedStepInfo(BaseModel):
    """引导式学习步骤信息"""
    step_id: str
    completed: bool
    config_data: Optional[dict] = None


class GuidedProgressRequest(BaseModel):
    """引导式学习进度请求"""
    step_id: str
    completed: bool
    config_data: Optional[dict] = None


# ==================== Statistics 相关 Schema ====================

class LearningStatsResponse(BaseModel):
    """学习统计响应"""
    total_courses: int = Field(default=0, description="课程总数")
    enrolled_courses: int = Field(default=0, description="已报名课程数")
    completed_courses: int = Field(default=0, description="已完成课程数")
    total_learning_time: int = Field(default=0, description="总学习时长(秒)")
    completed_chapters: int = Field(default=0, description="已完成章节数")
