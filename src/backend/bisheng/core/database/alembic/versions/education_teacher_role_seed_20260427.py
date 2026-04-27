"""seed: add teacher role (id=3)

Revision ID: education_teacher_role_seed_20260427
Revises: education_v3_seed_20260426
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'education_teacher_role_seed_20260427'
down_revision = 'education_v3_seed_20260426'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "INSERT IGNORE INTO role (id, role_name, group_id, remark) "
            "VALUES (3, '教师', NULL, '教育模块教师角色')"
        )
    )


def downgrade():
    op.execute(sa.text("DELETE FROM role WHERE id = 3"))
