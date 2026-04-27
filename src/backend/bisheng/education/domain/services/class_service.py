from sqlmodel import Session
from bisheng.education.domain.models.education import (
    EduClassDao, EduClassMemberDao,
)
from bisheng.education.domain.schemas.education_schema import (
    ClassOut, ClassDetailOut, ClassMemberOut,
)
from bisheng.user.domain.models.user import UserDao


class ClassService:

    @staticmethod
    def create_class(session: Session, teacher_id: int, name: str, semester: str) -> ClassOut:
        cls = EduClassDao.create_class(session, name=name, semester=semester, teacher_id=teacher_id)
        return ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                        teacher_id=cls.teacher_id, status=cls.status,
                        member_count=0, create_time=cls.create_time)

    @staticmethod
    def list_classes(session: Session, teacher_id: int) -> list[ClassOut]:
        classes = EduClassDao.list_active_by_teacher(session, teacher_id)
        result = []
        for c in classes:
            members = EduClassMemberDao.list_members(session, c.id)
            result.append(ClassOut(id=c.id, name=c.name, semester=c.semester,
                                   teacher_id=c.teacher_id, status=c.status,
                                   member_count=len(members), create_time=c.create_time))
        return result

    @staticmethod
    def get_class_detail(session: Session, class_id: int) -> ClassDetailOut:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        members = EduClassMemberDao.list_members(session, class_id)
        member_ids = [m.student_id for m in members]
        users = UserDao.get_user_by_ids(member_ids) if member_ids else []
        user_map = {u.user_id: u.user_name for u in users}
        member_outs = [
            ClassMemberOut(student_id=m.student_id,
                           username=user_map.get(m.student_id, str(m.student_id)),
                           join_time=m.join_time)
            for m in members
        ]
        member_count = len(members)
        cls_out = ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                           teacher_id=cls.teacher_id, status=cls.status,
                           member_count=member_count, create_time=cls.create_time)
        return ClassDetailOut(class_info=cls_out, members=member_outs)

    @staticmethod
    def add_member(session: Session, class_id: int, student_id: int) -> None:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        EduClassMemberDao.add_member(session, class_id, student_id)

    @staticmethod
    def remove_member(session: Session, class_id: int, student_id: int) -> None:
        EduClassMemberDao.remove_member(session, class_id, student_id)

    @staticmethod
    def list_student_classes(session: Session, student_id: int) -> list[ClassOut]:
        memberships = EduClassMemberDao.list_classes_for_student(session, student_id)
        result = []
        for m in memberships:
            cls = EduClassDao.get_class(session, m.class_id)
            if cls and cls.status == 0:
                members = EduClassMemberDao.list_members(session, cls.id)
                result.append(ClassOut(id=cls.id, name=cls.name, semester=cls.semester,
                                       teacher_id=cls.teacher_id, status=cls.status,
                                       member_count=len(members), create_time=cls.create_time))
        return result
