from typing import List
from sqlmodel import Session, select
from bisheng.education.domain.models.education import (
    EduPathDao, EduCourseDao, EduUnitDao, EduUnitProgress,
)
from bisheng.education.domain.schemas.education_schema import (
    PathOut, PathStageGroup, PathDetailResp, CourseOut,
)


class PathService:

    @staticmethod
    def list_paths(session: Session) -> List[PathOut]:
        paths = EduPathDao.list_paths(session)
        result = []
        for p in paths:
            courses = EduCourseDao.list_courses_by_path(session, p.id)
            result.append(PathOut(
                id=p.id,
                title=p.title,
                type=p.type,
                industry=p.industry,
                description=p.description,
                cover=p.cover,
                school_type=p.school_type,
                order=p.order,
                total_courses=len(courses),
            ))
        return result

    @staticmethod
    def get_path(session: Session, path_id: int, student_id: int) -> PathDetailResp:
        p = EduPathDao.get_path(session, path_id)
        if not p:
            raise ValueError(f'path {path_id} not found')

        courses = EduCourseDao.list_courses_by_path(session, path_id)

        course_out_list = []
        for c in courses:
            units = EduUnitDao.list_units_by_course(session, c.id)
            total_units = len(units)
            completed_units = 0
            if total_units > 0:
                unit_ids = {u.id for u in units}
                progresses = session.exec(
                    select(EduUnitProgress).where(
                        EduUnitProgress.student_id == student_id,
                        EduUnitProgress.unit_id.in_(unit_ids),
                        EduUnitProgress.status == 1,
                    )
                ).all()
                completed_units = len({pr.unit_id for pr in progresses})
            estimated_minutes = sum(u.estimated_minutes for u in units)

            course_out_list.append(CourseOut(
                id=c.id,
                path_id=c.path_id,
                title=c.title,
                type=c.type,
                stage=c.stage,
                stage_order=c.stage_order,
                description=c.description,
                cover=c.cover,
                estimated_minutes=estimated_minutes,
                total_units=total_units,
                completed_units=completed_units,
            ))

        stage_map: dict = {}
        stage_order_map: dict = {}
        for co in course_out_list:
            stage_key = co.stage or '未分阶段'
            stage_map.setdefault(stage_key, []).append(co)
            if stage_key not in stage_order_map:
                stage_order_map[stage_key] = 99999 if co.stage is None else (co.stage_order or 0)

        stages_sorted = sorted(stage_map.keys(), key=lambda k: stage_order_map[k])
        stages: list = []
        for stage_key in stages_sorted:
            course_list = sorted(stage_map[stage_key], key=lambda x: x.stage_order or 0)
            stages.append(PathStageGroup(stage=stage_key, courses=course_list))

        path_out = PathOut(
            id=p.id,
            title=p.title,
            type=p.type,
            industry=p.industry,
            description=p.description,
            cover=p.cover,
            school_type=p.school_type,
            order=p.order,
            total_courses=len(courses),
        )
        return PathDetailResp(path=path_out, stages=stages)
