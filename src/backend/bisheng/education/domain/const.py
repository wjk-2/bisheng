"""
教育模块常量定义
"""
from enum import Enum


class CourseLevel(str, Enum):
    """课程难度等级"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class CourseCategory(str, Enum):
    """课程类型"""
    THEORY = "theory"
    PRACTICE = "practice"
