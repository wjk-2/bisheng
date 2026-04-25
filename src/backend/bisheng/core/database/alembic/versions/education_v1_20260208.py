"""Add education module tables

Revision ID: education_v1_20260208
Revises: 9ba42685e830
Create Date: 2026-02-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'education_v1_20260208'
down_revision: Union[str, Sequence[str], None] = '9ba42685e830'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create education module tables."""

    # 1. education_courses
    op.create_table(
        'education_courses',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('level', sa.String(20), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('thumbnail', sa.String(500), nullable=True),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_edu_course_level', 'education_courses', ['level'])
    op.create_index('idx_edu_course_category', 'education_courses', ['category'])

    # 2. education_chapters
    op.create_table(
        'education_chapters',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('education_courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('video_url', sa.String(500), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_edu_chapter_course', 'education_chapters', ['course_id', 'order_index'])

    # 3. education_user_progress
    op.create_table(
        'education_user_progress',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('education_courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chapter_id', sa.Integer(), sa.ForeignKey('education_chapters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('progress', sa.Float(), nullable=False, server_default='0'),
        sa.Column('last_position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('learning_time', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('user_id', 'chapter_id', name='uk_user_chapter'),
    )
    op.create_index('idx_edu_progress_user_course', 'education_user_progress', ['user_id', 'course_id'])

    # 4. education_guided_progress
    op.create_table(
        'education_guided_progress',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('step_id', sa.String(50), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('config_data', sa.JSON(), nullable=True),
        sa.Column('create_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('update_time', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('user_id', 'step_id', name='uk_user_step'),
    )


def downgrade() -> None:
    """Drop education module tables."""
    op.drop_table('education_guided_progress')
    op.drop_table('education_user_progress')
    op.drop_table('education_chapters')
    op.drop_table('education_courses')
