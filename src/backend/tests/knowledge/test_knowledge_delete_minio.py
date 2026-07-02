"""TDD: D4 知识库级删除补 bbox+预览对象防回归。

背景：knowledge.py:347-364 delete_knowledge_file_in_minio 用 get_file_simple_by_knowledge_id
只取 (id, object_name)，只删源文件+转换 PDF，遗漏 bbox（partitions/{file_id}.json）与预览对象，
永久 bucket 无 lifecycle，产生孤儿泄漏。单文件级 delete_minio_files 才完整（4 类）。

正道：DAO 补 bbox_object_name+file_name 列，删除循环删 4 类（源文件/bbox/转换pdf/预览）。
"""
import os


def _read(rel):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, rel), encoding="utf-8") as f:
        return f.read()


def test_dao_returns_bbox_and_file_name():
    """get_file_simple_by_knowledge_id 返回含 bbox_object_name 与 file_name"""
    src = _read("bisheng/knowledge/domain/models/knowledge_file.py")
    start = src.find("def get_file_simple_by_knowledge_id(")
    end = src.find("\n    @classmethod", start + 5)
    fn = src[start:end] if start != -1 else src
    assert "bbox_object_name" in fn, "DAO 未返回 bbox_object_name（删除遗漏 bbox）"
    assert "file_name" in fn, "DAO 未返回 file_name（预览对象名需 file_name 计算）"


def test_delete_loop_cleans_four_object_types():
    """delete_knowledge_file_in_minio 删除循环删 4 类对象（含 bbox + 预览）"""
    src = _read("bisheng/api/services/knowledge.py")
    start = src.find("def delete_knowledge_file_in_minio(")
    end = src.find("\n    @classmethod", start + 5)
    fn = src[start:end] if start != -1 else src
    # 删 bbox 对象
    assert "bbox_object_name" in fn, "删除循环未删 bbox 对象"
    # 删预览对象（get_knowledge_preview_file_object_name 或 preview_object_name）
    assert "preview" in fn.lower() or "get_knowledge_preview_file_object_name" in fn, \
        "删除循环未删预览对象（孤儿泄漏）"
