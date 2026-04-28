from typing import List
from sqlmodel import Session
from bisheng.education.domain.models.education import EduPathDao, EduCourseDao
from bisheng.education.domain.schemas.education_schema import PathOut


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
