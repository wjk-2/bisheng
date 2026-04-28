"""education v4 seed: insert 4 EduPath records

Revision ID: education_v4_seed_20260428
Revises: education_v4_path_20260428
Create Date: 2026-04-28
"""
from alembic import op
from sqlalchemy.sql import text

revision = 'education_v4_seed_20260428'
down_revision = 'education_v4_path_20260428'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("""
        INSERT INTO edu_path (title, type, industry, description, school_type, `order`, status, create_time, update_time)
        VALUES
        ('AI通识路径', 'general', NULL, '面向全体高职学生，零基础入门AI工具使用', 'vocational', 1, 0, NOW(), NOW()),
        ('AI专业核心路径', 'professional', NULL, '面向高职AI/计算机专业学生，掌握智能体开发全栈能力', 'vocational', 2, 0, NOW(), NOW()),
        ('项目实操路径·物流方向', 'project', 'logistics', '面向高职物流管理、供应链等专业学生', 'vocational', 3, 0, NOW(), NOW()),
        ('项目实操路径·电商方向', 'project', 'ecommerce', '面向高职电子商务、市场营销等专业学生', 'vocational', 4, 0, NOW(), NOW())
    """))


def downgrade():
    op.execute(text("DELETE FROM edu_path WHERE school_type = 'vocational'"))
