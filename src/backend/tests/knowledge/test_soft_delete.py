"""TDD: E3 软删除/回收站。

验证：
1. knowledge / knowledge_file 模型有 is_deleted / deleted_at 字段
2. do_orm_execute event 注册（全局过滤 is_deleted=False）
3. alembic 迁移存在（加列 + 索引）

本机无 langchain 等重依赖，用源码级断言。
"""
import os


def _read(path):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    full = os.path.join(base, path)
    with open(full, encoding="utf-8") as f:
        return f.read()


def test_knowledge_model_has_soft_delete_fields():
    src = _read("bisheng/knowledge/domain/models/knowledge.py")
    assert "is_deleted" in src, "Knowledge 模型缺 is_deleted 字段"
    assert "deleted_at" in src, "Knowledge 模型缺 deleted_at 字段"


def test_knowledge_file_model_has_soft_delete_fields():
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    assert "is_deleted" in src, "KnowledgeFile 模型缺 is_deleted 字段"
    assert "deleted_at" in src, "KnowledgeFile 模型缺 deleted_at 字段"


def test_do_orm_execute_event_registered():
    """soft_delete_filter 注册 do_orm_execute event 全局过滤"""
    src = _read("bisheng/core/database/soft_delete_filter.py")
    assert 'event.listens_for(Session, "do_orm_execute")' in src, \
        "未注册 do_orm_execute event"
    assert "is_deleted.is_(False)" in src, "event 未注入 is_deleted=False 过滤"
    assert "include_deleted" in src, "缺 include_deleted 绕过选项（回收站/purge 用）"


def test_connection_imports_soft_delete_filter():
    """connection.py import soft_delete_filter 触发 event 注册"""
    src = _read("bisheng/core/database/connection.py")
    assert "soft_delete_filter" in src, "connection.py 未 import soft_delete_filter（event 不注册）"


def test_alembic_migration_exists():
    """E3 alembic 迁移文件存在（加 is_deleted/deleted_at 列 + 索引）"""
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    versions_dir = os.path.join(base, "bisheng", "core", "database", "alembic", "versions")
    files = os.listdir(versions_dir)
    e3_files = [f for f in files if "e3" in f.lower() and "soft" in f.lower()]
    assert e3_files, "E3 软删除 alembic 迁移文件不存在"
    mig_src = _read(f"bisheng/core/database/alembic/versions/{e3_files[0]}")
    assert "is_deleted" in mig_src
    assert "deleted_at" in mig_src
    assert "down_revision = 'e2_add_indexes_20260702'" in mig_src, "E3 迁移 down_revision 应为 e2"


def test_delete_knowledge_is_soft_delete_by_default():
    """delete_knowledge 默认软删（is_deleted=True），purge=True 才硬删"""
    src = _read("bisheng/knowledge/domain/models/knowledge.py")
    start = src.find("def delete_knowledge(")
    end = src.find("\n    @classmethod", start + 10)
    fn = src[start:end if end != -1 else len(src)]
    assert "purge" in fn, "delete_knowledge 缺 purge 参数（硬删选项）"
    assert "is_deleted=True" in fn, "delete_knowledge 未实现软删（is_deleted=True）"
    # 默认分支应 update 软删，非默认 purge 才 delete
    assert "update(Knowledge" in fn, "delete_knowledge 默认应用 update 软删"

