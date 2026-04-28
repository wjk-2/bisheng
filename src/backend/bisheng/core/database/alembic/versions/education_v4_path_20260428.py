"""education v4: add edu_path table, extend edu_course with path fields

Revision ID: education_v4_path_20260428
Revises: education_teacher_role_seed_20260427
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'education_v4_path_20260428'
down_revision = 'education_teacher_role_seed_20260427'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 创建 edu_path 表
    op.create_table(
        'edu_path',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('industry', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover', sa.String(500), nullable=True),
        sa.Column('school_type', sa.String(20), nullable=False, server_default='vocational'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.func.now(),
                  onupdate=sa.func.now()),
    )

    # 2. edu_course 新增字段（允许 NULL，不破坏存量数据）
    op.add_column('edu_course', sa.Column('path_id', sa.Integer(), sa.ForeignKey('edu_path.id'), nullable=True))
    op.add_column('edu_course', sa.Column('stage', sa.String(100), nullable=True))
    op.add_column('edu_course', sa.Column('stage_order', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('edu_course', 'stage_order')
    op.drop_column('edu_course', 'stage')
    op.drop_column('edu_course', 'path_id')
    op.drop_table('edu_path')
