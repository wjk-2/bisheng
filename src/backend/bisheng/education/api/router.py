from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from bisheng.core.database import get_sync_db_session
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.api.v1.schemas import resp_200
from bisheng.education.domain.services.course_service import CourseService
from bisheng.education.domain.services.class_service import ClassService
from bisheng.education.domain.services.path_service import PathService
from bisheng.education.domain.schemas.education_schema import (
    MarkCompleteReq, CourseListResp, PathListResp,
    CreateClassReq, AddMemberReq,
    SubmitPortfolioReq,
)
from bisheng.education.domain.services.portfolio_service import PortfolioService

router = APIRouter(prefix='/education', tags=['Education'])


@router.get('/paths')
def list_paths(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        paths = PathService.list_paths(session)
        return resp_200(data=PathListResp(paths=paths).model_dump())


@router.get('/courses')
def list_courses(
    course_type: Optional[str] = None,
    path_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        courses = CourseService.list_courses(session, login_user.user_id, course_type, path_id)
        return resp_200(data=CourseListResp(courses=courses).model_dump())


@router.get('/courses/{course_id}')
def get_course_detail(
    course_id: int,
    class_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            result = CourseService.get_course_detail(session, course_id, login_user.user_id, class_id)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.get('/units/{unit_id}')
def get_unit_learning(
    unit_id: int,
    class_id: Optional[int] = None,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            result = CourseService.get_unit_learning(session, unit_id, login_user.user_id, class_id)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post('/units/{unit_id}/complete')
def mark_unit_complete(
    unit_id: int,
    req: MarkCompleteReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = CourseService.mark_unit_complete(session, login_user.user_id, unit_id, req.class_id)
        return resp_200(data=result.model_dump())


# ===== 班级管理（教师端） =====

@router.post('/classes')
def create_class(
    req: CreateClassReq,
    login_user: UserPayload = Depends(UserPayload.get_teacher_user),
):
    with get_sync_db_session() as session:
        result = ClassService.create_class(session, login_user.user_id, req.name, req.semester)
        return resp_200(data=result.model_dump())


@router.get('/classes')
def list_classes(
    login_user: UserPayload = Depends(UserPayload.get_teacher_user),
):
    with get_sync_db_session() as session:
        result = ClassService.list_classes(session, login_user.user_id)
        return resp_200(data={'classes': [c.model_dump() for c in result]})


@router.get('/classes/{class_id}')
def get_class_detail(
    class_id: int,
    login_user: UserPayload = Depends(UserPayload.get_teacher_user),
):
    with get_sync_db_session() as session:
        try:
            result = ClassService.get_class_detail(session, class_id, login_user.user_id)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post('/classes/{class_id}/members')
def add_class_member(
    class_id: int,
    req: AddMemberReq,
    login_user: UserPayload = Depends(UserPayload.get_teacher_user),
):
    with get_sync_db_session() as session:
        try:
            ClassService.add_member(session, class_id, req.student_id, login_user.user_id)
            return resp_200(data={})
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.delete('/classes/{class_id}/members/{student_id}')
def remove_class_member(
    class_id: int,
    student_id: int,
    login_user: UserPayload = Depends(UserPayload.get_teacher_user),
):
    with get_sync_db_session() as session:
        try:
            ClassService.remove_member(session, class_id, student_id, login_user.user_id)
            return resp_200(data={})
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


# ===== 学生端 — 查看自己的班级 =====

@router.get('/my-classes')
def list_my_classes(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = ClassService.list_student_classes(session, login_user.user_id)
        return resp_200(data={'classes': [c.model_dump() for c in result]})


# ===== 作品集 =====

@router.post('/portfolio')
def submit_portfolio(
    req: SubmitPortfolioReq,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        try:
            result = PortfolioService.submit(session, login_user.user_id, req)
            return resp_200(data=result.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.get('/portfolio/units/{unit_id}')
def list_portfolio_by_unit(
    unit_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    with get_sync_db_session() as session:
        result = PortfolioService.list_by_unit(session, login_user.user_id, unit_id)
        return resp_200(data={'items': [r.model_dump() for r in result]})
