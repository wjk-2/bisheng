from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Session, select
from sqlalchemy import Column, JSON
from bisheng.common.models.base import SQLModelSerializable


class EduPath(SQLModelSerializable, table=True):
    __tablename__ = 'edu_path'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=20)        # general / professional / project
    industry: Optional[str] = Field(default=None, max_length=50)  # logistics / ecommerce / ...
    description: Optional[str] = None
    cover: Optional[str] = Field(default=None, max_length=500)
    school_type: str = Field(default='vocational', max_length=20)  # vocational / undergraduate
    order: int = Field(default=0)
    status: int = Field(default=0)
    create_time: Optional[datetime] = Field(default=None)
    update_time: Optional[datetime] = Field(default=None)


class EduCourse(SQLModelSerializable, table=True):
    __tablename__ = 'edu_course'

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=255)
    type: str = Field(max_length=20)  # general / professional / project
    path_id: Optional[int] = Field(default=None, foreign_key='edu_path.id')
    stage: Optional[str] = Field(default=None, max_length=100)
    stage_order: int = Field(default=0)
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
    right_panel_config: Optional[dict] = Field(default=None, sa_column=Column(JSON))
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

class EduPathDao:
    @staticmethod
    def list_paths(session: Session, school_type: Optional[str] = None) -> List[EduPath]:
        stmt = select(EduPath).where(EduPath.status == 0).order_by(EduPath.order)
        if school_type:
            stmt = stmt.where(EduPath.school_type == school_type)
        return session.exec(stmt).all()

    @staticmethod
    def get_path(session: Session, path_id: int) -> Optional[EduPath]:
        return session.get(EduPath, path_id)


class EduCourseDao:
    @staticmethod
    def list_courses(session: Session, course_type: Optional[str] = None) -> List[EduCourse]:
        stmt = select(EduCourse).where(EduCourse.status == 0).order_by(EduCourse.id)
        if course_type:
            stmt = stmt.where(EduCourse.type == course_type)
        return session.exec(stmt).all()

    @staticmethod
    def list_courses_by_path(session: Session, path_id: int) -> List[EduCourse]:
        stmt = (
            select(EduCourse)
            .where(EduCourse.path_id == path_id, EduCourse.status == 0)
            .order_by(EduCourse.stage_order, EduCourse.id)
        )
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


class EduClassDao:
    @staticmethod
    def create_class(session: Session, name: str, semester: str, teacher_id: int) -> EduClass:
        obj = EduClass(name=name, semester=semester, teacher_id=teacher_id,
                       create_time=datetime.now(), update_time=datetime.now())
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def list_active_by_teacher(session: Session, teacher_id: int) -> List[EduClass]:
        stmt = select(EduClass).where(EduClass.teacher_id == teacher_id, EduClass.status == 0)
        return session.exec(stmt).all()

    @staticmethod
    def get_class(session: Session, class_id: int) -> Optional[EduClass]:
        return session.get(EduClass, class_id)

    @staticmethod
    def list_active_all(session: Session) -> List[EduClass]:
        stmt = select(EduClass).where(EduClass.status == 0)
        return session.exec(stmt).all()

    @staticmethod
    def list_by_ids(session: Session, class_ids: List[int]) -> List[EduClass]:
        if not class_ids:
            return []
        stmt = select(EduClass).where(EduClass.id.in_(class_ids), EduClass.status == 0)
        return session.exec(stmt).all()


class EduClassMemberDao:
    @staticmethod
    def add_member(session: Session, class_id: int, student_id: int) -> EduClassMember:
        existing = session.exec(
            select(EduClassMember).where(
                EduClassMember.class_id == class_id,
                EduClassMember.student_id == student_id,
            )
        ).first()
        if existing:
            existing.status = 0
            # join_time 保留首次加入时间，不随重新激活更新
            session.add(existing)
            session.commit()
            return existing
        obj = EduClassMember(class_id=class_id, student_id=student_id,
                             join_time=datetime.now())
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def remove_member(session: Session, class_id: int, student_id: int) -> bool:
        member = session.exec(
            select(EduClassMember).where(
                EduClassMember.class_id == class_id,
                EduClassMember.student_id == student_id,
                EduClassMember.status == 0,
            )
        ).first()
        if not member:
            return False
        member.status = 1
        session.add(member)
        session.commit()
        return True

    @staticmethod
    def list_members(session: Session, class_id: int) -> List[EduClassMember]:
        stmt = select(EduClassMember).where(
            EduClassMember.class_id == class_id,
            EduClassMember.status == 0,
        )
        return session.exec(stmt).all()

    @staticmethod
    def count_members_by_class_ids(session: Session, class_ids: List[int]) -> dict[int, int]:
        """返回 {class_id: member_count} 字典，仅统计 status==0 的成员"""
        if not class_ids:
            return {}
        stmt = select(EduClassMember).where(
            EduClassMember.class_id.in_(class_ids),
            EduClassMember.status == 0,
        )
        members = session.exec(stmt).all()
        counts: dict[int, int] = {}
        for m in members:
            counts[m.class_id] = counts.get(m.class_id, 0) + 1
        return counts

    @staticmethod
    def list_classes_for_student(session: Session, student_id: int) -> List[EduClassMember]:
        stmt = select(EduClassMember).where(
            EduClassMember.student_id == student_id,
            EduClassMember.status == 0,
        )
        return session.exec(stmt).all()


class EduPortfolioDao:
    @staticmethod
    def create(session: Session, student_id: int, unit_id: int, class_id: Optional[int],
               title: str, text_content: str) -> EduPortfolio:
        obj = EduPortfolio(
            student_id=student_id,
            unit_id=unit_id,
            class_id=class_id,
            asset_type='text',
            text_content=text_content,
            title=title,
            submit_time=datetime.now(),
        )
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return obj

    @staticmethod
    def list_by_student_unit(session: Session, student_id: int, unit_id: int) -> List[EduPortfolio]:
        stmt = select(EduPortfolio).where(
            EduPortfolio.student_id == student_id,
            EduPortfolio.unit_id == unit_id,
        ).order_by(EduPortfolio.submit_time.desc())
        return session.exec(stmt).all()
