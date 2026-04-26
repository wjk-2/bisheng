from datetime import datetime
from typing import Optional, List
from sqlmodel import Session, select
from bisheng.education.domain.models.education import (
    EduCourse, EduUnit, EduUnitProgress,
    EduCourseDao, EduUnitDao, EduProgressDao,
)
from bisheng.education.domain.schemas.education_schema import (
    CourseOut, CourseDetailOut, UnitOut, UnitDetailOut, UnitLearningOut,
    MarkCompleteResp,
)


class CourseService:

    @staticmethod
    def list_courses(session: Session, student_id: int, course_type: Optional[str] = None) -> List[CourseOut]:
        courses = EduCourseDao.list_courses(session, course_type)
        result = []
        for c in courses:
            units = EduUnitDao.list_units_by_course(session, c.id)
            total = len(units)
            completed = 0
            if total > 0:
                unit_ids = {u.id for u in units}
                progresses = session.exec(
                    select(EduUnitProgress).where(
                        EduUnitProgress.student_id == student_id,
                        EduUnitProgress.unit_id.in_(unit_ids),
                        EduUnitProgress.status == 1,
                    )
                ).all()
                # 去重：同一 unit 在多个班级都完成，只算一次
                completed = len({p.unit_id for p in progresses})
            result.append(CourseOut(
                id=c.id,
                title=c.title,
                type=c.type,
                description=c.description,
                cover=c.cover,
                total_units=total,
                completed_units=completed,
            ))
        return result

    @staticmethod
    def get_course_detail(session: Session, course_id: int, student_id: int, class_id: Optional[int] = None) -> CourseDetailOut:
        course = EduCourseDao.get_course(session, course_id)
        if not course:
            raise ValueError(f"Course {course_id} not found")

        units = EduUnitDao.list_units_by_course(session, course_id)
        units_out = []
        for u in units:
            is_completed = False
            if class_id:
                progress = EduProgressDao.get_progress(session, student_id, u.id, class_id)
                is_completed = bool(progress and progress.status == 1)
            units_out.append(UnitOut(
                id=u.id,
                course_id=u.course_id,
                title=u.title,
                order=u.order,
                estimated_minutes=u.estimated_minutes,
                right_panel_type=u.right_panel_type,
                right_panel_config=u.right_panel_config,
                is_completed=is_completed,
            ))

        total_units = len(units_out)
        completed_units = sum(1 for u in units_out if u.is_completed)
        course_out = CourseOut(
            id=course.id,
            title=course.title,
            type=course.type,
            description=course.description,
            cover=course.cover,
            total_units=total_units,
            completed_units=completed_units,
        )
        return CourseDetailOut(course=course_out, units=units_out)

    @staticmethod
    def get_unit_learning(session: Session, unit_id: int, student_id: int, class_id: Optional[int] = None) -> UnitLearningOut:
        unit = EduUnitDao.get_unit(session, unit_id)
        if not unit:
            raise ValueError(f"Unit {unit_id} not found")

        siblings = EduUnitDao.list_units_by_course(session, unit.course_id)
        ordered_ids = [u.id for u in siblings]
        idx = ordered_ids.index(unit_id) if unit_id in ordered_ids else -1
        prev_id = ordered_ids[idx - 1] if idx > 0 else None
        next_id = ordered_ids[idx + 1] if idx < len(ordered_ids) - 1 else None

        is_completed = False
        if class_id:
            progress = EduProgressDao.get_progress(session, student_id, unit.id, class_id)
            is_completed = bool(progress and progress.status == 1)

        unit_detail = UnitDetailOut(
            id=unit.id,
            course_id=unit.course_id,
            title=unit.title,
            order=unit.order,
            estimated_minutes=unit.estimated_minutes,
            right_panel_type=unit.right_panel_type,
            right_panel_config=unit.right_panel_config,
            content=unit.content,
            is_completed=is_completed,
        )
        return UnitLearningOut(unit=unit_detail, prev_unit_id=prev_id, next_unit_id=next_id)

    @staticmethod
    def mark_unit_complete(session: Session, student_id: int, unit_id: int, class_id: int) -> MarkCompleteResp:
        progress = EduProgressDao.upsert_progress(session, student_id, unit_id, class_id, status=1)
        return MarkCompleteResp(
            unit_id=unit_id,
            class_id=class_id,
            status=progress.status,
            complete_time=progress.complete_time,
        )
