"""
教育模块 API 路由
"""
from typing import List, Literal, Optional, Dict, Any
from loguru import logger
from fastapi import APIRouter, Depends, Query, Body, HTTPException

from bisheng.api.v1.schemas import resp_200
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.education.domain.services.course_service import CourseService
from bisheng.education.domain.services.video_service import VideoService
from bisheng.education.domain.services.progress_service import ProgressService
from bisheng.education.domain.services.stats_service import StatsService
from bisheng.education.domain.services.guided_builder_service import GuidedBuilderService
from bisheng.education.domain.schemas.education_schema import (
    CourseListResponse, CourseDetailResponse, VideoInfoResponse,
    GuidedProgressRequest
)

router = APIRouter(prefix="/education", tags=["Education"])


# ==================== 课程相关端点 ====================

@router.get("/courses", response_model=List[CourseListResponse])
def get_courses(
    level: Optional[Literal["beginner", "intermediate", "advanced"]] = Query(None, description="课程难度 (beginner/intermediate/advanced)"),
    category: Optional[Literal["theory", "practice"]] = Query(None, description="课程类别 (theory/practice)"),
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取课程列表

    支持按难度和类别筛选
    """
    try:
        return resp_200(data=CourseService.get_courses(level=level, category=category))
    except Exception as e:
        logger.error(f"获取课程列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取课程列表失败")


@router.get("/courses/{course_id}", response_model=CourseDetailResponse)
def get_course_detail(
    course_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取课程详情

    包含章节列表和用户学习进度
    """
    try:
        course_detail = CourseService.get_course_detail(
            course_id=course_id,
            user_id=login_user.user_id
        )
        if not course_detail:
            raise HTTPException(status_code=404, detail="课程不存在")
        return resp_200(data=course_detail)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取课程详情失败 (course_id={course_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="获取课程详情失败")


# ==================== 视频相关端点 ====================

@router.get("/videos/{chapter_id}", response_model=VideoInfoResponse)
def get_video_info(
    chapter_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取视频信息

    包含视频URL和上次观看位置
    """
    try:
        return resp_200(data=VideoService.get_video_info(
            chapter_id=chapter_id,
            user_id=login_user.user_id
        ))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取视频信息失败 (chapter_id={chapter_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="获取视频信息失败")


@router.post("/videos/{chapter_id}/progress")
def update_video_progress(
    chapter_id: int,
    position: int = Body(..., embed=True, description="当前观看位置（秒）"),
    completed: Optional[bool] = Body(None, embed=True, description="是否完成"),
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    更新视频观看进度

    自动逻辑：
    - 观看进度 >= 90% 自动标记为完成
    - 累计学习时长（仅统计向前播放）
    """
    try:
        success = VideoService.update_progress(
            chapter_id=chapter_id,
            user_id=login_user.user_id,
            position=position,
            completed=completed
        )
        if not success:
            raise HTTPException(status_code=500, detail="更新视频进度失败")
        return resp_200(data={'success': True, 'message': '视频进度更新成功'})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新视频进度失败 (chapter_id={chapter_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="更新视频进度失败")


# ==================== 学习进度相关端点 ====================

@router.get("/progress")
def get_user_progress(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取用户学习进度

    包含：
    - 总课程数、已完成课程数
    - 总学习时长
    - 每门课程的进度详情
    """
    try:
        return resp_200(data=ProgressService.get_user_progress(user_id=login_user.user_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取用户学习进度失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取学习进度失败")


@router.post("/progress/chapters/{chapter_id}/complete")
def mark_chapter_complete(
    chapter_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    标记章节完成

    返回下一章节信息和课程进度
    """
    try:
        return resp_200(data=ProgressService.mark_chapter_complete(
            chapter_id=chapter_id,
            user_id=login_user.user_id
        ))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"标记章节完成失败 (chapter_id={chapter_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="标记章节完成失败")


# ==================== 统计相关端点 ====================

@router.get("/stats/overview")
def get_learning_overview(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取平台学习统计概览

    包含：
    - 总课程数
    - 总学员数
    - 平均评分
    - 总课程时长
    """
    try:
        return resp_200(data=StatsService.get_learning_overview())
    except Exception as e:
        logger.error(f"获取平台统计概览失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取平台统计概览失败")


@router.get("/stats/user")
def get_user_learning_stats(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取用户学习统计

    包含：
    - 总学习时长
    - 已完成课程数
    - 已完成章节数
    """
    try:
        return resp_200(data=StatsService.get_user_learning_stats(user_id=login_user.user_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取用户学习统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取用户学习统计失败")


@router.get("/stats/courses/{course_id}")
def get_course_stats(
    course_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取课程统计

    包含：
    - 学习人数
    - 完成率
    - 平均评分
    """
    try:
        return resp_200(data=StatsService.get_course_stats(course_id=course_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取课程统计失败 (course_id={course_id}): {str(e)}")
        raise HTTPException(status_code=500, detail="获取课程统计失败")


# ==================== 引导式构建相关端点 ====================

@router.get("/guided-builder/steps")
def get_guided_steps(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取引导式构建步骤列表

    返回 11 个预定义的引导步骤
    """
    try:
        return resp_200(data=GuidedBuilderService.get_guided_steps())
    except Exception as e:
        logger.error(f"获取引导步骤失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取引导步骤失败")


@router.post("/guided-builder/progress")
def save_guided_progress(
    request: GuidedProgressRequest,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    保存引导式构建进度

    Args:
        step_id: 步骤ID
        completed: 是否完成
        config_data: 配置数据（可选）
    """
    try:
        success = GuidedBuilderService.save_progress(
            user_id=login_user.user_id,
            step_id=request.step_id,
            completed=request.completed,
            config_data=request.config_data
        )
        if not success:
            raise HTTPException(status_code=500, detail="保存引导进度失败")
        return resp_200(data={'success': True, 'message': '引导进度保存成功'})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存引导进度失败: {str(e)}")
        raise HTTPException(status_code=500, detail="保存引导进度失败")


@router.get("/guided-builder/progress/summary")
def get_guided_progress_summary(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """
    获取引导式构建进度摘要

    包含：
    - 总步骤数、已完成步骤数
    - 完成率
    - 当前步骤
    - 是否可生成智能体
    """
    try:
        return resp_200(data=GuidedBuilderService.get_user_progress_summary(user_id=login_user.user_id))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取引导进度摘要失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取引导进度摘要失败")
