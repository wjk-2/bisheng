import { AssistantDetail } from '@/types/assistant';
import { PaginatedResponse } from '../../types/api/common';
import axios from "../request";

export interface AssistantItemDB {
    create_time: string;
    desc: string;
    id: string;
    logo?: string;
    name: string;
    update_time: string;
    user_id: number;
    user_name: string;
    status: number;
}

/** 助手列表响应 */
export interface AssistantListResponse {
    data: AssistantItemDB[];
    total: number;
}

/** 获取助手列表参数 */
export interface GetAssistantsParams {
    page: number;
    limit: number;
    name: string;
    tag_id: number | null;
}

// 获取助手列表
export const getAssistantsApi = async (
    page: number,
    limit: number,
    name: string,
    tag_id: number
): Promise<PaginatedResponse<AssistantItemDB>> => {
    return await axios.get(`/api/v1/assistant`, {
        params: {
            page, limit, name,
            tag_id: tag_id === -1 ? null : tag_id
        }
    });
};

/** 创建助手参数 */
export interface CreateAssistantParams {
    name: string;
    prompt: string;
    logo?: string;
}

// 创建助手
export const createAssistantsApi = async (
    name: string,
    prompt: string,
    url?: string
): Promise<void> => {
    if (url) {
        // logo保存相对路径
        url = url.replace('/eagent', '')
    }
    return await axios.post(`/api/v1/assistant`, { name, prompt, logo: url })
};

/** 获取助手详情参数 */
export interface GetAssistantDetailParams {
    id: string | number;
    version?: string;
}

// 获取助手详情
export const getAssistantDetailApi = async (
    id: string | number,
    version?: string
): Promise<AssistantDetail> => {
    return await axios.get(`/api/${version || 'v1'}/assistant/info/${id}`)
};

/** 助手模型响应 */
export interface AssistantModelsResponse {
    [key: string]: {
        id: string;
        name: string;
        type?: string;
    };
}

// 获取助手系统模型
export const getAssistantModelsApi = async (): Promise<AssistantModelsResponse> => {
    return await axios.get(`/api/v1/assistant/models`)
};

/** 变更助手状态参数 */
export interface ChangeAssistantStatusParams {
    id: string | number;
    status: number;
    is_public?: number;
    category?: string;
}

// 上下线助手（支持公开设置和分类）
export const changeAssistantStatusApi = async (
    id: string | number,
    status: number,
    is_public: number = 0,
    category: string = '其他'
): Promise<void> => {
    return await axios.post(`/api/v1/assistant/status`, { id, status, is_public, category })
};

/** 保存助手参数 */
export interface SaveAssistantParams
    extends Omit<AssistantDetail, 'flow_list' | 'tool_list' | 'knowledge_list'> {
    flow_list: string[];
    tool_list: number[];
    knowledge_list: number[];
}

// 保存助手
export const saveAssistanttApi = async (
    data: SaveAssistantParams
): Promise<void> => {
    return await axios.put(`/api/v1/assistant`, data)
}

// 删除助手
export const deleteAssistantApi = async (id: string | number): Promise<void> => {
    return await axios.post(`/api/v1/assistant/delete?assistant_id=${id}`)
}

/** 获取会话列表参数 */
export interface GetChatOnlineParams {
    page: number;
    keyword: string;
    tag_id: number | string | null;
    category?: string | null;
}

/** 在线会话响应 */
export interface ChatOnlineResponse {
    data: Array<{
        id: string;
        name: string;
        logo?: string;
        description?: string;
        status: number;
        category?: string;
    }>;
    total: number;
}

// 获取会话选择列表（支持分类筛选）
export const getChatOnlineApi = async (
    page: number,
    keyword: string,
    tag_id: number | string,
    category: string | null = null
): Promise<ChatOnlineResponse> => {
    return await axios.get(`/api/v1/chat/online`, {
        params: {
            page, keyword,
            limit: 40,
            tag_id: tag_id === -1 ? null : tag_id,
            category: category || null
        }
    })
}

// 刷新mcp服务
export const refreshMcpApi = async (): Promise<void> => {
    return await axios.post(`/api/v1/tool/mcp/refresh`)
}

/** 获取自动优化任务参数 */
export interface GetOptimizeTaskParams {
    assistant_id: string | number;
    prompt: string;
}

/** 优化任务响应 */
export interface OptimizeTaskResponse {
    task_id: string;
}

// 获取自动优化任务taskid
export const getAssistantOptimizeTaskApi = async (
    assistant_id: string | number,
    prompt: string
): Promise<OptimizeTaskResponse> => {
    return await axios.post(`/api/v1/assistant/auto/task`, { assistant_id, prompt })
}
