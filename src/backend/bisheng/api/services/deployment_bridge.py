import logging
from typing import Any, Dict, List, Optional

from bisheng.common.services.config_service import settings
from bisheng.llm.domain.const import LLMModelType
from bisheng.llm.domain.models import LLMDao, LLMServer, LLMModel

logger = logging.getLogger(__name__)


class DeploymentBridgeService:
    """GPUStack 部署结果与 LLM 表的双向同步桥接服务"""

    @staticmethod
    async def _afind_server_by_gpustack_id(gpustack_model_id: str) -> Optional[LLMServer]:
        """通过 config._gpustack_model_id 查找已注册的 LLMServer"""
        servers = await LLMDao.aget_all_server()
        for server in servers:
            config = server.config or {}
            if config.get("_source") == "gpustack" and str(config.get("_gpustack_model_id")) == str(gpustack_model_id):
                return server
        return None

    # GPUStack categories 中标识 embedding 模型的关键词
    _EMBEDDING_CATEGORIES = {
        "sentence-similarity",
        "feature-extraction",
        "text-embeddings-inference",
        "sentence-transformers",
        "embedding",
        "embeddings",
    }

    @staticmethod
    def _infer_model_type(categories: Optional[List[str]] = None) -> str:
        """根据 GPUStack 模型的 categories 推断 model_type"""
        if not categories:
            return LLMModelType.LLM.value
        lower_cats = {c.lower().strip() for c in categories if isinstance(c, str)}
        if lower_cats & DeploymentBridgeService._EMBEDDING_CATEGORIES:
            return LLMModelType.EMBEDDING.value
        return LLMModelType.LLM.value

    @staticmethod
    async def register_deployment_to_llm(
        gpustack_model_id: str,
        gpustack_model_name: str,
        model_scope_model_id: str = "",
        online: bool = False,
        status: int = 2,
        categories: Optional[List[str]] = None,
    ) -> Optional[int]:
        """
        部署成功后，创建 LLMServer(type=openai) + LLMModel，注册到 LLM 表。
        根据 categories 自动识别 model_type（llm / embedding）。
        返回新建的 server_id，失败返回 None。
        """
        try:
            # 幂等检查：是否已注册
            existing = await DeploymentBridgeService._afind_server_by_gpustack_id(gpustack_model_id)
            if existing:
                logger.info("GPUStack model %s already registered as LLMServer id=%s", gpustack_model_id, existing.id)
                return existing.id

            # 读取 GPUStack 配置
            gpustack_config = settings.get_from_db("gpustack") or {}
            gpustack_url = gpustack_config.get("url", "https://gpustack.agentgo.tech")
            gpustack_token = gpustack_config.get("token", "")

            # 构造 endpoint
            endpoint = f"{gpustack_url.rstrip('/')}/v1-openai"

            # 构造 server 名称，冲突时加 model_id 后缀
            base_name = f"GPUStack - {gpustack_model_name}"
            server_name = base_name
            existing_by_name = await LLMDao.aget_server_by_name(server_name)
            if existing_by_name:
                server_name = f"{base_name} ({gpustack_model_id})"

            # 构造 LLMServer config
            server_config = {
                "openai_api_base": endpoint,
                "openai_api_key": gpustack_token,
                "_source": "gpustack",
                "_gpustack_model_id": str(gpustack_model_id),
                "_gpustack_model_name": gpustack_model_name,
                "_model_scope_model_id": model_scope_model_id,
            }

            server = LLMServer(
                name=server_name,
                description=f"Auto-registered from GPUStack deployment: {gpustack_model_name}",
                type="openai",
                config=server_config,
            )

            # 根据 categories 自动判断 model_type
            model_type = DeploymentBridgeService._infer_model_type(categories)
            logger.info("Inferred model_type=%s for %s (categories=%s)", model_type, gpustack_model_name, categories)

            model = LLMModel(
                name=gpustack_model_name,
                model_name=gpustack_model_name,
                model_type=model_type,
                online=online,
                status=status,
            )

            server = await LLMDao.ainsert_server_with_models(server, [model])
            logger.info(
                "Registered GPUStack deployment %s as LLMServer id=%s, name=%s, model_type=%s",
                gpustack_model_id, server.id, server_name, model_type,
            )
            return server.id

        except Exception as e:
            logger.warning("Failed to register GPUStack deployment %s to LLM: %s", gpustack_model_id, e)
            return None

    @staticmethod
    async def unregister_deployment_from_llm(gpustack_model_id: str) -> bool:
        """
        部署删除时，删除对应的 LLMServer（级联删除 LLMModel）。
        返回是否成功。
        """
        try:
            server = await DeploymentBridgeService._afind_server_by_gpustack_id(gpustack_model_id)
            if not server:
                logger.info("No LLMServer found for GPUStack model %s, skip unregister", gpustack_model_id)
                return True

            await LLMDao.adelete_server_by_id(server.id)
            logger.info("Unregistered LLMServer id=%s for GPUStack model %s", server.id, gpustack_model_id)
            return True

        except Exception as e:
            logger.warning("Failed to unregister GPUStack deployment %s from LLM: %s", gpustack_model_id, e)
            return False

    @staticmethod
    async def sync_deployment_status(gpustack_model_id: str, is_running: bool) -> bool:
        """
        部署启停时，同步 llm_model.online 状态。
        返回是否成功。
        """
        try:
            if not gpustack_model_id:
                return False

            server = await DeploymentBridgeService._afind_server_by_gpustack_id(str(gpustack_model_id))
            if not server:
                return False

            models = await LLMDao.aget_model_by_server_ids([server.id])
            for model in models:
                if model.online != is_running:
                    await LLMDao.aupdate_model_online(model.id, is_running)
                    logger.info(
                        "Synced LLMModel id=%s online=%s for GPUStack model %s",
                        model.id, is_running, gpustack_model_id,
                    )
            return True

        except Exception as e:
            logger.warning("Failed to sync deployment status for GPUStack model %s: %s", gpustack_model_id, e)
            return False

    @staticmethod
    async def get_server_id_by_gpustack_id(gpustack_model_id: str) -> Optional[int]:
        """查询 GPUStack model 对应的 LLMServer ID"""
        try:
            server = await DeploymentBridgeService._afind_server_by_gpustack_id(str(gpustack_model_id))
            return server.id if server else None
        except Exception as e:
            logger.warning("Failed to find LLMServer for GPUStack model %s: %s", gpustack_model_id, e)
            return None

    @staticmethod
    async def batch_get_gpustack_servers() -> Dict[str, LLMServer]:
        """一次性加载所有 gpustack source 的 server，返回 {gpustack_model_id: server} 字典"""
        servers = await LLMDao.aget_all_server()
        result: Dict[str, LLMServer] = {}
        for server in servers:
            config = server.config or {}
            if config.get("_source") == "gpustack":
                gid = str(config.get("_gpustack_model_id", ""))
                if gid:
                    result[gid] = server
        return result

    @staticmethod
    async def batch_sync_and_annotate(items: List[Dict[str, Any]]) -> None:
        """批量同步状态并标注 llm_registered / llm_server_id（一次 DB 查询替代 N*2 次）"""
        try:
            server_map = await DeploymentBridgeService.batch_get_gpustack_servers()
        except Exception as e:
            logger.warning("batch_get_gpustack_servers failed: %s", e)
            for item in items:
                item["llm_registered"] = False
                item["llm_server_id"] = None
            return

        # 收集需要查询 model 的 server_ids
        server_ids_to_query = [s.id for s in server_map.values()]
        models_by_server: Dict[int, List[LLMModel]] = {}
        if server_ids_to_query:
            try:
                all_models = await LLMDao.aget_model_by_server_ids(server_ids_to_query)
                for model in all_models:
                    models_by_server.setdefault(model.server_id, []).append(model)
            except Exception as e:
                logger.warning("batch aget_model_by_server_ids failed: %s", e)

        for item in items:
            # modelId 是 GPUStack model ID，id 是 instance ID；server_map 的 key 是 model ID
            gpustack_id = str(item.get("modelId") or item.get("model_id") or item.get("id", ""))
            is_running = item.get("status") == "running"
            server = server_map.get(gpustack_id)

            if server:
                item["llm_registered"] = True
                item["llm_server_id"] = server.id
                # 标注 model_type 并同步 online 状态
                server_models = models_by_server.get(server.id, [])
                item["llm_model_type"] = server_models[0].model_type if server_models else "llm"
                for model in server_models:
                    if model.online != is_running:
                        try:
                            await LLMDao.aupdate_model_online(model.id, is_running)
                        except Exception:
                            pass
            else:
                item["llm_registered"] = False
                item["llm_server_id"] = None
                item["llm_model_type"] = None
