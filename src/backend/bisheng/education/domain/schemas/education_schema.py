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


# ===== Class =====

class ClassOut(BaseModel):
    id: int
    name: str
    semester: str
    teacher_id: int
    status: int
    member_count: int = 0
    create_time: Optional[datetime] = None


class ClassMemberOut(BaseModel):
    student_id: int
    username: str
    join_time: Optional[datetime] = None


class ClassDetailOut(BaseModel):
    class_info: ClassOut
    members: List[ClassMemberOut]


class CreateClassReq(BaseModel):
    name: str
    semester: str


class AddMemberReq(BaseModel):
    student_id: int


class RemoveMemberReq(BaseModel):
    student_id: int
