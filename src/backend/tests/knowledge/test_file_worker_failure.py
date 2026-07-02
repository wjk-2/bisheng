"""TDD: P1 C1 file_worker 异常路径修复。

背景：
- parse_knowledge_file_celery:287-288 顶层 except 仅 logger.error，不标 FAILED 不重抛，
  叠加 acks_late=True 无自愈，文件长期卡 PROCESSING。
- retry_knowledge_file_celery:357 _parse_knowledge_file 未用 `_, knowledge =` 接收返回值，
  :362 `if not db_file and knowledge:` knowledge 恒 None，向量清理死分支。

正道（选 a 方案）：except 标 FAILED 不重抛（治卡 PROCESSING）；retry 接收 knowledge 修复死分支。
file_worker 依赖 bisheng init（重），用源码级断言（与 A1/A3/A6 同范式）。
"""
import os


def _read_file_worker_src():
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "bisheng", "worker", "knowledge", "file_worker.py")
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_parse_except_marks_file_failed():
    """parse 顶层 except 应标 FAILED（不卡 PROCESSING）"""
    src = _read_file_worker_src()
    start = src.find("def parse_knowledge_file_celery(")
    end = src.find("\n@bisheng_celery.task", start + 1)
    fn = src[start:end] if start != -1 else src
    assert "KnowledgeFileStatus.FAILED" in fn, \
        "parse_knowledge_file_celery except 未标 FAILED（文件会卡 PROCESSING）"


def test_retry_receives_knowledge_return_value():
    """retry 的 _parse_knowledge_file 必须用 `_, knowledge =` 接收返回值"""
    src = _read_file_worker_src()
    start = src.find("def retry_knowledge_file_celery(")
    end = src.find("\n@bisheng_celery.task", start + 1)
    fn = src[start:end] if start != -1 else src
    assert "_, knowledge = _parse_knowledge_file" in fn, \
        "retry 路径未接收 knowledge 返回值，:362 清理死分支"


def test_retry_except_marks_file_failed():
    """retry 顶层 except 应标 FAILED"""
    src = _read_file_worker_src()
    start = src.find("def retry_knowledge_file_celery(")
    end = src.find("\n@bisheng_celery.task", start + 1)
    fn = src[start:end] if start != -1 else src
    # retry 的 _parse_knowledge_file except 分支应标 FAILED
    assert "KnowledgeFileStatus.FAILED" in fn, \
        "retry_knowledge_file_celery except 未标 FAILED"
