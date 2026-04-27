from sqlmodel import Session
from bisheng.education.domain.models.education import EduPortfolioDao, EduUnitDao
from bisheng.education.domain.schemas.education_schema import PortfolioOut, SubmitPortfolioReq


class PortfolioService:

    @staticmethod
    def submit(session: Session, student_id: int, req: SubmitPortfolioReq) -> PortfolioOut:
        if not EduUnitDao.get_unit(session, req.unit_id):
            raise ValueError(f"Unit {req.unit_id} not found")
        obj = EduPortfolioDao.create(
            session,
            student_id=student_id,
            unit_id=req.unit_id,
            class_id=req.class_id,
            title=req.title,
            text_content=req.text_content,
        )
        return PortfolioOut(
            id=obj.id,
            unit_id=obj.unit_id,
            class_id=obj.class_id,
            asset_type=obj.asset_type,
            title=obj.title,
            text_content=obj.text_content,
            submit_time=obj.submit_time,
        )

    @staticmethod
    def list_by_unit(session: Session, student_id: int, unit_id: int) -> list[PortfolioOut]:
        objs = EduPortfolioDao.list_by_student_unit(session, student_id, unit_id)
        return [
            PortfolioOut(
                id=o.id,
                unit_id=o.unit_id,
                class_id=o.class_id,
                asset_type=o.asset_type,
                title=o.title,
                text_content=o.text_content,
                submit_time=o.submit_time,
            )
            for o in objs
        ]
