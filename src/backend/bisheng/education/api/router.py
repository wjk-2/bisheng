from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from bisheng.core.database import get_sync_db_session
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.education.domain.services.course_service import CourseService
from bisheng.education.domain.schemas.education_schema import (
    CourseListResp, CourseDetailOut, UnitLearningOut, MarkCompleteReq, MarkCompleteResp,
)

router = APIRouter(prefix='/education', tags=['Education'])


@router.get('/courses', response_model=CourseListResp)
def list_courses(
    course_type: Optional[str] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        courses = CourseService.list_courses(session, login_user.user_id, course_type)
        return CourseListResp(courses=courses)


@router.get('/courses/{course_id}', response_model=CourseDetailOut)
def get_course_detail(
    course_id: int,
    class_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            return CourseService.get_course_detail(session, course_id, login_user.user_id, class_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.get('/units/{unit_id}', response_model=UnitLearningOut)
def get_unit_learning(
    unit_id: int,
    class_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            return CourseService.get_unit_learning(session, unit_id, login_user.user_id, class_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post('/units/{unit_id}/complete', response_model=MarkCompleteResp)
def mark_unit_complete(
    unit_id: int,
    req: MarkCompleteReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        return CourseService.mark_unit_complete(session, login_user.user_id, unit_id, req.class_id)
