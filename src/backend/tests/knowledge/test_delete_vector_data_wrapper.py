"""TDD: C3 收尾——delete_vector_data 转 thin wrapper（错配键 file_id → 正确键 document_id）。

背景：delete_vector_data 原用 `file_id in {file_ids}`（错配键，写入时 metadata.document_id = db_file.id，
无 file_id 字段，实际删不到）。C3 已建 VectorDeleteService.delete_by_file_ids（document_id 正确键），
delete_vector_files 已转 wrapper，但 delete_vector_data 仍是旧实现，5 处调用方仍用错配键。

正道：delete_vector_data 转 thin wrapper 调 VectorDeleteService.delete_by_file_ids + DeprecationWarning，
让错配键路径走正确键，逼调用方迁移。
"""
import os


def _read_knowledge_imp_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "api", "services", "knowledge_imp.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def _extract_fn(src: str, name: str) -> str:
    start = src.find(f"def {name}(")
    if start == -1:
        return ""
    next_def = src.find("\ndef ", start + 10)
    return src[start:next_def if next_def != -1 else len(src)]


def test_delete_vector_data_is_thin_wrapper_to_service():
    """delete_vector_data 应转 thin wrapper 调 VectorDeleteService（不再用错配键 file_id）"""
    fn = _extract_fn(_read_knowledge_imp_src(), "delete_vector_data")
    assert "VectorDeleteService.delete_by_file_ids" in fn, \
        "delete_vector_data 未转 thin wrapper 调 VectorDeleteService（仍用错配键 file_id）"
    assert "DeprecationWarning" in fn, "delete_vector_data 未加 DeprecationWarning"


def test_delete_vector_data_not_use_file_id_key():
    """delete_vector_data 不应再用 file_id in {...} 错配键"""
    fn = _extract_fn(_read_knowledge_imp_src(), "delete_vector_data")
    assert 'expr=f"file_id in' not in fn, "delete_vector_data 仍用 file_id in 错配键"
