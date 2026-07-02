"""TDD: C4 tmp_collection 生命周期清理防回归。

背景：tmp_collection 创建 3 处（input.py:188/agent.py:196/knowledge.py:386）清理 0 处，
ES 侧用裸常量 self.tmp_collection_name 与 Milvus 带后缀名错位，换 embedding 后旧维度残留。

正道：Milvus + ES 均加 exec_unique_id 后缀按 workflow 隔离；创建即注册到 _tmp_collections_created；
workflow 结束 _cleanup_nodes_tmp_collections 统一 drop。

本机无 langchain 等重依赖，用源码级断言。
"""
import os


def _read(path_rel):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, path_rel), encoding="utf-8") as f:
        return f.read()


def test_base_milvus_name_has_exec_unique_id_suffix():
    """get_milvus_collection_name 加 exec_unique_id 后缀"""
    src = _read("bisheng/workflow/nodes/base.py")
    assert "self.exec_unique_id" in src
    assert "def get_milvus_collection_name" in src
    # 后缀拼接
    assert "exec_unique_id" in src


def test_base_has_es_index_name_and_register_and_cleanup():
    """base 提供 get_es_index_name + register_tmp_collection + _cleanup_tmp_collections"""
    src = _read("bisheng/workflow/nodes/base.py")
    assert "def get_es_index_name" in src
    assert "def register_tmp_collection" in src
    assert "def _cleanup_tmp_collections" in src
    assert "_tmp_collections_created" in src


def test_three_create_points_use_get_methods_and_register():
    """3 创建点用 get_es_index_name（非裸常量）+ register_tmp_collection"""
    for rel in [
        "bisheng/workflow/nodes/input/input.py",
        "bisheng/workflow/nodes/agent/agent.py",
        "bisheng/workflow/common/knowledge.py",
    ]:
        src = _read(rel)
        assert "get_es_index_name" in src, f"{rel} 未用 get_es_index_name（ES 侧仍裸常量）"
        assert "register_tmp_collection" in src, f"{rel} 未注册 tmp_collection（结束 drop 不触发）"
        # ES 侧不再用裸 self.tmp_collection_name 作为 index_name
        assert "index_name=self.tmp_collection_name" not in src and 'index_name=self.tmp_collection_name' not in src, \
            f"{rel} ES 侧仍用裸 tmp_collection_name"


def test_workflow_run_calls_cleanup():
    """workflow.run/arun 结束调 _cleanup_nodes_tmp_collections"""
    src = _read("bisheng/workflow/graph/workflow.py")
    assert "_cleanup_nodes_tmp_collections" in src
    # run 与 arun 都应调
    assert src.count("_cleanup_nodes_tmp_collections()") >= 2
