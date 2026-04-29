"""education v3 redesign: drop old 4 tables, create new 6 tables

Revision ID: education_v3_20260425
Revises: education_v2_seed_20260208
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = 'education_v3_20260425'
down_revision = 'education_v2_seed_20260208'
branch_labels = None
depends_on = None


def upgrade():
    # === 删除旧表（顺序：先子表后父表）===
    op.drop_table('edu_portfolio', if_exists=True)
    op.drop_table('edu_unit_progress', if_exists=True)
    op.drop_table('edu_class_member', if_exists=True)
    op.drop_table('edu_unit', if_exists=True)
    op.drop_table('edu_class', if_exists=True)
    op.drop_table('edu_course', if_exists=True)
    op.drop_table('education_guided_progress', if_exists=True)
    op.drop_table('education_user_progress', if_exists=True)
    op.drop_table('education_chapters', if_exists=True)
    op.drop_table('education_courses', if_exists=True)

    # === 创建新表 ===

    # 1. edu_course
    op.create_table(
        'edu_course',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover', sa.String(500), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 2. edu_unit
    op.create_table(
        'edu_unit',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('edu_course.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('right_panel_type', sa.String(30), nullable=False, server_default='dialog'),
        sa.Column('right_panel_config', mysql.JSON(), nullable=True),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 3. edu_class
    op.create_table(
        'edu_class',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('semester', sa.String(20), nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 4. edu_class_member
    op.create_table(
        'edu_class_member',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('join_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 5. edu_unit_progress
    op.create_table(
        'edu_unit_progress',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('edu_unit.id'), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('complete_time', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('student_id', 'unit_id', 'class_id', name='uq_progress_student_unit_class'),
    )

    # 6. edu_portfolio
    op.create_table(
        'edu_portfolio',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('edu_unit.id'), nullable=False),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('edu_class.id'), nullable=True),
        sa.Column('asset_type', sa.String(20), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('text_content', sa.Text(), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('submit_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('edu_portfolio')
    op.drop_table('edu_unit_progress')
    op.drop_table('edu_class_member')
    op.drop_table('edu_class')
    op.drop_table('edu_unit')
    op.drop_table('edu_course')
