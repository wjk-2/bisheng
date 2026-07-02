"""TDD: F3 DDD 边界收敛 + knowledge↔llm 解耦。

验证：
1. DDD 版重命名为 KnowledgeMetadataService（避免与 legacy 同名）
2. 向后兼容别名 KnowledgeService 仍可用
3. domain service 加 logger（review C-3）
4. legacy KnowledgeService 仍在 api/services/knowledge.py（DDD 不接管 CRUD）

本机无 langchain 等重依赖，用源码级断言。
"""
import os


def _read(path):
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    full = os.path.join(base, path)
    with open(full, encoding="utf-8") as f:
        return f.read()


def test_ddd_service_renamed_to_metadata_service():
    """DDD 版 KnowledgeService 重命名为 KnowledgeMetadataService"""
    src = _read("bisheng/knowledge/domain/services/knowledge_service.py")
    assert "class KnowledgeMetadataService:" in src, \
        "DDD 版未重命名为 KnowledgeMetadataService（仍与 legacy 同名）"


def test_backward_compat_alias_exists():
    """向后兼容别名 KnowledgeService = KnowledgeMetadataService"""
    src = _read("bisheng/knowledge/domain/services/knowledge_service.py")
    assert "KnowledgeService = KnowledgeMetadataService" in src, \
        "缺向后兼容别名 KnowledgeService（破坏旧调用方）"


def test_ddd_service_has_logger():
    """domain service 加 logger（review C-3）"""
    src = _read("bisheng/knowledge/domain/services/knowledge_service.py")
    assert "import logging" in src
    assert "logger = logging.getLogger" in src, "domain service 未加 logger"


def test_legacy_knowledge_service_still_in_api_services():
    """legacy KnowledgeService 仍在 api/services/knowledge.py（DDD 不接管 CRUD）"""
    src = _read("bisheng/api/services/knowledge.py")
    assert "class KnowledgeService" in src, "legacy KnowledgeService 不应在 api/services/knowledge.py"


def test_no_two_same_named_knowledge_service_in_ddd():
    """DDD 层不应有两个同名 KnowledgeService 类定义"""
    src = _read("bisheng/knowledge/domain/services/knowledge_service.py")
    # 只能有 KnowledgeMetadataService 类定义，不能有 class KnowledgeService:
    assert src.count("class KnowledgeService:") == 0, \
        "DDD 层仍有 class KnowledgeService: 定义（未重命名）"
