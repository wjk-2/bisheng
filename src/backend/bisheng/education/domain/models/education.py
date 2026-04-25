from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Session, select
from bisheng.common.models.base import SQLModelSerializable


class EduCourse(SQLModelSerializable, table=True):
    __tablename__ = 'edu_course'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=20)  # general / professional / project
    description: Optional[str] = None
    cover: Optional[str] = Field(default=None, max_length=500)
    status: int = Field(default=0)  # 0=启用 1=禁用
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduUnit(SQLModelSerializable, table=True):
    __tablename__ = 'edu_unit'

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key='edu_course.id')
    title: str = Field(max_length=255)
    order: int = Field(default=0)
    content: Optional[str] = None
    right_panel_type: str = Field(default='dialog', max_length=30)
    right_panel_config: Optional[dict] = Field(default=None, sa_type='JSON')
    estimated_minutes: int = Field(default=60)
    status: int = Field(default=0)
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduClass(SQLModelSerializable, table=True):
    __tablename__ = 'edu_class'

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=255)
    semester: str = Field(max_length=20)
    teacher_id: int
    status: int = Field(default=0)  # 0=进行中 1=已结束
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduClassMember(SQLModelSerializable, table=True):
    __tablename__ = 'edu_class_member'

    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key='edu_class.id')
    student_id: int
    status: int = Field(default=0)  # 0=正常 1=已移除
    join_time: Optional[datetime] = Field(default=None)


class EduUnitProgress(SQLModelSerializable, table=True):
    __tablename__ = 'edu_unit_progress'

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int
    class_id: int = Field(foreign_key='edu_class.id')
    unit_id: int = Field(foreign_key='edu_unit.id')
    status: int = Field(default=0)  # 0=未完成 1=已完成
    complete_time: Optional[datetime] = Field(default=None)


class EduPortfolio(SQLModelSerializable, table=True):
    __tablename__ = 'edu_portfolio'

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int
    unit_id: int = Field(foreign_key='edu_unit.id')
    class_id: Optional[int] = Field(default=None, foreign_key='edu_class.id')
    asset_type: str = Field(max_length=20)  # agent / knowledge / workflow / text
    asset_id: Optional[int] = None
    text_content: Optional[str] = None
    title: str = Field(max_length=255)
    description: Optional[str] = None
    submit_time: Optional[datetime] = Field(default=None)


# DAO 层

class EduCourseDao:
    @staticmethod
    def list_courses(session: Session, course_type: Optional[str] = None) -> List[EduCourse]:
        stmt = select(EduCourse).where(EduCourse.status == 0)
        if course_type:
            stmt = stmt.where(EduCourse.type == course_type)
        return session.exec(stmt).all()

    @staticmethod
    def get_course(session: Session, course_id: int) -> Optional[EduCourse]:
        return session.get(EduCourse, course_id)


class EduUnitDao:
    @staticmethod
    def list_units_by_course(session: Session, course_id: int) -> List[EduUnit]:
        stmt = (
            select(EduUnit)
            .where(EduUnit.course_id == course_id, EduUnit.status == 0)
            .order_by(EduUnit.order)
        )
        return session.exec(stmt).all()

    @staticmethod
    def get_unit(session: Session, unit_id: int) -> Optional[EduUnit]:
        return session.get(EduUnit, unit_id)


class EduProgressDao:
    @staticmethod
    def get_progress(session: Session, student_id: int, unit_id: int, class_id: int) -> Optional[EduUnitProgress]:
        stmt = select(EduUnitProgress).where(
            EduUnitProgress.student_id == student_id,
            EduUnitProgress.unit_id == unit_id,
            EduUnitProgress.class_id == class_id,
        )
        return session.exec(stmt).first()

    @staticmethod
    def list_progress_by_student_class(session: Session, student_id: int, class_id: int) -> List[EduUnitProgress]:
        stmt = select(EduUnitProgress).where(
            EduUnitProgress.student_id == student_id,
            EduUnitProgress.class_id == class_id,
        )
        return session.exec(stmt).all()

    @staticmethod
    def upsert_progress(session: Session, student_id: int, unit_id: int, class_id: int, status: int) -> EduUnitProgress:
        existing = EduProgressDao.get_progress(session, student_id, unit_id, class_id)
        if existing:
            existing.status = status
            if status == 1:
                existing.complete_time = datetime.now()
            session.add(existing)
            session.commit()
            return existing
        else:
            progress = EduUnitProgress(
                student_id=student_id,
                unit_id=unit_id,
                class_id=class_id,
                status=status,
                complete_time=datetime.now() if status == 1 else None,
            )
            session.add(progress)
            session.commit()
            return progress
