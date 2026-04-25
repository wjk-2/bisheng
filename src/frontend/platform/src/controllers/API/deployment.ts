import axios from "../request";

/**
 * 模型部署API服务
 */

// 获取部署列表
export const getDeploymentListApi = async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
}) => {
    try {
        const response = await axios.get('/api/v1/deployment', { params });
        return response || { items: [], total: 0, page: 1, per_page: 10 };
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};

// 创建部署
export const createDeploymentApi = async (data: {
    name: string;
    modelScopeModelId: string;
    modelScopeFilePath?: string;
    backend: string;
    replicas: number;
    description?: string;
    categories?: string[];
    backendParameters?: string[];
    environmentVariables?: string;
    restartOnError?: boolean;
    placementStrategy?: string;
    workerSelector?: Record<string, unknown>;
    cpuOffloading?: boolean;
    distributedInferenceAcrossWorkers?: boolean;
    gpuSelector?: Record<string, unknown>;
}) => {
    const response = await axios.post('/api/v1/deployment', {
        name: data.name,
        model_scope_model_id: data.modelScopeModelId,
        model_scope_file_path: data.modelScopeFilePath,
        backend: data.backend,
        replicas: data.replicas,
        description: data.description,
        categories: data.categories ?? [],
        backend_parameters: data.backendParameters ?? [],
        environment_variables: data.environmentVariables,
        restart_on_error: data.restartOnError,
        placement_strategy: data.placementStrategy,
        worker_selector: data.workerSelector ?? {},
        cpu_offloading: data.cpuOffloading,
        distributed_inference_across_workers: data.distributedInferenceAcrossWorkers,
        gpu_selector: data.gpuSelector,
    });
    return response;
};

// 获取部署详情
export const getDeploymentDetailApi = async (deploymentId: string) => {
    const response = await axios.get(`/api/v1/deployment/${deploymentId}`);
    return response;
};

// 更新部署
export const updateDeploymentApi = async (deploymentId: string, data: {
    replicas?: number;
    environment_variables?: string;
    description?: string;
}) => {
    const response = await axios.put(`/api/v1/deployment/${deploymentId}`, data);
    return response;
};

// 删除部署
export const deleteDeploymentApi = async (deploymentId: string) => {
    const response = await axios.delete(`/api/v1/deployment/${deploymentId}`);
    return response;
};

// 启动部署
export const startDeploymentApi = async (deploymentId: string) => {
    const response = await axios.post(`/api/v1/deployment/${deploymentId}/start`);
    return response;
};

// 停止部署
export const stopDeploymentApi = async (deploymentId: string) => {
    const response = await axios.post(`/api/v1/deployment/${deploymentId}/stop`);
    return response;
};

// 获取部署实例
export const getDeploymentInstancesApi = async (deploymentId: string) => {
    const response = await axios.get(`/api/v1/deployment/${deploymentId}/instances`);
    return response;
};

// 获取部署监控数据
export const getDeploymentMetricsApi = async (deploymentId: string, timeRange: string = '1h') => {
    const response = await axios.get(`/api/v1/deployment/${deploymentId}/metrics`, {
        params: { time_range: timeRange }
    });
    return response;
};

// 获取部署日志
export const getDeploymentLogsApi = async (deploymentId: string, params?: {
    instance_id?: string;
    log_level?: string;
    lines?: number;
}) => {
    const response = await axios.get(`/api/v1/deployment/${deploymentId}/logs`, { params });
    return response;
};

// 获取可用资源
export const getAvailableResourcesApi = async () => {
    const response = await axios.get('/api/v1/deployment/resources/available');
    return response;
};

// Worker 列表
export const listWorkersApi = async (params?: Record<string, any>) => {
    const response = await axios.get('/api/v1/deployment/resources/workers', { params });
    return response;
};

// GPU 设备列表
export const listGpuDevicesApi = async (params?: Record<string, any>) => {
    const response = await axios.get('/api/v1/deployment/resources/gpus', { params });
    return response;
};

// 获取可部署的模型列表
export const getAvailableModelsApi = async () => {
    const response = await axios.get('/api/v1/deployment/models/available');
    return response;
};

// ModelScope 模型列表
export const listModelScopeModelsApi = async (payload: {
    page_number?: number;
    page_size?: number;
    name?: string;
    tags?: string[];
    tasks?: string[];
    sort_by?: string;
}) => {
    const response = await axios.post('/api/v1/deployment/modelscope/list', payload);
    return response;
};

// ModelScope 模型详情
export const getModelScopeModelDetailApi = async (modelId: string) => {
    const response = await axios.get('/api/v1/deployment/modelscope/detail', {
        params: { model_id: modelId }
    });
    return response;
};

// ModelScope 模型部署评估
export const evaluateModelScopeModelApi = async (data: {
    name: string;
    modelScopeModelId: string;
    modelScopeFilePath?: string;
    backend: string;
    replicas: number;
    description?: string;
    categories?: string[];
    backendParameters?: string[];
    environmentVariables?: string;
    restartOnError?: boolean;
    placementStrategy?: string;
    workerSelector?: Record<string, unknown>;
    cpuOffloading?: boolean;
    distributedInferenceAcrossWorkers?: boolean;
    gpuSelector?: Record<string, unknown>;
}) => {
    const response = await axios.post('/api/v1/deployment/modelscope/evaluate', {
        name: data.name,
        model_scope_model_id: data.modelScopeModelId,
        model_scope_file_path: data.modelScopeFilePath,
        backend: data.backend,
        replicas: data.replicas,
        description: data.description,
        categories: data.categories ?? [],
        backend_parameters: data.backendParameters ?? [],
        environment_variables: data.environmentVariables,
        restart_on_error: data.restartOnError,
        placement_strategy: data.placementStrategy,
        worker_selector: data.workerSelector ?? {},
        cpu_offloading: data.cpuOffloading,
        distributed_inference_across_workers: data.distributedInferenceAcrossWorkers,
        gpu_selector: data.gpuSelector,
    });
    return response;
};
