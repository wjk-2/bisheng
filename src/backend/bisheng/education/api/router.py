from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

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
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    courses = CourseService.list_courses(db, login_user.user_id, course_type)
    return CourseListResp(courses=courses)


@router.get('/courses/{course_id}', response_model=CourseDetailOut)
def get_course_detail(
    course_id: int,
    class_id: Optional[int] = None,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    try:
        return CourseService.get_course_detail(db, course_id, login_user.user_id, class_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get('/units/{unit_id}', response_model=UnitLearningOut)
def get_unit_learning(
    unit_id: int,
    class_id: Optional[int] = None,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    try:
        return CourseService.get_unit_learning(db, unit_id, login_user.user_id, class_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post('/units/{unit_id}/complete', response_model=MarkCompleteResp)
def mark_unit_complete(
    unit_id: int,
    req: MarkCompleteReq,
    db: Session = Depends(get_sync_db_session),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    return CourseService.mark_unit_complete(db, login_user.user_id, unit_id, req.class_id)
