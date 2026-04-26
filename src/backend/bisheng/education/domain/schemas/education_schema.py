from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ===== Course =====

class CourseOut(BaseModel):
    id: int
    title: str
    type: str
    description: Optional[str] = None
    cover: Optional[str] = None
    total_units: int = 0
    completed_units: int = 0


class CourseListResp(BaseModel):
    courses: List[CourseOut]


# ===== Unit =====

class UnitOut(BaseModel):
    id: int
    course_id: int
    title: str
    order: int
    estimated_minutes: int
    right_panel_type: str
    right_panel_config: Optional[dict] = None
    is_completed: bool = False


class UnitDetailOut(UnitOut):
    content: Optional[str] = None


class CourseDetailOut(BaseModel):
    course: CourseOut
    units: List[UnitOut]


# ===== Progress =====

class MarkCompleteReq(BaseModel):
    class_id: int


class MarkCompleteResp(BaseModel):
    unit_id: int
    class_id: int
    status: int
    complete_time: Optional[datetime] = None


# ===== UnitLearning =====

class UnitLearningOut(BaseModel):
    unit: UnitDetailOut
    prev_unit_id: Optional[int] = None
    next_unit_id: Optional[int] = None
