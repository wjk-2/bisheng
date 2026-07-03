"""TDD: E3 软删除/回收站（review 后降级：字段保留，event/do_orm_execute 不注册）。

验证：
1. knowledge / knowledge_file 模型有 is_deleted / deleted_at 字段（保留，待回收站启用）
2. soft_delete_filter 模块存在（do_orm_execute event 已实现，待回收站 API 启用时注册）
3. connection.py 未注册 event（回收站未闭环，注册会让软删记录成孤儿）
4. delete_knowledge 默认 purge=True 硬删（与修复前行为一致）
5. alembic 迁移存在（加列 + 索引，字段就位）
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


def test_soft_delete_filter_module_implemented():
    """soft_delete_filter 模块已实现 do_orm_execute event（待回收站启用时注册）"""
    src = _read("bisheng/core/database/soft_delete_filter.py")
    assert 'event.listens_for(Session, "do_orm_execute")' in src, \
        "soft_delete_filter 未实现 do_orm_execute event"
    assert "is_deleted.is_(False)" in src, "event 未注入 is_deleted=False 过滤"
    assert "include_deleted" in src, "缺 include_deleted 绕过选项（回收站/purge 用）"


def test_connection_does_not_register_event_yet():
    """connection.py 未注册 soft_delete event（回收站未闭环，注册会让软删记录成孤儿）"""
    src = _read("bisheng/core/database/connection.py")
    # import 应被注释（待回收站 API 启用）
    active_import = [l for l in src.splitlines()
                     if "import soft_delete_filter" in l and not l.strip().startswith("#")]
    assert not active_import, "connection.py 注册了 soft_delete event（回收站未闭环应停用）"


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


def test_delete_knowledge_defaults_to_purge():
    """delete_knowledge 默认 purge=True 硬删（回收站未启用，与修复前行为一致）"""
    src = _read("bisheng/knowledge/domain/models/knowledge.py")
    start = src.find("def delete_knowledge(")
    end = src.find("\n    @classmethod", start + 10)
    fn = src[start:end if end != -1 else len(src)]
    assert "purge: bool = True" in fn, "delete_knowledge 默认应为 purge=True（回收站未启用）"
    assert "is_deleted=True" in fn, "delete_knowledge 软删分支保留（待回收站启用）"

