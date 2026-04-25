import asyncio
import os
from loguru import logger
import threading
from typing import List, Optional, Dict, Any
from datetime import datetime
import aiohttp
from aiohttp import ContentTypeError, ClientTimeout
import json
from urllib.parse import urljoin, quote

from bisheng.common.services.config_service import settings
from bisheng.api.services.base import BaseService
from bisheng.api.services.deployment_bridge import DeploymentBridgeService

# --- GPUStackService 单例工厂 ---
_gpustack_instance = None
_gpustack_lock = threading.Lock()


def get_gpustack_service():
    global _gpustack_instance
    if _gpustack_instance is None:
        with _gpustack_lock:
            if _gpustack_instance is None:
                _gpustack_instance = GPUStackService()
    return _gpustack_instance


def reset_gpustack_service():
    global _gpustack_instance
    with _gpustack_lock:
        _gpustack_instance = None


class GPUStackService(BaseService):
    """GPUStack集成服务"""

    # GPUStack 要求特定大小写的 backend 名称
    _BACKEND_MAPPING = {
        "vllm": "vLLM",
        "llama-box": "llama-box",
    }

    @staticmethod
    def _normalize_backend(backend: str) -> str:
        """规范化 backend 名称，处理大小写映射"""
        if not backend:
            return "llama-box"
        return GPUStackService._BACKEND_MAPPING.get(backend.lower(), backend)

    def __init__(self):
        super().__init__()
        # 从config.yaml读取GPUStack配置
        gpustack_config = settings.get_from_db("gpustack") or {}
        self.gpustack_url = gpustack_config.get("url", "https://gpustack.agentgo.tech")
        self.gpustack_username = gpustack_config.get("username", "")
        self.gpustack_password = gpustack_config.get("password", "")
        self.gpustack_token = gpustack_config.get("token") or ""

        modelscope_config = settings.get_from_db("modelscope") or {}
        self.modelscope_cookie = modelscope_config.get("cookie") or os.getenv("MODELSCOPE_COOKIE", "")
        self.modelscope_token = modelscope_config.get("token") or os.getenv("MODELSCOPE_TOKEN", "")

        if not self.gpustack_url:
            self.gpustack_url = "https://gpustack.agentgo.tech"

        self.use_token_auth = bool(self.gpustack_token)
        self.session_cookie = None
        self._auth_lock = asyncio.Lock()
        self.headers = {
            "Content-Type": "application/json"
        }
        if self.use_token_auth:
            self.headers["Authorization"] = f"Bearer {self.gpustack_token}"
        
        logger.info(f"GPUStack service initialized with URL: {self.gpustack_url}")

    @staticmethod
    def _normalize_label_list(values: Any) -> List[str]:
        """将ModelScope返回的标签或任务字段统一为字符串列表"""
        if not isinstance(values, list):
            return []

        candidates = [
            "Name",
            "name",
            "TagName",
            "tagName",
            "DisplayName",
            "displayName",
            "ChineseName",
            "chineseName",
            "Description",
            "description",
            "DomainName",
            "domainName",
            "Id",
            "id",
        ]

        normalized: List[str] = []
        seen = set()

        for value in values:
            label: Optional[str] = None

            if isinstance(value, str):
                label = value.strip() or None
            elif isinstance(value, (int, float)):
                label = str(value)
            elif isinstance(value, dict):
                for key in candidates:
                    field = value.get(key)
                    if isinstance(field, str):
                        field_value = field.strip()
                        if field_value:
                            label = field_value
                            break
                    elif isinstance(field, (int, float)):
                        label = str(field)
                        break

            if label and label not in seen:
                seen.add(label)
                normalized.append(label)

        return normalized

    def _default_modelscope_headers(self) -> Dict[str, str]:
        """构造访问 ModelScope 接口时使用的默认请求头"""
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://www.modelscope.cn",
            "Referer": "https://www.modelscope.cn/",
            "X-Requested-With": "XMLHttpRequest",
        }
        if self.modelscope_cookie:
            headers["Cookie"] = self.modelscope_cookie
        if self.modelscope_token:
            headers.setdefault("Authorization", f"token {self.modelscope_token}")
            headers.setdefault("X-Auth-Token", self.modelscope_token)
        return headers

    async def _fetch_modelscope_json(self, session: aiohttp.ClientSession, url: str) -> Dict[str, Any]:
        """直接向 ModelScope 官方接口发起请求并返回解析后的 JSON"""
        async with session.get(url) as response:
            text = await response.text()
            if response.status >= 400:
                snippet = text[:200].replace("\n", " ")
                raise Exception(f"ModelScope API error ({response.status}): {snippet}")

            try:
                return await response.json(content_type=None)
            except (ContentTypeError, json.JSONDecodeError):
                try:
                    return json.loads(text)
                except json.JSONDecodeError as error:
                    raise Exception(f"Unable to parse ModelScope response: {error}")
    
    async def _login(self) -> str:
        """登录到GPUStack获取session cookie"""
        login_url = urljoin(self.gpustack_url, "/auth/login")
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    login_url,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data=f"username={quote(self.gpustack_username, safe='')}&password={quote(self.gpustack_password, safe='')}"
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"GPUStack login failed: {response.status} - {error_text}")
                        raise Exception(f"GPUStack login failed: {response.status}")
                    
                    # 从响应的Set-Cookie头中提取session cookie
                    cookies = response.cookies
                    if 'gpustack_session' in cookies:
                        session_cookie = cookies['gpustack_session'].value
                        logger.info("GPUStack login successful")
                        return session_cookie
                    else:
                        raise Exception("No session cookie found in login response")
            except aiohttp.ClientError as e:
                logger.error(f"Failed to login to GPUStack: {str(e)}")
                raise Exception(f"Failed to login to GPUStack: {str(e)}")
    
    async def _ensure_authenticated(self):
        """确保有有效的认证信息"""
        if self.use_token_auth:
            return
        if self.session_cookie:
            return
        async with self._auth_lock:
            if not self.session_cookie:
                self.session_cookie = await self._login()
        
    async def _get_default_cluster_id(self) -> int:
        """获取 GPUStack 默认 Cluster ID（GPUStack v0.7+ 必须指定 cluster_id）"""
        try:
            clusters = await self._make_request("GET", "/v2/clusters")
            items = clusters.get("items", [])
            if items:
                return items[0].get("id")
            raise Exception("No clusters found in GPUStack")
        except Exception as e:
            logger.warning("Failed to get default cluster_id, falling back to 1: %s", e)
            return 1

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """发送HTTP请求到GPUStack"""
        url = urljoin(self.gpustack_url, endpoint)
        
        # 确保有有效的认证信息
        await self._ensure_authenticated()
        
        # 准备cookies
        cookies = None
        if not self.use_token_auth and self.session_cookie:
            cookies = {"gpustack_session": self.session_cookie}
        request_headers = dict(self.headers)
        if "headers" in kwargs and kwargs["headers"]:
            request_headers.update(kwargs.pop("headers"))

        async with aiohttp.ClientSession(cookies=cookies) as session:
            try:
                async with session.request(
                    method=method,
                    url=url,
                    headers=request_headers,
                    **kwargs
                ) as response:
                    if response.status == 401:
                        # 如果认证失败，重新登录并重试
                        logger.warning("Authentication failed, retrying with new login")
                        self.session_cookie = None
                        await self._ensure_authenticated()
                        if not self.use_token_auth and self.session_cookie:
                            cookies = {"gpustack_session": self.session_cookie}
                        else:
                            cookies = None
                        
                        # 重新创建 session 并重试请求
                        async with aiohttp.ClientSession(cookies=cookies) as retry_session:
                            async with retry_session.request(
                                method=method,
                                url=url,
                                headers=request_headers,
                                **kwargs
                            ) as retry_response:
                                if retry_response.status >= 400:
                                    error_text = await retry_response.text()
                                    message = self._parse_error_message(error_text)
                                    logger.error(
                                        "GPUStack API error: %s - %s",
                                        retry_response.status,
                                        message,
                                    )
                                    raise Exception(
                                        f"GPUStack API error ({retry_response.status}): {message}"
                                    )

                                return await self._parse_response(retry_response)
                    elif response.status >= 400:
                        error_text = await response.text()
                        message = self._parse_error_message(error_text)
                        logger.error(
                            "GPUStack API error: %s - %s",
                            response.status,
                            message,
                        )
                        raise Exception(
                            f"GPUStack API error ({response.status}): {message}"
                        )

                    return await self._parse_response(response)
            except aiohttp.ClientError as e:
                logger.error(f"Failed to connect to GPUStack: {str(e)}")
                raise Exception(f"Failed to connect to GPUStack service: {str(e)}")
    
    async def list_deployments(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 10,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取部署列表（使用 /v2/models 以包含已停止的模型）"""
        try:
            params = {
                "page": page,
                "perPage": per_page
            }
            if search:
                params["search"] = search

            response = await self._make_request(
                "GET",
                "/v2/models",
                params=params
            )

            # 转换为部署列表格式
            deployments = []
            for item in response.get("items", []):
                deployment = self._convert_to_deployment(item)
                deployments.append(deployment)

            return {
                "items": deployments,
                "total": response.get("pagination", {}).get("total", 0),
                "page": page,
                "per_page": per_page
            }

        except Exception as e:
            logger.error(f"Failed to list deployments: {str(e)}")
            raise
    
    async def create_deployment(
        self,
        user_id: str,
        deployment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """创建新部署（支持 ModelScope 模型）"""
        try:
            # 验证必需的参数
            model_scope_model_id = deployment_data.get("model_scope_model_id")
            if not model_scope_model_id:
                raise ValueError("model_scope_model_id 是必需的参数")
            
            # 处理可选的文件路径参数，确保不传递 None 值
            model_scope_file_path = deployment_data.get("model_scope_file_path")
            if model_scope_file_path is not None and not isinstance(model_scope_file_path, str):
                logger.warning(f"model_scope_file_path 应该是字符串类型，当前类型: {type(model_scope_file_path)}")
                model_scope_file_path = None
            
            # 获取默认 cluster_id（GPUStack v0.7+ 必须指定）
            cluster_id = deployment_data.get("cluster_id")
            if not cluster_id:
                cluster_id = await self._get_default_cluster_id()

            model_payload = {
                "name": deployment_data["name"],
                "source": "model_scope",
                "model_scope_model_id": model_scope_model_id,
                "backend": self._normalize_backend(deployment_data.get("backend", "llama-box")),
                "replicas": deployment_data.get("replicas", 1),
                "description": deployment_data.get("description", ""),
                "categories": deployment_data.get("categories", []),
                "backend_parameters": deployment_data.get("backend_parameters", []),
                "env": deployment_data.get("environment_variables") or {},
                "restart_on_error": deployment_data.get("restart_on_error", True),
                "placement_strategy": deployment_data.get("placement_strategy", "spread"),
                "worker_selector": deployment_data.get("worker_selector") or {},
                "cpu_offloading": deployment_data.get("cpu_offloading"),
                "distributed_inference_across_workers": deployment_data.get(
                    "distributed_inference_across_workers"
                ),
                "gpu_selector": deployment_data.get("gpu_selector"),
                "cluster_id": cluster_id,
            }

            if model_payload.get("cpu_offloading"):
                allow_offloading = self._is_cpu_offloading_allowed(
                    model_scope_model_id=model_scope_model_id,
                    model_scope_file_path=model_scope_file_path,
                    categories=model_payload.get("categories"),
                )
                if not allow_offloading:
                    logger.info(
                        "CPU offloading is disabled for non-GGUF model %s",
                        model_scope_model_id,
                    )
                    model_payload["cpu_offloading"] = False
            
            # 只有当 model_scope_file_path 不为 None 且不为空字符串时才添加到 payload 中
            if model_scope_file_path:
                model_payload["model_scope_file_path"] = model_scope_file_path

            cleaned_payload = {
                key: value
                for key, value in model_payload.items()
                if value is not None
            }

            logger.info(f"创建 ModelScope 模型部署: {model_scope_model_id}, 文件路径: {model_scope_file_path}")

            model_response = await self._make_request(
                "POST",
                "/v2/models",
                json=cleaned_payload
            )

            model_id = model_response.get("id")
            desired_replicas = deployment_data.get("replicas", 1)

            model_ready = await self._wait_for_model_ready(model_id, desired_replicas)
            if not model_ready:
                logger.info("Model %s not ready within timeout, registering as offline", model_id)

            deployment = await self.get_deployment(user_id=user_id, deployment_id=str(model_id))
            result = deployment if deployment else self._convert_to_deployment(model_response)

            # 桥接：注册到 LLM 表（传入 categories 自动识别 model_type）
            try:
                categories = model_response.get("categories") or deployment_data.get("categories") or []
                server_id = await DeploymentBridgeService.register_deployment_to_llm(
                    gpustack_model_id=str(model_id),
                    gpustack_model_name=deployment_data["name"],
                    model_scope_model_id=model_scope_model_id or "",
                    online=model_ready,
                    status=0 if model_ready else 2,
                    categories=categories,
                )
                result["llm_registered"] = server_id is not None
            except Exception as bridge_err:
                logger.warning("Bridge register_deployment_to_llm failed: %s", bridge_err)
                result["llm_registered"] = False

            return result

        except ValueError as ve:
            logger.error(f"参数验证失败: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Failed to create deployment: {str(e)}")
            # 检查是否是文件路径相关的错误
            error_msg = str(e)
            if "expected str, bytes or os.PathLike object, not NoneType" in error_msg:
                raise Exception(f"部署创建失败：模型文件路径配置错误，model_scope_file_path 参数不能为 None。请提供有效的文件路径或留空。")
            raise
    
    async def get_deployment(
        self,
        user_id: str,
        deployment_id: str
    ) -> Optional[Dict[str, Any]]:
        """获取部署详情"""
        try:
            model_id = await self._resolve_model_id(deployment_id)

            model_response = await self._make_request(
                "GET",
                f"/v2/models/{model_id}"
            )

            instances_response = await self._make_request(
                "GET",
                f"/v2/models/{model_id}/instances"
            )

            deployment = self._convert_to_deployment(model_response)
            instances = self._convert_instances(instances_response.get("items", []))
            deployment["instances"] = instances
            deployment["modelId"] = str(model_id)
            deployment["instanceIds"] = [instance.get("id") for instance in instances]
            deployment["requestedId"] = str(deployment_id)

            return deployment
        except Exception as e:
            logger.error(f"Failed to get deployment: {str(e)}")
            return None
    
    async def update_deployment(
        self,
        user_id: str,
        deployment_id: str,
        deployment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """更新部署配置"""
        try:
            model_id = await self._resolve_model_id(deployment_id)

            overrides: Dict[str, Any] = {}
            if "replicas" in deployment_data:
                overrides["replicas"] = deployment_data["replicas"]
            
            if "description" in deployment_data:
                overrides["description"] = deployment_data["description"]
            
            if "environment_variables" in deployment_data:
                overrides["env"] = deployment_data["environment_variables"]

            if "categories" in deployment_data:
                overrides["categories"] = deployment_data["categories"]

            if "backend_parameters" in deployment_data:
                overrides["backend_parameters"] = deployment_data["backend_parameters"]

            payload = await self._build_model_update_payload(model_id, overrides)
            
            response = await self._make_request(
                "PUT",
                f"/v2/models/{model_id}",
                json=payload
            )
            
            return self._convert_to_deployment(response)
            
        except Exception as e:
            logger.error(f"Failed to update deployment: {str(e)}")
            raise
    
    async def _build_model_update_payload(
        self,
        model_id: str,
        overrides: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        构造 GPUStack 模型更新请求体，确保必需字段（name/source 等）被保留。
        """
        model_response = await self._make_request(
            "GET",
            f"/v2/models/{model_id}"
        )

        if not isinstance(model_response, dict):
            raise Exception("Unexpected GPUStack response when fetching model details")

        # GPUStack 更新接口至少需要 name 与 source，其他字段保持与当前一致
        base_keys = [
            "name",
            "source",
            "description",
            "categories",
            "backend",
            "backend_version",
            "backend_parameters",
            "model_scope_model_id",
            "model_scope_file_path",
            "env",
            "restart_on_error",
            "placement_strategy",
            "worker_selector",
            "cpu_offloading",
            "distributed_inference_across_workers",
            "gpu_selector",
        ]

        payload: Dict[str, Any] = {}
        for key in base_keys:
            value = model_response.get(key)
            if value is not None:
                payload[key] = value

        if "replicas" in model_response and "replicas" not in overrides:
            payload["replicas"] = model_response.get("replicas")

        # 合并 overrides，保留 falsy 但非 None 的值
        for key, value in overrides.items():
            if value is None:
                continue
            payload[key] = value

        if payload.get("cpu_offloading"):
            allow_offloading = self._is_cpu_offloading_allowed(
                model_scope_model_id=payload.get("model_scope_model_id"),
                model_scope_file_path=payload.get("model_scope_file_path"),
                categories=payload.get("categories"),
            )
            if not allow_offloading:
                payload["cpu_offloading"] = False

        # GPUStack 返回 env 可能是 None；保证至少为字典
        if payload.get("env") is None:
            payload["env"] = {}

        return payload

    def _is_cpu_offloading_allowed(
        self,
        model_scope_model_id: Optional[str],
        model_scope_file_path: Optional[str],
        categories: Optional[Any],
    ) -> bool:
        """判断是否可以启用 CPU Offloading，仅 GGUF 模型支持"""
        identifiers: List[str] = []
        if isinstance(model_scope_file_path, str):
            identifiers.append(model_scope_file_path.strip().lower())
        if isinstance(model_scope_model_id, str):
            identifiers.append(str(model_scope_model_id).strip().lower())

        if any(identifier.endswith(".gguf") for identifier in identifiers if identifier):
            return True

        normalized_categories: List[Any] = []
        if isinstance(categories, list):
            normalized_categories = categories
        elif isinstance(categories, dict):
            normalized_categories = categories.get("items") or categories.get("Items") or []

        for item in normalized_categories:
            if isinstance(item, str) and item.strip().lower() == "gguf":
                return True
            if isinstance(item, dict):
                for key in ("name", "Name", "tag", "Tag", "label", "Label", "value", "Value"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip().lower() == "gguf":
                        return True

        return False
    
    async def delete_deployment(
        self,
        user_id: str,
        deployment_id: str
    ) -> None:
        """删除部署"""
        try:
            model_id = await self._resolve_model_id(deployment_id)

            # 桥接：先从 LLM 表注销
            try:
                await DeploymentBridgeService.unregister_deployment_from_llm(str(model_id))
            except Exception as bridge_err:
                logger.warning("Bridge unregister_deployment_from_llm failed: %s", bridge_err)

            await self._make_request(
                "DELETE",
                f"/v2/models/{model_id}"
            )
        except Exception as e:
            logger.error(f"Failed to delete deployment: {str(e)}")
            raise
    
    async def start_deployment(
        self,
        user_id: str,
        deployment_id: str
    ) -> Dict[str, Any]:
        """启动部署"""
        try:
            # 更新副本数为原始值
            model_id = await self._resolve_model_id(deployment_id)
            payload = await self._build_model_update_payload(model_id, {"replicas": 1})
            response = await self._make_request(
                "PUT",
                f"/v2/models/{model_id}",
                json=payload
            )

            result = self._convert_to_deployment(response)

            # 桥接：同步上线状态
            try:
                await DeploymentBridgeService.sync_deployment_status(str(model_id), is_running=True)
            except Exception as bridge_err:
                logger.warning("Bridge sync_deployment_status (start) failed: %s", bridge_err)

            return result

        except Exception as e:
            logger.error(f"Failed to start deployment: {str(e)}")
            raise
    
    async def stop_deployment(
        self,
        user_id: str,
        deployment_id: str
    ) -> Dict[str, Any]:
        """停止部署"""
        try:
            # 将副本数设为0来停止部署
            model_id = await self._resolve_model_id(deployment_id)
            payload = await self._build_model_update_payload(model_id, {"replicas": 0})
            response = await self._make_request(
                "PUT",
                f"/v2/models/{model_id}",
                json=payload
            )

            result = self._convert_to_deployment(response)

            # 桥接：同步下线状态
            try:
                await DeploymentBridgeService.sync_deployment_status(str(model_id), is_running=False)
            except Exception as bridge_err:
                logger.warning("Bridge sync_deployment_status (stop) failed: %s", bridge_err)

            return result

        except Exception as e:
            logger.error(f"Failed to stop deployment: {str(e)}")
            raise
    
    async def get_deployment_instances(
        self,
        user_id: str,
        deployment_id: str
    ) -> List[Dict[str, Any]]:
        """获取部署的所有实例"""
        try:
            model_id = await self._resolve_model_id(deployment_id)
            response = await self._make_request(
                "GET",
                f"/v2/models/{model_id}/instances"
            )
            
            return self._convert_instances(response.get("items", []))
            
        except Exception as e:
            logger.error(f"Failed to get deployment instances: {str(e)}")
            raise
    
    async def get_deployment_metrics(
        self,
        user_id: str,
        deployment_id: str,
        time_range: str = "1h"
    ) -> Dict[str, Any]:
        """获取部署的监控指标"""
        try:
            # 从GPUStack Dashboard API获取监控数据
            model_id = await self._resolve_model_id(deployment_id)
            response = await self._make_request(
                "GET",
                "/v2/dashboard",
                params={"model_id": model_id}
            )
            
            # 转换监控数据格式
            metrics = {
                "gpu": self._format_metrics_data(response.get("system_load", {}).get("history", {}).get("gpu", [])),
                "memory": self._format_metrics_data(response.get("system_load", {}).get("history", {}).get("vram", [])),
                "cpu": self._format_metrics_data(response.get("system_load", {}).get("history", {}).get("cpu", [])),
                "requests": []  # GPUStack暂不提供请求统计
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get deployment metrics: {str(e)}")
            raise
    
    async def get_deployment_logs(
        self,
        user_id: str,
        deployment_id: str,
        instance_id: Optional[str] = None,
        log_level: Optional[str] = "all",
        lines: int = 100
    ) -> List[str]:
        """获取部署日志"""
        try:
            # 如果指定了实例ID，获取特定实例的日志
            target_instance_id = instance_id
            if not target_instance_id:
                instances = await self.get_deployment_instances(user_id, deployment_id)
                if not instances:
                    return []
                target_instance_id = instances[0]["id"]

            response = await self._make_request(
                "GET",
                f"/v2/model-instances/{target_instance_id}/logs",
                params={"tail": lines, "follow": False}
            )

            if isinstance(response, dict) and "logs" in response:
                logs_text = response.get("logs", "")
            else:
                logs_text = response if isinstance(response, str) else str(response)

            logs = logs_text.split("\n")
            
            # 根据日志级别过滤
            if log_level != "all":
                logs = [log for log in logs if f"[{log_level.upper()}]" in log]
            
            return logs[-lines:]  # 返回最后N行
            
        except Exception as e:
            logger.error(f"Failed to get deployment logs: {str(e)}")
            return []
    
    async def get_available_resources(self) -> Dict[str, Any]:
        """获取可用资源"""
        try:
            # 获取GPU设备列表
            gpu_response = await self._make_request(
                "GET",
                "/v2/gpu-devices"
            )
            
            # 获取Worker列表
            worker_response = await self._make_request(
                "GET",
                "/v2/workers"
            )
            
            # 统计可用资源
            total_gpus = len(gpu_response.get("items", []))
            available_gpus = sum(1 for gpu in gpu_response.get("items", []) 
                               if gpu.get("status") == "available")
            
            total_workers = len(worker_response.get("items", []))
            active_workers = sum(1 for worker in worker_response.get("items", []) 
                               if worker.get("status") == "ready")
            
            return {
                "gpus": {
                    "total": total_gpus,
                    "available": available_gpus,
                    "types": list(set(gpu.get("name", "Unknown") 
                                    for gpu in gpu_response.get("items", [])))
                },
                "workers": {
                    "total": total_workers,
                    "active": active_workers
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get available resources: {str(e)}")
            raise

    async def list_workers(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """列出 GPUStack Worker 列表"""
        try:
            response = await self._make_request(
                "GET",
                "/v2/workers",
                params=params or None,
            )
            return response
        except Exception as e:
            logger.error(f"Failed to list workers: {str(e)}")
            raise

    async def list_gpu_devices(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """列出 GPU 设备列表"""
        try:
            response = await self._make_request(
                "GET",
                "/v2/gpu-devices",
                params=params or None,
            )
            return response
        except Exception as e:
            logger.error(f"Failed to list GPU devices: {str(e)}")
            raise

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用于部署的模型列表"""
        try:
            model_list = []

            # 从GPUStack获取预定义的模型集
            try:
                model_sets = await self._make_request(
                    "GET",
                    "/v2/model-sets"
                )
                
                for model_set in model_sets.get("items", []):
                    model_list.append({
                        "id": model_set.get("name"),
                        "name": model_set.get("name"),
                        "type": "preset",
                        "provider": "gpustack"
                    })
            except Exception as e:
                logger.error(f"Failed to get model sets from GPUStack: {str(e)}")
            
            # 也可以获取已部署的模型作为参考
            try:
                models = await self._make_request(
                    "GET",
                    "/v2/models"
                )
                
                for model in models.get("items", []):
                    model_list.append({
                        "id": str(model.get("id")),
                        "name": model.get("name"),
                        "type": "deployed",
                        "provider": "gpustack"
                    })
            except Exception as e:
                logger.error(f"Failed to get models from GPUStack: {str(e)}")
            
            return model_list
            
        except Exception as e:
            logger.error(f"Failed to get available models: {str(e)}")
            return []

    async def _parse_response(self, response: aiohttp.ClientResponse):
        """解析HTTP响应，支持JSON与纯文本"""
        try:
            return await response.json()
        except ContentTypeError:
            return await response.text()

    def _parse_error_message(self, raw_text: str) -> str:
        """提取GPUStack错误信息"""
        try:
            data = json.loads(raw_text)
            if isinstance(data, dict):
                for key in ("message", "detail", "error", "status_message"):
                    value = data.get(key)
                    if value:
                        if isinstance(value, (dict, list)):
                            return json.dumps(value, ensure_ascii=False)
                        return str(value)
        except json.JSONDecodeError:
            pass
        return raw_text.strip() or "Unknown error"

    async def list_modelscope_models(
        self,
        page_number: int = 1,
        page_size: int = 10,
        name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        tasks: Optional[List[str]] = None,
        sort_by: str = "Default"
    ) -> Dict[str, Any]:
        """通过GPUStack代理获取ModelScope模型列表"""
        try:
            payload = {
                "PageSize": page_size,
                "PageNumber": page_number,
                "Name": name or "",
                "tags": tags or [],
                "tasks": tasks or [],
                "SortBy": sort_by,
            }

            response = await self._make_request(
                "PUT",
                "/proxy",
                params={
                    "url": "https://www.modelscope.cn/api/v1/dolphin/models"
                },
                json=payload
            )

            data = response.get("Data") or response.get("data") or response
            model_data = data.get("Model") or data.get("model") or {}
            items_raw = (
                model_data.get("Models")
                or model_data.get("models")
                or data.get("Models")
                or data.get("models")
                or []
            )

            normalized_items = []
            for item in items_raw:
                if not isinstance(item, dict):
                    continue

                owner_candidates = [
                    item.get("Owner"),
                    item.get("owner"),
                    item.get("OwnerName"),
                    item.get("ownerName"),
                    item.get("UserName"),
                    item.get("userName"),
                    item.get("Namespace"),
                    item.get("namespace"),
                    item.get("OrgName"),
                    item.get("orgName"),
                    item.get("Path"),
                ]

                owner = None
                for candidate in owner_candidates:
                    if candidate is None:
                        continue
                    candidate_str = str(candidate).strip()
                    if candidate_str:
                        owner = candidate_str
                        break

                repository_candidates = [
                    item.get("RepositoryPath"),
                    item.get("repositoryPath"),
                    item.get("RepositoryId"),
                    item.get("repositoryId"),
                    item.get("Path"),
                    item.get("ModelId"),
                    item.get("modelId"),
                    item.get("ModelName"),
                    item.get("modelName"),
                    item.get("Name"),
                    item.get("name"),
                    f"{owner}/{item.get('Name')}" if owner and item.get('Name') else None,
                ]
                repository_id = None
                for candidate in repository_candidates:
                    if candidate is None:
                        continue
                    candidate_str = str(candidate).strip()
                    if not candidate_str:
                        continue
                    # ModelScope 仓库通常为 owner/model-name 形式，优先包含 / 的值
                    if "/" in candidate_str or candidate_str.count("-") >= 2:
                        repository_id = candidate_str
                        break
                    if repository_id is None:
                        repository_id = candidate_str

                numeric_id = item.get("Id") or item.get("id")
                primary_id = repository_id or numeric_id or item.get("Uid") or item.get("uid")
                primary_id = str(primary_id) if primary_id is not None else None

                model_name = (
                    item.get("Name")
                    or item.get("name")
                    or item.get("ModelName")
                    or item.get("modelName")
                    or repository_id
                )

                if owner and repository_id:
                    if "/" not in repository_id:
                        repository_id = f"{owner}/{repository_id}"
                    elif not repository_id.lower().startswith(owner.lower() + "/"):
                        repository_id = f"{owner}/{repository_id}"

                if (not repository_id or "/" not in repository_id) and owner and item.get("Name"):
                    repository_id = f"{owner}/{item.get('Name')}"

                display_name = repository_id or model_name

                normalized_items.append({
                    "id": repository_id or primary_id,
                    "repository_id": repository_id,
                    "numeric_id": numeric_id,
                    "name": display_name,
                    "owner": owner,
                    "description": item.get("Description")
                    or item.get("Desc")
                    or item.get("description"),
                    "tags": self._normalize_label_list(
                        item.get("Tags")
                        or item.get("TagNames")
                        or item.get("tags")
                        or []
                    ),
                    "tasks": self._normalize_label_list(
                        item.get("Tasks")
                        or item.get("tasks")
                        or []
                    ),
                    "downloads": item.get("DownloadCount")
                    or item.get("DownloadNum")
                    or item.get("downloads"),
                    "favourites": item.get("FollowerCount")
                    or item.get("FavoriteCount")
                    or item.get("favourites"),
                    "updated_at": item.get("GmtModified")
                    or item.get("UpdatedAt")
                    or item.get("updated_at"),
                    "publisher": owner
                    or item.get("publisher"),
                    "icon": item.get("Cover")
                    or item.get("CoverUrl")
                    or item.get("icon"),
                    "raw": item,
                })

            def _first_valid(candidates, fallback):
                for candidate in candidates:
                    if candidate is None:
                        continue
                    if isinstance(candidate, str) and not candidate.strip():
                        continue
                    return candidate
                return fallback

            def _to_int(value, fallback):
                try:
                    if isinstance(value, str):
                        value = value.replace(",", "").strip()
                    return int(float(value))
                except (TypeError, ValueError):
                    return fallback

            total_candidates = (
                model_data.get("Total"),
                model_data.get("total"),
                model_data.get("TotalCount"),
                model_data.get("totalCount"),
                data.get("Total"),
                data.get("total"),
                data.get("TotalCount"),
                data.get("totalCount"),
            )
            total_value = _first_valid(total_candidates, len(normalized_items))
            total = _to_int(total_value, len(normalized_items))

            page_candidates = (
                model_data.get("PageNumber"),
                model_data.get("pageNumber"),
                model_data.get("Page"),
                model_data.get("currentPage"),
                data.get("PageNumber"),
                data.get("pageNumber"),
                data.get("Page"),
                data.get("currentPage"),
            )
            page_value = _first_valid(page_candidates, page_number)
            page_value = _to_int(page_value, page_number)

            size_candidates = (
                model_data.get("PageSize"),
                model_data.get("pageSize"),
                model_data.get("Page_size"),
                model_data.get("page_size"),
                data.get("PageSize"),
                data.get("pageSize"),
                data.get("Page_size"),
                data.get("page_size"),
            )
            size_value = _first_valid(size_candidates, page_size)
            size_value = _to_int(size_value, page_size)

            return {
                "items": normalized_items,
                "total": total,
                "page": page_value,
                "page_size": size_value,
                "raw": response,
            }
        except Exception as e:
            logger.error(f"Failed to fetch ModelScope model list: {str(e)}")
            raise

    async def get_modelscope_model_detail(self, model_id: str) -> Dict[str, Any]:
        """获取单个ModelScope模型详情。兼容不同域名，同时防止GPUStack返回200但包体404的情况"""
        model_id_str = str(model_id).strip()
        encoded_model_id = quote(model_id_str, safe="/")

        candidate_urls = [
            f"https://www.modelscope.cn/api/v1/models/{encoded_model_id}",
            f"https://modelscope.cn/api/v1/models/{encoded_model_id}",
        ]

        last_error: Optional[Exception] = None

        for target_url in candidate_urls:
            try:
                response = await self._make_request(
                    "GET",
                    "/proxy",
                    params={"url": target_url},
                )

                if isinstance(response, str):
                    try:
                        response = json.loads(response)
                    except json.JSONDecodeError:
                        last_error = Exception(f"Unexpected response from GPUStack proxy: {response[:120]}")
                        continue

                status_candidates = [
                    response.get("Code"),
                    response.get("code"),
                    response.get("StatusCode"),
                    response.get("statusCode"),
                    response.get("status_code"),
                ]
                status_value = next((value for value in status_candidates if value is not None), 200)
                try:
                    status_int = int(status_value)
                except (TypeError, ValueError):
                    status_int = 200

                if status_int not in (0, 200):
                    message = (
                        response.get("Message")
                        or response.get("message")
                        or response.get("StatusMessage")
                        or response.get("status_message")
                        or "Unknown error"
                    )
                    last_error = Exception(f"GPUStack proxy returned status {status_int}: {message}")
                    continue

                data = response.get("Data") or response.get("data") or response

                readme_content = ""
                readme = (
                    data.get("Readme")
                    or data.get("readme")
                    or data.get("ReadMe")
                    or data.get("ReadMeContent")
                    or data.get("readMeContent")
                )
                if isinstance(readme, dict):
                    readme_content = (
                        readme.get("Content")
                        or readme.get("content")
                        or readme.get("Html")
                        or readme.get("html")
                    )
                elif isinstance(readme, str):
                    readme_content = readme

                path = data.get("Path") or data.get("path") or data.get("Namespace") or data.get("namespace")
                model_name = data.get("Name") or data.get("ModelName") or model_id
                repository_id = None
                if path and model_name:
                    repository_id = f"{path}/{model_name}"

                owner = (
                    data.get("Owner")
                    or data.get("owner")
                    or data.get("OwnerName")
                    or data.get("ownerName")
                    or data.get("UserName")
                    or data.get("userName")
                    or path
                )

                tags_raw = data.get("Tags") or data.get("TagNames") or []
                if isinstance(tags_raw, dict):
                    tags_raw = tags_raw.get("Items") or tags_raw.get("items") or []

                tasks_raw = data.get("Tasks") or data.get("TaskNames") or []
                if isinstance(tasks_raw, dict):
                    tasks_raw = tasks_raw.get("Items") or tasks_raw.get("items") or []

                return {
                    "id": repository_id or data.get("ModelId") or data.get("Id") or model_id,
                    "name": repository_id or model_name,
                    "repository_id": repository_id,
                    "path": path,
                    "owner": owner,
                    "description": data.get("Description") or data.get("Desc"),
                    "tags": self._normalize_label_list(tags_raw),
                    "tasks": self._normalize_label_list(tasks_raw),
                    "readme": readme_content,
                    "updated_at": data.get("LastUpdatedTime") or data.get("GmtModified"),
                    "raw": response,
                }

            except Exception as inner_error:
                last_error = inner_error
                continue

        error_message = str(last_error) if last_error else f"ModelScope detail not found for {model_id_str}"
        if model_id_str and model_id_str.isdigit():
            error_message = (
                f"ModelScope detail not found for numeric id {model_id_str}. "
                "请使用仓库格式（如 owner/model-name）。"
            )
        logger.error(f"Failed to fetch ModelScope model detail via GPUStack proxy: {error_message}")
        raise Exception(error_message)

    async def evaluate_modelscope_model(self, deployment_data: Dict[str, Any]) -> Dict[str, Any]:
        """评估 ModelScope 模型的部署可行性"""
        try:
            # 验证必需的参数
            model_scope_model_id = deployment_data.get("model_scope_model_id")
            if not model_scope_model_id:
                raise ValueError("model_scope_model_id 是必需的参数")
            
            # 处理可选的文件路径参数，确保不传递 None 值
            model_scope_file_path = deployment_data.get("model_scope_file_path")
            if model_scope_file_path is not None and not isinstance(model_scope_file_path, str):
                logger.warning(f"model_scope_file_path 应该是字符串类型，当前类型: {type(model_scope_file_path)}")
                model_scope_file_path = None
            
            spec = {
                "source": "model_scope",
                "name": deployment_data.get("name"),
                "description": deployment_data.get("description"),
                "model_scope_model_id": model_scope_model_id,
                "backend": self._normalize_backend(deployment_data.get("backend", "llama-box")),
                "replicas": deployment_data.get("replicas", 1),
                "categories": deployment_data.get("categories"),
                "backend_parameters": deployment_data.get("backend_parameters"),
                "env": deployment_data.get("environment_variables") or {},
                "restart_on_error": deployment_data.get("restart_on_error"),
                "placement_strategy": deployment_data.get("placement_strategy"),
                "worker_selector": deployment_data.get("worker_selector"),
                "cpu_offloading": deployment_data.get("cpu_offloading"),
                "distributed_inference_across_workers": deployment_data.get(
                    "distributed_inference_across_workers"
                ),
                "gpu_selector": deployment_data.get("gpu_selector"),
            }
            
            # 只有当 model_scope_file_path 不为 None 且不为空字符串时才添加到 spec 中
            if model_scope_file_path:
                spec["model_scope_file_path"] = model_scope_file_path

            if spec.get("cpu_offloading"):
                allow_offloading = self._is_cpu_offloading_allowed(
                    model_scope_model_id=model_scope_model_id,
                    model_scope_file_path=model_scope_file_path,
                    categories=spec.get("categories"),
                )
                if not allow_offloading:
                    logger.info(
                        "CPU offloading disabled during evaluation for non-GGUF model %s",
                        model_scope_model_id,
                    )
                    spec["cpu_offloading"] = False

            # 过滤掉 None 值，但保留空字符串和其他 falsy 值（除了 None）
            spec = {k: v for k, v in spec.items() if v is not None}

            payload = {"model_specs": [spec]}

            logger.info(f"评估 ModelScope 模型: {model_scope_model_id}, 文件路径: {model_scope_file_path}")
            
            response = await self._make_request(
                "POST",
                "/v2/model-evaluations",
                json=payload
            )

            # GPUStack 会在返回体中携带 error_message，而非直接抛出异常
            results = response.get("results") if isinstance(response, dict) else None
            if isinstance(results, list):
                for item in results:
                    if not isinstance(item, dict):
                        continue

                    error_message = item.get("error_message") or ""
                    if not isinstance(error_message, str):
                        continue

                    normalized_message = error_message.strip()
                    if not normalized_message:
                        continue

                    patterns = [
                        "expected str, bytes or os.PathLike object, not NoneType",
                        "Failed to get the file for model",
                    ]
                    if any(pattern in normalized_message for pattern in patterns):
                        friendly_message = (
                            "评估失败：GPUStack 未能定位模型文件。请在“模型文件”字段填写具体的权重文件路径"
                            "（例如 *.bin 或 *.gguf），然后重试评估。"
                        )
                        item["error_message"] = friendly_message

                        compatibility_messages = item.get("compatibility_messages")
                        if not isinstance(compatibility_messages, list):
                            compatibility_messages = [] if compatibility_messages is None else [str(compatibility_messages)]

                        hint = "需要提供具体的模型文件路径供部署节点下载。"
                        if hint not in compatibility_messages:
                            compatibility_messages.append(hint)
                        item["compatibility_messages"] = compatibility_messages

            return response
        except ValueError as ve:
            logger.error(f"参数验证失败: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Failed to evaluate ModelScope model: {str(e)}")
            # 检查是否是文件路径相关的错误
            error_msg = str(e)
            if "expected str, bytes or os.PathLike object, not NoneType" in error_msg:
                raise Exception(f"评估存在警告，请检查配置：模型文件路径配置错误，model_scope_file_path 参数不能为 None。请提供有效的文件路径或留空。")
            raise
    
    # 辅助方法
    async def _wait_for_model_ready(
        self,
        model_id: str,
        desired_replicas: int = 1,
        timeout: int = 30
    ) -> bool:
        """等待模型准备就绪，超时返回 False 而非抛异常"""
        if desired_replicas <= 0:
            return True

        start_time = datetime.now()

        while (datetime.now() - start_time).total_seconds() < timeout:
            try:
                response = await self._make_request(
                    "GET",
                    f"/v2/models/{model_id}"
                )

                ready_replicas = response.get("ready_replicas", 0)
                if ready_replicas >= desired_replicas:
                    return True

            except Exception:
                pass

            await asyncio.sleep(3)

        return False
    
    def _convert_to_deployment(self, model_data: Dict[str, Any]) -> Dict[str, Any]:
        """将GPUStack模型数据转换为部署格式"""
        name = model_data.get("name") or model_data.get("model_name", "")
        model_scope_model_id = model_data.get("model_scope_model_id")

        gpu_info = None
        gpu_selector = model_data.get("gpu_selector") or {}
        if isinstance(gpu_selector, dict):
            gpu_count = gpu_selector.get("gpu_count")
            gpu_ids = gpu_selector.get("gpu_ids")
            if isinstance(gpu_count, int):
                gpu_info = f"{gpu_count}"
            elif isinstance(gpu_ids, list):
                gpu_info = f"{len(gpu_ids)}"

        if gpu_info is None:
            computed_claim = model_data.get("computed_resource_claim") or {}
            if isinstance(computed_claim, dict):
                gpu_info = computed_claim.get("gpu")

        memory = "0Gi"
        cpu_cores = "0"
        if isinstance(model_data.get("computed_resource_claim"), dict):
            claim = model_data["computed_resource_claim"]
            memory = str(claim.get("memory", memory))
            cpu_cores = str(claim.get("cpu", cpu_cores))

        if isinstance(model_data.get("memory"), str):
            memory = model_data.get("memory") or memory
        if isinstance(model_data.get("cpu"), (int, str)):
            cpu_cores = str(model_data.get("cpu"))

        return {
            "id": str(model_data.get("id", "")),
            "name": name,
            "modelName": name,
            "status": self._get_deployment_status(model_data),
            "replicas": model_data.get("replicas")
            or model_data.get("desired_replicas", 0)
            or 0,
            "readyReplicas": model_data.get("ready_replicas")
            or model_data.get("running_replicas", 0)
            or 0,
            "gpu": gpu_info,
            "memory": memory,
            "cpuCores": cpu_cores,
            "createdAt": model_data.get("created_at", ""),
            "updatedAt": model_data.get("updated_at", ""),
            "endpoint": self._get_endpoint(model_data),
            "backendType": model_data.get("backend", "unknown"),
            "backendVersion": model_data.get("backend_version", "latest"),
            "description": model_data.get("description", ""),
            "source": model_data.get("source"),
            "modelScopeModelId": model_scope_model_id,
            "modelId": str(model_data.get("model_id") or model_data.get("id", "")),
        }
    
    def _convert_instances(self, instances: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """转换实例数据格式"""
        converted = []
        for instance in instances:
            converted.append({
                "id": str(instance.get("id", "")),
                "name": instance.get("name", ""),
                "status": instance.get("state", "unknown"),
                "node": instance.get("worker_name", "unknown"),
                "gpu": f"{instance.get('gpu_count', 0)} GPU(s)",
                "memory": instance.get("memory", "0"),
                "cpu": f"{instance.get('cpu', 0)} cores",
                "startTime": instance.get("created_at", "")
            })
        return converted

    async def _resolve_model_id(self, deployment_id: str) -> str:
        """根据部署ID解析模型ID，兼容传入实例ID的情况"""
        try:
            await self._make_request("GET", f"/v2/models/{deployment_id}")
            return str(deployment_id)
        except Exception:
            instance_response = await self._make_request(
                "GET",
                f"/v2/model-instances/{deployment_id}"
            )
            model_id = instance_response.get("model_id")
            if model_id is None:
                raise Exception("Unable to resolve model id from deployment identifier")
            return str(model_id)
    
    def _get_deployment_status(self, model_data: Dict[str, Any]) -> str:
        """获取部署状态"""
        # 优先使用instance的state字段
        if "state" in model_data:
            state = model_data.get("state", "unknown").lower()
            running_states = {"running", "ready", "active"}
            pending_states = {
                "pending",
                "initializing",
                "starting",
                "creating",
                "provisioning",
                "pulling",
                "downloading",
                "installing",
                "deploying",
                "queued",
                "preparing",
                "scaling",
                "updating",
            }
            stopped_states = {"stopped", "stopping", "terminated", "deleted", "inactive"}
            error_states = {"error", "failed", "crashed"}

            if state in running_states:
                return "running"
            elif state in stopped_states:
                return "stopped"
            elif state in pending_states:
                return "pending"
            elif state in error_states:
                return "error"
            else:
                # 未识别状态时，根据副本信息再判断
                return self._derive_status_from_replicas(model_data)
        
        # 如果没有state字段，使用replicas推断
        return self._derive_status_from_replicas(model_data)

    def _derive_status_from_replicas(self, model_data: Dict[str, Any]) -> str:
        """根据副本数推导状态"""
        replicas = model_data.get("replicas", 0)
        desired_replicas = (
            model_data.get("desired_replicas")
            or model_data.get("desiredReplicas")
            or replicas
        )
        ready_replicas = (
            model_data.get("ready_replicas", 0)
            or model_data.get("running_replicas", 0)
        )

        if desired_replicas and desired_replicas > 0:
            if ready_replicas >= desired_replicas:
                return "running"
            # 目标副本大于0但尚未就绪，认为正在部署
            return "pending"

        if replicas == 0 and desired_replicas == 0:
            return "stopped"
        if ready_replicas > 0:
            return "pending"
        return "pending"
    
    def _get_endpoint(self, model_data: Dict[str, Any]) -> str:
        """获取API端点"""
        if model_data.get("ready_replicas", 0) > 0:
            model_name = model_data.get("name", "")
            return f"{self.gpustack_url}/v1-openai/models/{model_name}"
        return ""
    
    def _format_metrics_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """格式化监控数据"""
        formatted = []
        for item in data:
            formatted.append({
                "time": datetime.fromtimestamp(item.get("timestamp", 0)).strftime("%H:%M:%S"),
                "value": item.get("value", 0)
            })
        return formatted
