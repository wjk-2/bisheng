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
        if not classes:
            return []
        class_ids = [c.id for c in classes]
        member_counts = EduClassMemberDao.count_members_by_class_ids(session, class_ids)
        return [
            ClassOut(id=c.id, name=c.name, semester=c.semester,
                     teacher_id=c.teacher_id, status=c.status,
                     member_count=member_counts.get(c.id, 0), create_time=c.create_time)
            for c in classes
        ]

    @staticmethod
    def get_class_detail(session: Session, class_id: int, teacher_id: int) -> ClassDetailOut:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        if cls.teacher_id != teacher_id:
            raise ValueError("Not your class")
        members = EduClassMemberDao.list_members(session, class_id)
        member_ids = [m.student_id for m in members]
        # UserDao.get_user_by_ids 内部自建 session，与当前 session 不在同一事务
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
    def add_member(session: Session, class_id: int, student_id: int, teacher_id: int) -> None:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        if cls.teacher_id != teacher_id:
            raise ValueError("Not your class")
        EduClassMemberDao.add_member(session, class_id, student_id)

    @staticmethod
    def remove_member(session: Session, class_id: int, student_id: int, teacher_id: int) -> None:
        cls = EduClassDao.get_class(session, class_id)
        if not cls:
            raise ValueError(f"Class {class_id} not found")
        if cls.teacher_id != teacher_id:
            raise ValueError("Not your class")
        EduClassMemberDao.remove_member(session, class_id, student_id)

    @staticmethod
    def list_student_classes(session: Session, student_id: int) -> list[ClassOut]:
        memberships = EduClassMemberDao.list_classes_for_student(session, student_id)
        if not memberships:
            return []
        class_ids = [m.class_id for m in memberships]
        classes = EduClassDao.list_by_ids(session, class_ids)
        member_counts = EduClassMemberDao.count_members_by_class_ids(session, class_ids)
        return [
            ClassOut(id=c.id, name=c.name, semester=c.semester,
                     teacher_id=c.teacher_id, status=c.status,
                     member_count=member_counts.get(c.id, 0), create_time=c.create_time)
            for c in classes
        ]
