"""E2: add index on knowledge.update_time, knowledge_file.update_time, recall_chunk.file_id

Revision ID: e2_add_indexes_20260702
Revises: e1_split_rule_json_20260702
Create Date: 2026-07-02

update_time 多处 order_by/where 使用但无索引（全表扫描排序）；
recall_chunk.file_id 作关联/过滤键无索引。
"""
from alembic import op

revision = 'e2_add_indexes_20260702'
down_revision = 'e1_split_rule_json_20260702'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_knowledge_update_time', 'knowledge', ['update_time'])
    op.create_index('ix_knowledge_file_update_time', 'knowledge_file', ['update_time'])
    op.create_index('ix_recall_chunk_file_id', 'recall_chunk', ['file_id'])


def downgrade():
    op.drop_index('ix_recall_chunk_file_id', table_name='recall_chunk')
    op.drop_index('ix_knowledge_file_update_time', table_name='knowledge_file')
    op.drop_index('ix_knowledge_update_time', table_name='knowledge')
