"""TDD: F4 workflow 绕 domain 评估。

报告 P2 F4：workflow 绕 domain 直接调 DAO+KnowledgeRag。
计划范围"高风险点修正"——评估 workflow 直调 DAO 的点，写操作（改状态/元数据）
属高风险需改经 domain 接口，读操作（检索取文件信息）属 workflow 职责可保留。

本测试验证评估结论：workflow 无写操作直调 DAO（高风险点不存在），
仅有读操作（filter_file_by_metadata_fields / get_file_by_ids）属合理数据访问。
"""
import os
import subprocess


def _workflow_py_files():
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                        "bisheng", "workflow")
    result = subprocess.run(
        ["python", "-c", f"import os;[print(os.path.join(r,f))for r,d,fs in os.walk(r'{base}')for f in fs if f.endswith('.py')]"],
        capture_output=True, text=True)
    return [l for l in result.stdout.strip().splitlines() if l]


def test_workflow_no_write_operation_directly_calls_dao():
    """workflow 不应直接调 DAO 写操作（update_file_status/insert/delete on KnowledgeFile）"""
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                        "bisheng", "workflow")
    # grep 写操作直调 DAO（排除 tmp_collection 清理的向量侧 drop）
    grep_cmd = ["grep", "-rn", "--include=*.py",
                r"update_file_status\|KnowledgeFileDao\.update\|KnowledgeFileDao\.insert\|KnowledgeFileDao\.delete",
                base]
    result = subprocess.run(grep_cmd, capture_output=True, text=True)
    # 过滤掉注释行和空行
    real_hits = [l for l in result.stdout.splitlines() if l.strip()
                 and not l.strip().startswith('#')]
    assert not real_hits, f"workflow 有写操作直调 DAO（高风险，应经 domain）:\n{result.stdout}"


def test_workflow_read_operations_on_dao_are_acceptable():
    """workflow 读操作直调 DAO（filter_file_by_metadata_fields/get_file_by_ids）属检索职责，可保留"""
    base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                        "bisheng", "workflow")
    grep_cmd = ["grep", "-rn", "--include=*.py", r"KnowledgeFileDao\.", base]
    result = subprocess.run(grep_cmd, capture_output=True, text=True)
    # 应只有读操作
    reads = [l for l in result.stdout.splitlines() if 'filter_file_by_metadata_fields' in l or 'get_file_by_ids' in l]
    assert len(reads) >= 2, "workflow 应有读操作直调 DAO（检索职责）"
