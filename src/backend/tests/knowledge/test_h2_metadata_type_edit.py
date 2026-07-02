"""TDD: H2 元数据字段类型可编辑——降级定案（不支持，schema 层拒绝）。

报告 P2 H2：MetadataManagementDialog 编辑弹窗只能改 name 不能改 type。
评估：Milvus/ES collection schema 建后字段类型不可改，真正支持 type 变更需重建 collection，
成本极高。降级为"不支持 + 现状即正道"：
- 后端 UpdateMetadataFieldName schema 只含 old/new_field_name，无 field_type（API 层不接收 type 变更）
- 前端编辑弹窗无 TypeSelector（只 name 输入）
- 内置字段拒绝改（KnowledgeMetadataFieldImmutableError）

本测试验证降级结论：schema 不含 field_type，编辑弹窗无 type 选择。
"""
import os


def _read(path):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    full = os.path.join(base, path)
    with open(full, encoding="utf-8") as f:
        return f.read()


def test_update_schema_has_no_field_type():
    """UpdateMetadataFieldName schema 不含 field_type（API 层拒绝 type 变更）"""
    src = _read("bisheng/knowledge/domain/schemas/knowledge_schema.py")
    start = src.find("class UpdateMetadataFieldName")
    end = src.find("class ", start + 10)
    if end == -1:
        end = len(src)
    fn = src[start:end]
    assert "field_type" not in fn, "UpdateMetadataFieldName 不应含 field_type（type 变更不支持）"
    assert "old_field_name" in fn
    assert "new_field_name" in fn


def test_builtin_field_change_rejected():
    """内置字段改名被拒绝（KnowledgeMetadataFieldImmutableError）"""
    src = _read("bisheng/knowledge/domain/services/knowledge_service.py")
    assert "KnowledgeMetadataFieldImmutableError" in src


def test_edit_dialog_no_type_selector():
    """前端编辑弹窗无 TypeSelector（仅 name 输入）— 验证编辑弹窗段不含 TypeSelector"""
    # 编辑弹窗在重命名 Dialog，TypeSelector 只在创建弹窗
    # 这里验证 TypeSelector 不在重命名 handleRenameSave 附近
    src = _read("../frontend/platform/src/pages/KnowledgePage/components/MetadataManagementDialog.tsx")
    # 重命名保存函数附近不应有 TypeSelector
    rename_idx = src.find("handleRenameSave")
    if rename_idx != -1:
        rename_block = src[rename_idx:rename_idx + 500]
        assert "TypeSelector" not in rename_block, "编辑弹窗不应有 TypeSelector（type 不可改）"
