"""TDD: E2 索引防回归（源码级断言模型 index=True + 迁移存在）"""
import os


def _read(rel):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, rel), encoding="utf-8") as f:
        return f.read()


def test_knowledge_update_time_indexed():
    src = _read("bisheng/knowledge/domain/models/knowledge.py")
    assert "update_time" in src and "index=True" in src


def test_knowledge_file_update_time_indexed():
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    assert src.count("update_time") >= 2
    assert "index=True" in src


def test_recall_chunk_file_id_indexed():
    src = _read("bisheng/database/models/recall_chunk.py")
    assert "file_id: Optional[int] = Field(default=None, index=True)" in src


def test_e2_migration_exists():
    src = _read("bisheng/core/database/alembic/versions/e2_add_indexes_20260702.py")
    assert "ix_knowledge_update_time" in src
    assert "ix_knowledge_file_update_time" in src
    assert "ix_recall_chunk_file_id" in src
