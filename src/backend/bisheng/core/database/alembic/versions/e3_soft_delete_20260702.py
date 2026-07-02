"""E3: soft delete columns on knowledge / knowledge_file

Revision ID: e3_soft_delete_20260702
Revises: e2_add_indexes_20260702
Create Date: 2026-07-02

为 knowledge / knowledge_file 加软删除字段 is_deleted / deleted_at。
删除改软删（is_deleted=True），查询层 do_orm_execute event 全局过滤 is_deleted=False，
误删可从回收站恢复。purge 硬删保留为可选。
"""
from alembic import op
import sqlalchemy as sa

revision = 'e3_soft_delete_20260702'
down_revision = 'e2_add_indexes_20260702'
branch_labels = None
depends_on = None


def upgrade():
    # knowledge: is_deleted (默认 0，加索引便于回收站查询) + deleted_at
    op.add_column(
        'knowledge',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column('knowledge', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index('ix_knowledge_is_deleted', 'knowledge', ['is_deleted'])

    # knowledge_file: is_deleted + deleted_at
    op.add_column(
        'knowledge_file',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column('knowledge_file', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index('ix_knowledge_file_is_deleted', 'knowledge_file', ['is_deleted'])


def downgrade():
    op.drop_index('ix_knowledge_file_is_deleted', table_name='knowledge_file')
    op.drop_column('knowledge_file', 'deleted_at')
    op.drop_column('knowledge_file', 'is_deleted')
    op.drop_index('ix_knowledge_is_deleted', table_name='knowledge')
    op.drop_column('knowledge', 'deleted_at')
    op.drop_column('knowledge', 'is_deleted')
