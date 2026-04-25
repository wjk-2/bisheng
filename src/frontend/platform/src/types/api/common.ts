/**
 * 通用 API 响应类型定义
 *
 * 后端统一响应格式 (schemas.py UnifiedResponseModel):
 * {
 *   status_code: number,
 *   status_message: string,
 *   data: T
 * }
 *
 * 前端 axios 拦截器已解包，直接返回 data 字段
 */

/** 分页响应 - 通用结构 */
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
}

/** 列表响应 - 无分页 */
export interface ListResponse<T> {
    data: T[];
    total?: number;
}

/** 单条记录响应 */
export interface SingleResponse<T> {
    data: T;
}

/** 空响应（仅状态码） */
export type EmptyResponse = void;

/** 通用键值对 */
export interface KeyValue {
    key: string;
    value: string;
}

/** 通用 ID 参数 */
export interface IdParam {
    id: string | number;
}

/** 分页请求参数 */
export interface PaginationParams {
    page_num?: number;
    page_size?: number;
}

/** 搜索参数 */
export interface SearchParams {
    name?: string;
    keyword?: string;
}

/** 带标签的搜索参数 */
export interface TaggedSearchParams extends SearchParams {
    tag_id?: number | string;
}

/** 验证码响应 */
export interface CaptchaResponse {
    captcha_key: string;
    captcha: string;
}

/** 公钥响应 */
export interface PublicKeyResponse {
    public_key: string;
}

/** 文件上传响应 */
export interface FileUploadResponse {
    file_path: string;
    flowId?: string;
    relative_path?: string;
    repeat?: boolean;
    repeat_update_time?: string;
}

/** 版本信息响应 */
export interface VersionResponse {
    version: string;
    package?: string;
}

/** 操作结果响应 */
export interface OperationResult {
    success: boolean;
    message?: string;
}

/** GPU 信息 */
export interface GPUInfo {
    id: number;
    name: string;
    memory_total?: number;
    memory_used?: number;
    memory_free?: number;
    utilization?: number;
}

/** Worker 信息 */
export interface WorkerInfo {
    id: string;
    name: string;
    status: string;
    gpu_count?: number;
    gpus?: GPUInfo[];
}

/** 模型信息 */
export interface ModelInfo {
    id: string;
    name: string;
    type?: string;
    status?: string;
    size?: number;
}

/** ModelScope 模型 */
export interface ModelScopeModel {
    id: string;
    name: string;
    owner: string;
    task?: string;
    tags?: string[];
    downloads?: number;
    likes?: number;
}

/** ModelScope 模型详情 */
export interface ModelScopeModelDetail {
    id: string;
    name: string;
    owner: string;
    description?: string;
    files?: ModelScopeFile[];
    tasks?: string[];
    tags?: string[];
}

/** ModelScope 文件 */
export interface ModelScopeFile {
    name: string;
    path: string;
    size?: number;
    type?: string;
}

/** 部署实例 */
export interface DeploymentInstance {
    id: string;
    deployment_id: string;
    status: string;
    worker_id?: string;
    gpu_ids?: number[];
    created_at?: string;
    updated_at?: string;
}

/** 部署监控指标 */
export interface DeploymentMetrics {
    requests_per_second?: number;
    avg_latency_ms?: number;
    gpu_utilization?: number;
    memory_used_mb?: number;
    timestamps?: string[];
    values?: number[];
}

/** 部署日志 */
export interface DeploymentLog {
    timestamp: string;
    level: string;
    message: string;
    instance_id?: string;
}

/** 可用资源 */
export interface AvailableResources {
    workers: WorkerInfo[];
    gpus: GPUInfo[];
    models: ModelInfo[];
}

/** 部署项 */
export interface Deployment {
    id: string;
    name: string;
    description?: string;
    model_scope_model_id: string;
    model_scope_file_path?: string;
    backend: string;
    replicas: number;
    status: string;
    categories?: string[];
    created_at: string;
    updated_at: string;
}

/** 部署创建参数 */
export interface DeploymentCreateParams {
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
}

/** 部署更新参数 */
export interface DeploymentUpdateParams {
    replicas?: number;
    environment_variables?: string;
    description?: string;
}

/** ============ 认证相关 ============ */

/** 公钥响应 */
export interface PublicKeyResponse {
    public_key: string;
}

/** 验证码响应 */
export interface CaptchaResponse {
    captcha_key: string;
    captcha: string;
}

/** ============ 系统配置 ============ */

/** 系统配置响应 */
export interface SysConfigResponse {
    [key: string]: unknown;
}

/** ============ 用户组相关 ============ */

/** 用户组项 */
export interface UserGroupItem {
    id: number;
    group_name: string;
    group_admins: number[];
    create_time: string;
    update_time: string;
}

/** 用户组列表响应 */
export interface UserGroupListResponse {
    data: UserGroupItem[];
    total: number;
}

/** ============ 角色相关 ============ */

/** 角色技能/资源请求参数 */
export interface RoleResourceParams {
    role_id: number | string;
    name?: string;
    page_num?: number;
    page_size?: number;
}

/** 角色权限项 */
export interface RolePermissionItem {
    id: number;
    role_id: number;
    access_id: number;
    type: number;
    create_time?: string;
    update_time?: string;
}

/** 创建角色参数 */
export interface CreateRoleParams {
    group_id: number | string;
    role_name: string;
    remark?: string;
}

/** 更新角色权限参数 */
export interface UpdateRolePermissionsParams {
    role_id: number;
    access_id: number[];
    type: number;
}

/** ============ 表单类型 ============ */

/** 用户组表单 */
export interface UserGroupForm {
    groupName: string;
}

/** 选项项 */
export interface SelectOption {
    value: number | string;
    label: string;
}
