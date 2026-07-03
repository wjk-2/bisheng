"""E2: add index on knowledge.update_time, knowledgefile.update_time, recallchunk.file_id

Revision ID: e2_add_indexes_20260702
Revises: e1_split_rule_json_20260702
Create Date: 2026-07-02

update_time 多处 order_by/where 使用但无索引（全表扫描排序）；
recallchunk.file_id 作关联/过滤键无索引。
"""
from alembic import op

revision = 'e2_add_indexes_20260702'
down_revision = 'e1_split_rule_json_20260702'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_knowledge_update_time', 'knowledge', ['update_time'])
    op.create_index('ix_knowledgefile_update_time', 'knowledgefile', ['update_time'])
    op.create_index('ix_recallchunk_file_id', 'recallchunk', ['file_id'])


def downgrade():
    op.drop_index('ix_recallchunk_file_id', table_name='recallchunk')
    op.drop_index('ix_knowledgefile_update_time', table_name='knowledgefile')
    op.drop_index('ix_knowledge_update_time', table_name='knowledge')
