from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ===== Path =====

class PathOut(BaseModel):
    id: int
    title: str
    type: str
    industry: Optional[str] = None
    description: Optional[str] = None
    cover: Optional[str] = None
    school_type: str
    order: int
    total_courses: int = 0


class PathListResp(BaseModel):
    paths: List[PathOut]


# ===== Course =====

class CourseOut(BaseModel):
    id: int
    path_id: Optional[int] = None
    title: str
    type: str
    stage: Optional[str] = None
    stage_order: int = 0
    description: Optional[str] = None
    cover: Optional[str] = None
    estimated_minutes: int = 0
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
    units: List[UnitDetailOut]


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
    name: str = Field(min_length=1, max_length=100)
    semester: str = Field(min_length=1, max_length=20)


class AddMemberReq(BaseModel):
    student_id: int = Field(gt=0)


# ===== Portfolio =====

class PortfolioOut(BaseModel):
    id: int
    unit_id: int
    class_id: Optional[int] = None
    asset_type: str
    title: str
    text_content: Optional[str] = None
    submit_time: Optional[datetime] = None


class SubmitPortfolioReq(BaseModel):
    unit_id: int = Field(gt=0)
    class_id: Optional[int] = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    text_content: str = Field(min_length=1)
