"""E1: split_rule Text -> JSON column

Revision ID: e1_split_rule_json_20260702
Revises: education_v5_courses_seed_20260428
Create Date: 2026-07-02

将 knowledgefile.split_rule 从 Text 改为 JSON 列，并对存量数据做清洗：
- 历史数据为 JSON 字符串（Text 列存），MySQL ALTER ... MODIFY 会自动尝试转换；
- 若存在非法 JSON 字符串（JSON_VALID=False），先清洗为 NULL 或 '{}' 避免迁移失败。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = 'e1_split_rule_json_20260702'
down_revision = 'education_v5_courses_seed_20260428'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 清洗非法 JSON 字符串（NULL 或非 JSON 文本）为 NULL，避免 MODIFY 失败
    op.execute(
        "UPDATE knowledgefile SET split_rule = NULL "
        "WHERE split_rule IS NOT NULL AND NOT JSON_VALID(split_rule)"
    )
    # 2. Text -> JSON：MySQL 会将合法 JSON 字符串转为 JSON 值
    op.alter_column(
        'knowledgefile', 'split_rule',
        existing_type=sa.Text(),
        type_=mysql.JSON(),
        existing_nullable=True,
        postgresql_using='split_rule::json',
    )


def downgrade():
    # JSON -> Text：MySQL 会将 JSON 值序列化为字符串
    op.alter_column(
        'knowledgefile', 'split_rule',
        existing_type=mysql.JSON(),
        type_=sa.Text(),
        existing_nullable=True,
    )
