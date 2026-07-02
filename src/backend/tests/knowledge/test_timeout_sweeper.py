"""TDD: D5 超时文件回收改定时任务防回归。

背景：超时回收懒触发（仅 get_knowledge_files 查询时检测 >86400 秒），无定时任务，
长期不查询的文件永久卡 PROCESSING。正道：Celery beat 定时扫描（每小时）。
"""
import os


def _read(rel):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    with open(os.path.join(base, rel), encoding="utf-8") as f:
        return f.read()


def test_timeout_sweeper_task_exists():
    """timeout_sweeper 任务文件存在且定义任务"""
    src = _read("bisheng/worker/knowledge/timeout_sweeper.py")
    assert "@isheng_celery.task" in src or "@celery_app.task" in src or "def timeout_sweeper" in src
    assert "86400" in src, "sweeper 应扫 >86400 秒的 PROCESSING/WAITING 文件"


def test_beat_schedule_registers_sweeper():
    """settings CeleryConf.validate 注入 timeout_sweeper beat 项"""
    src = _read("bisheng/core/config/settings.py")
    assert "knowledge.timeout_sweeper" in src, "未在 beat_schedule 注入 timeout_sweeper"
