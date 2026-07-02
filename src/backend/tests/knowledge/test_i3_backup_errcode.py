"""TDD: I3 逻辑备份 + errcode 进日志。"""
import importlib.util
import os
from types import SimpleNamespace


def _load_backup():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "worker", "knowledge", "backup_worker.py")
    spec = importlib.util.spec_from_file_location("backup_worker", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _read(path):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, path), encoding="utf-8") as f:
        return f.read()


def test_backup_before_rebuild_no_minio_returns_none():
    """无 minio_client 时 backup placeholder 不阻断（返回 None）"""
    mod = _load_backup()
    kb = SimpleNamespace(id=1, collection_name="c", index_name="i")
    result = mod.backup_before_rebuild(kb, minio_client=None)
    assert result == {"milvus": None, "es": None}


def test_backup_failure_does_not_raise():
    """备份抛异常不阻断（rebuild 继续）"""
    mod = _load_backup()

    class BoomMinio:
        def put_object(self, *a, **k):
            raise RuntimeError("minio down")
    kb = SimpleNamespace(id=1, collection_name="c", index_name="i")
    # backup_before_rebuild 应吞异常返回 {"milvus": None, "es": None}
    result = mod.backup_before_rebuild(kb, minio_client=BoomMinio())
    # 不抛异常即通过（placeholder 路径返回 None）
    assert isinstance(result, dict)


def test_errcode_base_logs_warning():
    """errcode/base.py __init__ 记 warning（errcode 进日志）"""
    src = _read("bisheng/common/errcode/base.py")
    assert "import logging" in src
    assert "logger = logging.getLogger" in src
    assert "logger.warning" in src, "errcode __init__ 未记 warning（errcode 不进日志）"
    # warning 含 code/message
    assert "errcode=" in src and "msg=" in src


def test_rebuild_calls_backup_before_delete():
    """rebuild 删向量前调 backup_before_rebuild"""
    src = _read("bisheng/worker/knowledge/rebuild_knowledge_worker.py")
    # backup_before_rebuild 应在 delete_knowledge_file_in_vector 之前
    backup_idx = src.find("backup_before_rebuild")
    delete_idx = src.find("delete_knowledge_file_in_vector")
    assert backup_idx != -1, "rebuild 未调 backup_before_rebuild"
    assert delete_idx != -1
    assert backup_idx < delete_idx, "backup 应在 delete 之前（先备份再删）"
