"""Insert initial education seed data

Revision ID: education_v2_seed_20260208
Revises: education_v1_20260208
Create Date: 2026-02-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Text, Integer

# revision identifiers, used by Alembic.
revision: str = 'education_v2_seed_20260208'
down_revision: Union[str, Sequence[str], None] = 'education_v1_20260208'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Insert initial education data: 3 courses + 13 chapters.

    幂等性保证：使用 INSERT IGNORE INTO，主键冲突时静默跳过，
    重复执行不报错、不修改已有数据。
    """

    # ==================== 3 门课程 ====================
    op.execute("""
        INSERT IGNORE INTO education_courses
            (id, title, description, level, category, duration, thumbnail)
        VALUES
            (1, '智能体基础入门', '学习智能体的基本概念、原理和应用场景，为后续深入学习打下基础',
             'beginner', 'theory', 120, 'https://cdn.example.com/education/thumbnails/course-001.jpg'),
            (2, '智能体进阶开发', '深入学习智能体的高级功能和开发技巧，包括复杂场景的处理方法',
             'intermediate', 'development', 180, 'https://cdn.example.com/education/thumbnails/course-002.jpg'),
            (3, '智能体实战应用', '通过实际项目案例学习智能体在不同行业的应用实践',
             'advanced', 'practice', 240, 'https://cdn.example.com/education/thumbnails/course-003.jpg')
    """)

    # ==================== 13 个章节 ====================
    op.execute("""
        INSERT IGNORE INTO education_chapters
            (id, course_id, title, description, video_url, duration, order_index)
        VALUES
            (1,  1, '第一章：智能体概述',   '介绍智能体的基本概念和发展历程',
             'https://cdn.example.com/education/videos/course-001/chapter-01.mp4', 1500, 1),
            (2,  1, '第二章：智能体架构',   '详细讲解智能体的系统架构和核心组件',
             'https://cdn.example.com/education/videos/course-001/chapter-02.mp4', 1800, 2),
            (3,  1, '第三章：智能体类型',   '介绍不同类型的智能体及其特点',
             'https://cdn.example.com/education/videos/course-001/chapter-03.mp4', 1200, 3),
            (4,  1, '第四章：智能体应用',   '展示智能体在各个领域的应用案例',
             'https://cdn.example.com/education/videos/course-001/chapter-04.mp4', 2100, 4),
            (5,  1, '第五章：智能体未来',   '探讨智能体技术的发展趋势和前景',
             'https://cdn.example.com/education/videos/course-001/chapter-05.mp4', 1500, 5),
            (6,  2, '第一章：高级配置',     '学习智能体的高级配置选项和优化技巧',
             'https://cdn.example.com/education/videos/course-002/chapter-01.mp4', 2400, 1),
            (7,  2, '第二章：模型集成',     '掌握多种AI模型的集成和调用方法',
             'https://cdn.example.com/education/videos/course-002/chapter-02.mp4', 2700, 2),
            (8,  2, '第三章：工具链开发',   '开发和集成外部工具链提升智能体能力',
             'https://cdn.example.com/education/videos/course-002/chapter-03.mp4', 3000, 3),
            (9,  2, '第四章：性能优化',     '优化智能体的响应速度和处理效率',
             'https://cdn.example.com/education/videos/course-002/chapter-04.mp4', 2100, 4),
            (10, 3, '第一章：客服机器人',   '构建智能客服系统的完整实战项目',
             'https://cdn.example.com/education/videos/course-003/chapter-01.mp4', 3600, 1),
            (11, 3, '第二章：内容生成助手', '开发自动化内容创作和编辑助手',
             'https://cdn.example.com/education/videos/course-003/chapter-02.mp4', 4200, 2),
            (12, 3, '第三章：数据分析智能体', '构建专业的数据分析和报告生成系统',
             'https://cdn.example.com/education/videos/course-003/chapter-03.mp4', 3900, 3),
            (13, 3, '第四章：多智能体协作', '实现多个智能体协同工作的复杂系统',
             'https://cdn.example.com/education/videos/course-003/chapter-04.mp4', 4500, 4)
    """)


def downgrade() -> None:
    """Remove initial education seed data.

    Alembic 在标准模式下将整个 migration 包裹在同一个数据库事务中，
    下面两条 DELETE 语句已具备原子性保证，无需额外显式开启事务。
    """
    op.execute("DELETE FROM education_chapters WHERE course_id IN (1, 2, 3)")
    op.execute("DELETE FROM education_courses WHERE id IN (1, 2, 3)")
