"""TDD: F1 knowledge_imp 包结构 + re-export（降级方案）。

F1 决策（彭总 2026-07-02）：物理拆分 8 子模块风险高且 re-export 仍让旧路径可用，
故降级为"包结构 + re-export + DeprecationWarning"。接缝倒置治本由 F3 承担。

验证：
1. knowledge_imp 是包（目录），原代码在 knowledge_imp_legacy.py
2. __init__.py re-export 全部公开符号（向后兼容）
3. DeprecationWarning 提示新代码用子模块路径
"""
import os
import warnings


def _base():
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                        "bisheng", "api", "services")


def test_knowledge_imp_is_package_with_legacy():
    """knowledge_imp 是包目录，原代码迁到 knowledge_imp_legacy.py"""
    base = _base()
    assert os.path.isdir(os.path.join(base, "knowledge_imp")), "knowledge_imp 不是包目录"
    assert os.path.isfile(os.path.join(base, "knowledge_imp", "__init__.py"))
    assert os.path.isfile(os.path.join(base, "knowledge_imp_legacy.py")), "原代码未迁到 legacy"


def test_init_re_exports_public_symbols():
    """__init__.py re-export 关键公开符号（向后兼容）"""
    init_src = open(os.path.join(_base(), "knowledge_imp", "__init__.py"), encoding="utf-8").read()
    for sym in ["add_file_embedding", "read_chunk_text", "delete_vector_files",
                "KnowledgeUtils", "decide_vectorstores", "QA_save_knowledge"]:
        assert f"    {sym}," in init_src or f"import {sym}" in init_src, \
            f"__init__.py 未 re-export {sym}"


def test_init_emits_deprecation_warning():
    """__init__.py 含 DeprecationWarning 代码（提示用子模块路径）

    注：真 import 触发受 langchain 重依赖限制（本机无），用源码级断言；
    部署后在容器内补行为验证（J1/J3）。
    """
    init_src = open(os.path.join(_base(), "knowledge_imp", "__init__.py"), encoding="utf-8").read()
    assert "DeprecationWarning" in init_src, "knowledge_imp/__init__.py 未加 DeprecationWarning"
    assert "legacy" in init_src, "DeprecationWarning 未提示 legacy 桥接"
    assert "from bisheng.api.services.knowledge_imp_legacy import" in init_src, \
        "未从 knowledge_imp_legacy re-export"
