from typing import List, Literal, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from pydantic import BaseModel, Field
from datetime import datetime
from loguru import logger

from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.api.v1.schemas import resp_200, resp_500, resp_404
from bisheng.api.services.deployment import get_gpustack_service
from bisheng.api.services.deployment_bridge import DeploymentBridgeService


def _parse_env_string(raw_env: Optional[str]) -> Dict[str, str]:
    """将 KEY=VALUE 格式字符串解析为字典"""
    if not raw_env:
        return {}

    env_map: Dict[str, str] = {}
    separators = ['\n', '\r', ' ']
    # 先按换行切分，再降级为空格
    candidates = []
    for line in raw_env.replace('\r', '\n').split('\n'):
        stripped = line.strip()
        if not stripped:
            continue
        candidates.extend(part for part in stripped.split(' ') if part)

    for item in candidates:
        if '=' not in item:
            continue
        key, value = item.split('=', 1)
        key = key.strip()
        if not key:
            continue
        env_map[key] = value.strip()
    return env_map

router = APIRouter(prefix='/deployment', tags=['Model Deployment'])

# Pydantic models for request/response
class DeploymentCreate(BaseModel):
    """创建部署请求（ModelScope 模型）"""
    name: str = Field(..., description="部署名称")
    model_scope_model_id: str = Field(..., description="ModelScope 仓库 ID")
    model_scope_file_path: Optional[str] = Field(None, description="ModelScope 文件路径")
    backend: str = Field("vllm", description="推理后端类型")
    replicas: int = Field(1, ge=0, description="副本数")
    description: Optional[str] = Field("", description="描述")
    categories: List[str] = Field(default_factory=list, description="模型标签")
    backend_parameters: List[str] = Field(default_factory=list, description="后端参数")
    environment_variables: Optional[str] = Field(
        default=None,
        description="环境变量配置，使用换行或空格分隔的 KEY=VALUE",
    )
    restart_on_error: bool = Field(True, description="错误时自动重启")
    placement_strategy: str = Field("spread", description="调度策略")
    worker_selector: Dict[str, Any] = Field(default_factory=dict, description="Worker 选择器")
    cpu_offloading: bool = Field(False, description="是否开启 CPU Offloading")
    distributed_inference_across_workers: bool = Field(False, description="是否跨 Worker 分布式推理")
    gpu_selector: Optional[Dict[str, Any]] = Field(None, description="GPU 选择器")

class DeploymentUpdate(BaseModel):
    """更新部署请求"""
    replicas: Optional[int] = Field(None, description="副本数")
    description: Optional[str] = Field(None, description="描述")
    environment_variables: Optional[str] = Field(
        default=None,
        description="环境变量配置，使用换行或空格分隔的 KEY=VALUE",
    )

class DeploymentResponse(BaseModel):
    """部署响应"""
    id: str
    name: str
    model_name: str
    status: str
    replicas: int
    ready_replicas: int
    gpu: Optional[str]
    memory: Optional[str]
    cpu_cores: Optional[str]
    created_at: str
    updated_at: str
    endpoint: str
    backend_type: str
    backend_version: Optional[str]
    description: str
    source: Optional[str] = None
    model_scope_model_id: Optional[str] = None

class DeploymentInstance(BaseModel):
    """部署实例"""
    id: str
    name: str
    status: str
    node: str
    gpu: str
    memory: str
    cpu: str
    start_time: str

class DeploymentDetail(DeploymentResponse):
    """部署详情"""
    instances: List[DeploymentInstance]

class MetricsData(BaseModel):
    """监控数据"""
    gpu: List[Dict[str, Any]]
    memory: List[Dict[str, Any]]
    cpu: List[Dict[str, Any]]
    requests: List[Dict[str, Any]]


class ModelScopeListRequest(BaseModel):
    """ModelScope 模型列表查询参数"""
    page_number: int = Field(1, ge=1, description="页码")
    page_size: int = Field(10, ge=1, le=100, description="每页数量")
    name: Optional[str] = Field(None, description="模型名称关键词")
    tags: List[str] = Field(default_factory=list, description="标签过滤")
    tasks: List[str] = Field(default_factory=list, description="任务类型过滤")
    sort_by: str = Field("Default", description="排序方式")


@router.get('', summary="获取部署列表")
async def get_deployments(
    login_user: UserPayload = Depends(UserPayload.get_login_user),
    page: int = Query(1, description="页码"),
    per_page: int = Query(10, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词")
):
    """获取模型部署列表"""
    try:
        service = get_gpustack_service()
        deployments = await service.list_deployments(
            user_id=login_user.user_id,
            page=page,
            per_page=per_page,
            search=search
        )

        # 批量同步状态并标注 llm_registered / llm_server_id（一次 DB 查询替代 N*2 次）
        await DeploymentBridgeService.batch_sync_and_annotate(deployments.get("items", []))

        return resp_200(data=deployments)
    except Exception as e:
        logger.exception(f"Error in get_deployments: {e}")
        return resp_500(message="Internal server error")


@router.post('', summary="创建部署")
async def create_deployment(
    deployment: DeploymentCreate,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    """创建新的模型部署"""
    try:
        logger.info(f"Creating deployment '{deployment.name}' by user {login_user.user_id}")
        service = get_gpustack_service()
        deployment_payload = deployment.model_dump()
        deployment_payload["environment_variables"] = _parse_env_string(
            deployment_payload.get("environment_variables")
        )
        result = await service.create_deployment(
            user_id=login_user.user_id,
            deployment_data=deployment_payload
        )
        logger.info(f"Deployment '{deployment.name}' created successfully")
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f"Error in create_deployment: {e}")
        return resp_500(message="Internal server error")


@router.post('/modelscope/list', summary="获取 ModelScope 模型列表")
async def list_modelscope_models(
    payload: ModelScopeListRequest,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    try:
        service = get_gpustack_service()
        data = await service.list_modelscope_models(
            page_number=payload.page_number,
            page_size=payload.page_size,
            name=payload.name,
            tags=payload.tags,
            tasks=payload.tasks,
            sort_by=payload.sort_by,
        )
        return resp_200(data=data)
    except Exception as e:
        logger.exception(f"Error in list_modelscope_models: {e}")
        return resp_500(message="Internal server error")


@router.get('/modelscope/detail', summary="获取 ModelScope 模型详情")
async def get_modelscope_model_detail(
    model_id: str = Query(..., description="ModelScope 仓库 ID"),
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    try:
        service = get_gpustack_service()
        data = await service.get_modelscope_model_detail(model_id)
        return resp_200(data=data)
    except Exception as e:
        logger.exception(f"Error in get_modelscope_model_detail: {e}")
        return resp_500(message="Internal server error")


@router.post('/modelscope/evaluate', summary="评估 ModelScope 模型部署可行性")
async def evaluate_modelscope_model(
    payload: DeploymentCreate,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    try:
        service = get_gpustack_service()
        evaluate_payload = payload.model_dump()
        evaluate_payload["environment_variables"] = _parse_env_string(
            evaluate_payload.get("environment_variables")
        )
        result = await service.evaluate_modelscope_model(evaluate_payload)
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f"Error in evaluate_modelscope_model: {e}")
        return resp_500(message="Internal server error")


@router.get('/resources/available', summary="获取可用资源")
async def get_available_resources(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取可用的GPU资源"""
    try:
        service = get_gpustack_service()
        resources = await service.get_available_resources()
        return resp_200(data=resources)
    except Exception as e:
        logger.exception(f"Error in get_available_resources: {e}")
        return resp_500(message="Internal server error")


@router.get('/resources/workers', summary="获取 Worker 列表")
async def list_workers(
    request: Request,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    try:
        service = get_gpustack_service()
        params = dict(request.query_params)
        # 将分页参数转换为整数
        for key in ["page", "per_page", "cluster_id"]:
            if key in params:
                try:
                    params[key] = int(params[key])
                except (TypeError, ValueError):
                    params.pop(key, None)
        workers = await service.list_workers(params)
        return resp_200(data=workers)
    except Exception as e:
        logger.exception(f"Error in list_workers: {e}")
        return resp_500(message="Internal server error")


@router.get('/resources/gpus', summary="获取 GPU 设备列表")
async def list_gpu_devices(
    request: Request,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    try:
        service = get_gpustack_service()
        params = dict(request.query_params)
        for key in ["page", "per_page", "worker_id"]:
            if key in params:
                try:
                    params[key] = int(params[key])
                except (TypeError, ValueError):
                    params.pop(key, None)
        gpu_devices = await service.list_gpu_devices(params)
        return resp_200(data=gpu_devices)
    except Exception as e:
        logger.exception(f"Error in list_gpu_devices: {e}")
        return resp_500(message="Internal server error")


@router.get('/models/available', summary="获取可部署的模型列表")
async def get_available_models(
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取可用于部署的模型列表"""
    try:
        service = get_gpustack_service()
        models = await service.get_available_models()
        return resp_200(data=models)
    except Exception as e:
        logger.exception(f"Error in get_available_models: {e}")
        return resp_500(message="Internal server error")


@router.get('/{deployment_id}', summary="获取部署详情")
async def get_deployment_detail(
    deployment_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取部署详细信息"""
    try:
        service = get_gpustack_service()
        deployment = await service.get_deployment(
            user_id=login_user.user_id,
            deployment_id=deployment_id
        )
        if not deployment:
            # 返回包装的404错误，而不是抛出HTTPException
            return resp_404(message="Deployment not found")
        return resp_200(data=deployment)
    except Exception as e:
        logger.exception(f"Error in get_deployment_detail: {e}")
        return resp_500(message="Internal server error")


@router.put('/{deployment_id}', summary="更新部署")
async def update_deployment(
    deployment_id: str,
    deployment: DeploymentUpdate,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    """更新部署配置"""
    try:
        logger.info(f"Updating deployment {deployment_id} by user {login_user.user_id}")
        service = get_gpustack_service()
        update_payload = deployment.model_dump(exclude_none=True)
        if "environment_variables" in update_payload:
            update_payload["environment_variables"] = _parse_env_string(
                update_payload.get("environment_variables")
            )
        result = await service.update_deployment(
            user_id=login_user.user_id,
            deployment_id=deployment_id,
            deployment_data=update_payload
        )
        logger.info(f"Deployment {deployment_id} updated successfully")
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f"Error in update_deployment: {e}")
        return resp_500(message="Internal server error")


@router.delete('/{deployment_id}', summary="删除部署")
async def delete_deployment(
    deployment_id: str,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    """删除部署"""
    try:
        logger.info(f"Deleting deployment {deployment_id} by user {login_user.user_id}")
        service = get_gpustack_service()
        await service.delete_deployment(
            user_id=login_user.user_id,
            deployment_id=deployment_id
        )
        logger.info(f"Deployment {deployment_id} deleted successfully")
        return resp_200(message="Deployment deleted successfully")
    except Exception as e:
        logger.exception(f"Error in delete_deployment: {e}")
        return resp_500(message="Internal server error")


@router.post('/{deployment_id}/start', summary="启动部署")
async def start_deployment(
    deployment_id: str,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    """启动部署"""
    try:
        service = get_gpustack_service()
        result = await service.start_deployment(
            user_id=login_user.user_id,
            deployment_id=deployment_id
        )
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f"Error in start_deployment: {e}")
        return resp_500(message="Internal server error")


@router.post('/{deployment_id}/stop', summary="停止部署")
async def stop_deployment(
    deployment_id: str,
    login_user: UserPayload = Depends(UserPayload.get_admin_user)
):
    """停止部署"""
    try:
        service = get_gpustack_service()
        result = await service.stop_deployment(
            user_id=login_user.user_id,
            deployment_id=deployment_id
        )
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f"Error in stop_deployment: {e}")
        return resp_500(message="Internal server error")


@router.get('/{deployment_id}/instances', summary="获取部署实例")
async def get_deployment_instances(
    deployment_id: str,
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取部署的所有实例"""
    try:
        service = get_gpustack_service()
        instances = await service.get_deployment_instances(
            user_id=login_user.user_id,
            deployment_id=deployment_id
        )
        return resp_200(data=instances)
    except Exception as e:
        logger.exception(f"Error in get_deployment_instances: {e}")
        return resp_500(message="Internal server error")


@router.get('/{deployment_id}/metrics', summary="获取部署监控数据")
async def get_deployment_metrics(
    deployment_id: str,
    time_range: Literal["1h", "6h", "24h", "7d", "30d"] = Query("1h", description="时间范围: 1h, 6h, 24h, 7d, 30d"),
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取部署的监控指标数据"""
    try:
        service = get_gpustack_service()
        metrics = await service.get_deployment_metrics(
            user_id=login_user.user_id,
            deployment_id=deployment_id,
            time_range=time_range
        )
        return resp_200(data=metrics)
    except Exception as e:
        logger.exception(f"Error in get_deployment_metrics: {e}")
        return resp_500(message="Internal server error")


@router.get('/{deployment_id}/logs', summary="获取部署日志")
async def get_deployment_logs(
    deployment_id: str,
    instance_id: Optional[str] = Query(None, description="实例ID"),
    log_level: Optional[Literal["debug", "info", "warning", "error", "critical", "all"]] = Query("all", description="日志级别"),
    lines: int = Query(100, description="日志行数"),
    login_user: UserPayload = Depends(UserPayload.get_login_user)
):
    """获取部署日志"""
    try:
        service = get_gpustack_service()
        logs = await service.get_deployment_logs(
            user_id=login_user.user_id,
            deployment_id=deployment_id,
            instance_id=instance_id,
            log_level=log_level,
            lines=lines
        )
        return resp_200(data=logs)
    except Exception as e:
        logger.exception(f"Error in get_deployment_logs: {e}")
        return resp_500(message="Internal server error")
