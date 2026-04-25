import { ReactFlowJsonObject } from "@xyflow/react";
import { FlowStyleType, FlowType, FlowVersionItem } from "../../types/flow";
import axios from "../request";

/** 变量保存请求参数 */
export interface VariableSaveParams {
    flow_id: string | number;
    node_id: string;
    variable_name: string;
    value_type: number;
    value: string | number;
    is_option?: number;
    id?: string | number;
}

/**
 * 保存组件 variables 变量
 */
export function saveVariableApi(data: VariableSaveParams): Promise<{ id: string }> {
    return axios.post(`/api/v1/variable/`, data);
}

export const enum VariableType {
    /** 文本 */
    Text = "text",
    /** 下拉框 */
    Select = "select",
    /** 文件 */
    File = "file"
}
export interface Variable {
    id: string | number;
    update: boolean;
    name: string;
    maxLength: number;
    type: VariableType;
    nodeId: string;
    required: boolean;
    options: {
        key: string;
        value: string;
    }[];
    value?: string;
}
/** 获取变量列表参数 */
export interface GetVariablesParams {
    flow_id: string | number;
    node_id?: string;
}

/** 后端返回的变量项 */
interface VariableResponse {
    id: string | number;
    variable_name: string;
    node_id: string;
    value_type: number;
    value: string;
    is_option: number;
}

/**
 * get组件 variables 变量
 * params flow_id, node_id
 */
export function getVariablesApi(params: GetVariablesParams): Promise<Variable[]> {
    return (axios.get(`/api/v1/variable/list`, { params }) as Promise<VariableResponse[]>).then(res => {
        return res.map((item) => {
            const types = ['', VariableType.Text, VariableType.Select, VariableType.File]
            return {
                id: item.id,
                update: true,
                name: item.variable_name,
                type: types[item.value_type],
                nodeId: item.node_id,
                required: item.is_option === 1,
                maxLength: item.value_type === 1 ? item.value : '',
                options: item.value_type === 2 ? item.value
                    .split(',')
                    .map((op, i) => ({ key: String(i), value: op })) : [],
                value: ''
            }
        })
    });
}

/**
 * 删除 变量
 */
export function delVariableApi(id: string | number): Promise<void> {
    return axios.delete(`/api/v1/variable/del`, {
        params: { id }
    });
}

/**
 * 保存变量和filenodename必填和排序信息
 */
export function saveReportFormApi(vid: number | string, flowId: string | number, data: Variable[]): Promise<void> {
    const _data = data.map((item) => {
        const { id, maxLength, name: variable_name, nodeId: node_id, options, required, type } = item
        const types = {
            [VariableType.Text]: () => ({ type: 1, value: maxLength }),
            [VariableType.Select]: () => ({ type: 2, value: options.map((op) => op.value).join(',') }),
            [VariableType.File]: () => ({ type: 3, value: "0" }),
        }
        const typeInfo = types[type]()
        return {
            id,
            version_id: vid,
            flow_id: flowId,
            node_id,
            is_option: Number(required),
            variable_name,
            value_type: typeInfo.type,
            value: typeInfo.value
        }
    })
    return axios.post(`/api/v1/variable/save_all`, _data);
}

/**
 * 初始化 file key 与 flowId的关系
 */
// export function initFileKeyApi(flow_id, key) {
//     return axios.post(`/api/v1/report/save_template`, { key, flow_id });
// }

/**
 * 获取 report表单信息
 */
export function getReportFormApi(flow_id: string | number): Promise<unknown> {
    return axios.get(`/api/v1/report/report_temp`, {
        params: { flow_id }
    })
}

/**
 * Fetches a flow from the database by ID.
 *
 * @param {string} flowId - The ID of the flow to fetch.
 * @param {string} version - API version, default 'v1'
 * @returns {Promise<FlowType>} The flow data.
 * @throws Will throw an error if fetching fails.
 */
export async function getFlowApi(flowId: string, version: string = 'v1'): Promise<FlowType> {
    return await axios.get(`/api/${version}/flows/${flowId}`)
}

/**
 * 删除的技能 工作流详情
 */
export async function getDeleteFlowApi(chatId: string): Promise<FlowType> {
    return await axios.get(`/api/v1/chat/info?chat_id=${chatId}`)
}

/**
 * Saves a new flow to the database.
 *
 * @param {FlowType} newFlow - The flow data to save.
 * @returns {Promise<FlowType>} The saved flow data.
 * @throws Will throw an error if saving fails.
 */
export async function saveFlowToDatabase(newFlow: {
    name: string;
    id: string;
    data: ReactFlowJsonObject;
    description: string;
    style?: FlowStyleType;
}): Promise<FlowType> {
    const id = newFlow.id ? { flow_id: newFlow.id } : {}
    const response: FlowType = await axios.post("/api/v1/flows/", {
        ...id,
        name: newFlow.name,
        data: newFlow.data,
        description: newFlow.description,
    });
    return response
}

/**
* Reads all flows from the database.
*
* @returns The flows data.
* @throws Will throw an error if reading fails.
*/
export async function readFlowsFromDatabase(page: number = 1, pageSize: number = 20, search: string, tag_id = -1) {
    const tagIdStr = tag_id === -1 ? '' : `&tag_id=${tag_id}`
    const { data, total }: { data: FlowType[], total: number } = await axios.get(`/api/v1/flows/?page_num=${page}&page_size=${pageSize}&name=${search}${tagIdStr}`);
    return { data, total };
}

/* app list */
export async function getAppsApi({ page = 1, pageSize = 20, keyword, tag_id = -1, type, managed }) {
    const tagIdStr = tag_id === -1 ? '' : `&tag_id=${tag_id}`
    const map = { assistant: 5, skill: 1, flow: 10 }
    const flowType = map[type] ? `&flow_type=${map[type]}` : ''
    const managedStr = (managed !== undefined && managed !== null && managed !== '')
        ? `&managed=${managed}`
        : '';
    const { data, total }: { data: FlowType[], total: number } = await axios.get(`/api/v1/workflow/list?page_num=${page}&page_size=${pageSize}&name=${keyword}${tagIdStr}${flowType}${managedStr}`);
    const newData = data.map(item => {
        if (item.flow_type !== 5) return item
        return {
            ...item,
            version_list: item.version_list || [],
        }
    })
    return { data: newData, total };
}

/**
 * Deletes a flow from the database.
 *
 * @param {string} flowId - The ID of the flow to delete.
 * @returns The deleted flow data.
 * @throws Will throw an error if deletion fails.
 */
export async function deleteFlowFromDatabase(flowId: string) {
    return await axios.delete(`/api/v1/flows/${flowId}`);
}

/**
 * 创建自定义技能
 * @param 技能名称 技能描述
 * @param 创建人
 */
export const createCustomFlowApi = async (params: {
    logo: string,
    name: string,
    description: string,
    guide_word: string
}, userName: string) => {
    if (params.logo) {
        // logo保存相对路径
        params.logo = params.logo.replace(/^\/\w+/, '')
    }
    const response: FlowType = await axios.post("/api/v1/flows/", {
        ...params,
        data: null
    });

    return {
        ...response,
        write: true,
        status: 1,
        user_name: userName
    }
};

/**
 * 修改技能数据.
 *
 * @param {FlowType} updatedFlow - The updated flow data.
 * @returns {Promise<FlowType>} The updated flow data.
 * @throws Will throw an error if the update fails.
 */
export async function updateFlowApi(
    updatedFlow: FlowType
): Promise<FlowType> {
    if (updatedFlow.logo) {
        // logo保存相对路径
        updatedFlow.logo = updatedFlow.logo.replace(/^\/\w+/, '')
    }
    return await axios.patch(`/api/v1/flows/${updatedFlow.id}`, {
        logo: updatedFlow.logo || '',
        name: updatedFlow.name,
        data: updatedFlow.data,
        description: updatedFlow.description,
        guide_word: updatedFlow.guide_word
    });
}

/**
 * 上下线
 */
export async function updataOnlineState(
    id: string | number,
    updatedFlow: Pick<FlowType, 'name' | 'description'>,
    open: boolean,
    isPublic: number = 0,
    category: string = '其他'
): Promise<void> {
    const payload: Record<string, any> = {
        name: updatedFlow.name,
        description: updatedFlow.description,
        status: open ? 2 : 1,
    };
    // 仅上线时携带可见范围和分类，避免下线误覆盖已有配置
    if (open) {
        payload.is_public = isPublic;
        payload.category = category;
    }
    return await axios.patch(`/api/v1/flows/${id}`, payload);
}

/**
 * 获取在线技能列表.
 *
 * @returns The online flows data.
 * @throws .
 */
export async function readOnlineFlows(page: number = 1, searchKey: string = "") {
    const data: { data: FlowType[], total: number } = await axios.get(`/api/v1/flows/?page_num=${page}&page_size=${100}&status=2&name=${searchKey}`);
    return data;
}


// 解析 custom 组件节点
export async function reloadCustom(code: string): Promise<unknown> {
    const response = await axios.post("/api/v1/component/custom_component", {
        code,
        "field": "",
        "frontend_node": {}
    });
    return response
}


/**
 * 获取技能对应的版本列表.
 *
 * @returns The flow versions data.
 * @throws .
 */
export async function getFlowVersions(flow_id: string | number): Promise<{ data: FlowVersionItem[], total: number }> {
    return await axios.get(`/api/v1/flows/versions`, {
        params: { flow_id }
    });
}

/** 创建版本参数 */
export interface CreateFlowVersionParams {
    name: string;
    description: string;
    original_version_id: number;
    data: ReactFlowJsonObject | null;
}

/**
 * 创建新的技能版本.
 *
 * @param {object} versionData - 新版本的数据.
 * @returns The created version data.
 * @throws .
 */
export async function createFlowVersion(
    flow_id: string | number,
    versionData: CreateFlowVersionParams
): Promise<FlowVersionItem> {
    return await axios.post(`/api/v1/flows/versions?flow_id=${flow_id}`, versionData);
}

/** 版本详情响应 */
export interface FlowVersionDetail extends FlowVersionItem {
    data: ReactFlowJsonObject | null;
    create_time: string;
    update_time: string;
}

/**
 * 获取单个版本的信息.
 *
 * @param {string} versionId - 版本的ID.
 * @returns The version details.
 * @throws .
 */
export async function getVersionDetails(versionId: string | number): Promise<FlowVersionDetail> {
    return await axios.get(`/api/v1/flows/versions/${versionId}`);
}

/** 更新版本参数 */
export interface UpdateFlowVersionParams {
    name: string;
    description: string;
    data: ReactFlowJsonObject | null;
}

/**
 * 更新版本信息.
 *
 * @param {string} versionId - 要更新的版本ID.
 * @param {object} versionData - 更新的版本数据.
 * @returns The updated version data.
 * @throws .
 */
export async function updateVersion(
    versionId: string | number,
    versionData: UpdateFlowVersionParams
): Promise<FlowVersionDetail> {
    return await axios.put(`/api/v1/flows/versions/${versionId}`, versionData);
}

/**
 * 删除版本.
 *
 * @param {string} versionId - 要删除的版本ID.
 * @returns The deletion result.
 * @throws .
 */
export async function deleteVersion(versionId: string | number): Promise<void> {
    return await axios.delete(`/api/v1/flows/versions/${versionId}`);
}

/**
 * 切换版本.
 *
 * @param {object} versionData - 包含要更改到的版本ID的数据.
 * @returns The version change result.
 * @throws .
 */
export async function changeCurrentVersion(params: { flow_id: string | number; version_id: number }): Promise<void> {
    return await axios.post(`/api/v1/flows/change_version?flow_id=${params.flow_id}&version_id=${params.version_id}`);
}

/**
 * 运行测试用例.
 */
export async function runTestCase(data: { question_list: unknown[], version_list: unknown[], node_id: string, inputs: Record<string, unknown> }): Promise<unknown[]> {
    return await axios.post(`/api/v1/flows/compare`, data);
}

/**
 * 聊天窗上传文件
 */
export async function uploadChatFile(v: string, file: File, onProgress: (progress: number) => void): Promise<unknown> {
    const formData = new FormData();
    formData.append("file", file);
    return await axios.post(`/api/v1/knowledge/upload`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
            // Calculate progress percentage
            if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(progress);
            }
        }
    });
}


/** 编辑权限响应 */
export interface EditPermissionResponse {
    has_permission: boolean;
    message?: string;
}

/**
 * 检查是否有编辑app权限
 */
export async function checkAppEditPermission(
    flowId: string | number,
    flowType: number | string
): Promise<EditPermissionResponse | void> {
    return await axios.get(`/api/v1/workflow/write/auth`, {
        params: { flow_id: flowId, flow_type: flowType }
    }).catch(e => {
        // console.error('error :>> ', e);
        // location.href = __APP_ENV__.BASE_URL + '/404';
    });
}