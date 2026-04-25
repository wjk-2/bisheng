import { paramsSerializer } from ".";
import { CaptchaResponse, PublicKeyResponse } from "../../types/api/common";
import { ROLE, User } from "../../types/api/user";
import axios from "../request";

// 获取公钥
export const getPublicKeyApi = async (): Promise<PublicKeyResponse> => {
  return await axios.get(`/api/v1/user/public_key`);
};

// 获取验证码
export const getCaptchaApi = (): Promise<CaptchaResponse> => {
  return axios.get(`/api/v1/user/get_captcha`);
};

// 校验登录
export async function getUserInfo(): Promise<User> {
  return await axios.get(`/api/v1/user/info`);
}

// 退出登录
export async function logoutApi(): Promise<void> {
  return await axios.post(`/api/v1/user/logout`);
}

/** 登录响应 */
export interface LoginResponse {
  user_id: number;
  user_name: string;
  role: string;
}

// 登录
export async function loginApi(
  name: string,
  pwd: string,
  captcha_key?: string,
  captcha?: string
): Promise<LoginResponse> {
  return await axios.post(`/api/v1/user/login`, {
    user_name: name,
    password: pwd,
    captcha_key,
    captcha,
  });
}

// 注册
export async function registerApi(
  name: string,
  pwd: string,
  captcha_key?: string,
  captcha?: string
): Promise<void> {
  return await axios.post(`/api/v1/user/regist`, {
    user_name: name,
    password: pwd,
    captcha_key,
    captcha,
  });
}
// 用户列表
export async function getUsersApi({ name = '', page, pageSize, groupId, roleId }: {
  name: string,
  page: number,
  pageSize: number,
  groupId?: number[],
  roleId?: number[]
},
  config?: { signal?: AbortSignal }): Promise<{ data: User[]; total: number }> {

  return await axios.get(
    `/api/v1/user/list`,
    {
      params: {
        name,
        page_num: page,
        page_size: pageSize,
        group_id: groupId,
        role_id: roleId,
      },
      paramsSerializer,
      signal: config?.signal, // 绑定 AbortSignal
    }
  );
}

// 标注任务下用户列表
export async function getLabelUsersApi(taskId: number): Promise<{ data: User[]; total: number }> {
  return await axios.get(
    `/api/v1/mark/get_user?task_id=${taskId}`
  );
}

// 修改用户状态（启\禁用）
export async function disableUserApi(userid: number, status: number): Promise<void> {
  return await axios.post(`/api/v1/user/update`, {
    user_id: userid,
    delete: status,
  });
}
// 角色列表 - 已移除，改为前端固定角色
// export async function getRolesApi(searchkey = ""): Promise<{ data: ROLE[] }> {
//   return await axios.get(`/api/v1/role/list?role_name=${searchkey}`)
//     .then(res => res.data);
// }
// 用户组下角色列表
export async function getRolesByGroupApi(searchkey = "", groupIds: (string | number)[]): Promise<{ data: ROLE[] }> {
  const groupStr = groupIds?.reduce((pre, id) => `${pre}&group_id=${id}`, '') || ''
  return await axios.get(`/api/v1/group/roles?keyword=${searchkey}${groupStr}`)
    .then(res => res.data);
}
/**
 * 获取配置
 */
export async function getSysConfigApi(): Promise<string> {
  return await axios.get(`/api/v1/config`);
}
/**
 * 更新配置
 */
export async function setSysConfigApi(data: Record<string, unknown>): Promise<void> {
  return await axios.post(`/api/v1/config/save`, data);
}
/**
 * 根据角色获取技能列表
 */
export async function getRoleSkillsApi(
  params: RoleResourceParams
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  return await axios.get(`/api/v1/role_access/flow`, { params });
}
/**
 * 根据角色获取助手列表
 */
export async function getRoleAssistApi(
  params: RoleResourceParams
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  return await axios.get(`/api/v1/role_access/list_type`, { params });
}
/**
 * 根据角色获取知识库列表
 */
export async function getRoleLibsApi(
  params: RoleResourceParams
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  return await axios.get(`/api/v1/role_access/knowledge`, { params });
}
/**
 * 根据用户组获取资源列表
 */
export interface GroupResourcesParams {
  group_id: string | number;
  resource_type: number;
  name: string;
  page_size: number;
  page_num: number;
}
export async function getGroupResourcesApi(
  params: GroupResourcesParams
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  return await axios.get(`/api/v1/group/get_group_resources`, { params });
}
/**
 * 新增角色
 */
export async function createRole(groupId: number | string, name: string): Promise<void> {
  return await axios.post(`/api/v1/role/add`, {
    group_id: groupId,
    role_name: name,
    remark: "手动创建用户",
  });
}
/**
 * 更新角色权限
 */
enum ACCESS_TYPE {
  USE_LIB = 1,
  USE_SKILL,
  MANAGE_LIB,
  ASSISTANT = 5,
  TOOL = 4,
  MENU = 99
}
export async function updateRolePermissionsApi(data: {
  role_id: number;
  access_id: number[];
  type: ACCESS_TYPE;
}) {
  return await axios.post(`/api/v1/role_access/refresh`, data);
}

/**
 * 获取角色下的权限
 */
export async function getRolePermissionsApi(
  roleId: number | string
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const params = { role_id: roleId, page_size: 200, page_num: 1 };
  return axios.get(`/api/v1/role_access/list`, { params });
  // return Promise.all([
  //     axios.get(url, { params: { ...params, type: 1 } }),
  //     axios.get(url, { params: { ...params, type: 2 } }),
  //     axios.get(url, { params: { ...params, type: 3 } })
  // ])
}
export async function updateRoleNameApi(roleId: number | string, name: string): Promise<void> {
  return axios.patch(`/api/v1/role/${roleId}`, {
    role_name: name,
    remark: "手动创建用户",
  });
}

/**
 * 删除角色
 */
export async function delRoleApi(roleId: number | string): Promise<void> {
  return axios.delete(`/api/v1/role/${roleId}`);
}

/** 用户组列表响应 */
export interface UserGroupListResponse {
  data: Array<{
    id: number;
    group_name: string;
    group_admins: number[];
    create_time: string;
    update_time: string;
  }>;
  total: number;
}

// 用户组列表
export function getUserGroupsApi(config?: { signal?: AbortSignal }): Promise<UserGroupListResponse> {
  return axios.get(`/api/v1/group/list`, {
    signal: config?.signal, // 绑定 AbortSignal
  });
}


// 删除用户组post
export function delUserGroupApi(group_id: number | string): Promise<void> {
  return axios.delete(`/api/v1/group/create`, { params: { group_id } });
  // return axios.post(`/api/v1/group/del/${userGroupId}`);
}

/** 保存用户组表单 */
export interface UserGroupForm {
  groupName: string;
}

// 保存用户组
export function saveUserGroup(form: UserGroupForm, selected: Array<{ value: number | string }>): Promise<void> {
  const { groupName: group_name } = form
  return axios.post(`/api/v1/group/create`, {
    group_name,
    group_admins: selected.map(item => item.value),
  });
}

// 修改用户组
export function updateUserGroup(id: number, form: UserGroupForm, selected: Array<{ value: number | string }>): Promise<[void, void]> {
  const { groupName: group_name } = form
  const a = axios.put(`/api/v1/group/create`, {
    id,
    group_name
  });
  const b = axios.post(`/api/v1/group/set_group_admin`, {
    group_id: id,
    user_ids: selected.map(item => item.value)
  })
  return Promise.all([a, b])
}


/**
 * 获取用户的角色信息
 */
export async function getUserRoles(userId: number | string): Promise<ROLE[]> {
  return axios.get(`/api/v1/user/role?user_id=${userId}`);
}

/**
 * 更新用户角色
 */
export async function updateUserRoles(userId: number | string, roles: (number | string)[]): Promise<void> {
  return await axios.post(`/api/v1/user/role_add`, {
    user_id: userId,
    role_id: roles,
  });
}
// 更新用户组
export async function updateUserGroups(userId: number | string, groupIds: number[]): Promise<void> {
  return await axios.post(`/api/v1/group/set_user_group`, {
    user_id: userId,
    group_id: groupIds,
    is_group_admin: false
  });
}

/**
 * 原子性更新用户角色和用户组
 * 在单个事务中完成，保证数据一致性
 */
export async function updateUserRolesAndGroups(userId: number, roleIds: (string | number)[], groupIds: number[], nickname?: string) {
  return await axios.post(`/api/v1/user/update_roles_and_groups`, {
    user_id: userId,
    role_ids: roleIds.map(id => Number(id)),
    group_ids: groupIds,
    nickname
  });
}

// 超管创建用户
export async function createUserApi(user_name: string, password: string, group_roles: Array<{ group_id: number; role_ids: number[] }>, nickname?: string) {
  return await axios.post('/api/v1/user/create', {
    user_name,
    password,
    nickname,
    group_roles
  })
}

/**
 * 获取所有管理员
 */
export async function getAdminsApi(): Promise<unknown> {
  return axios.get(`/api/v1/user/admin`);
}


/**
 * 重置密码（管理员专用）
 */
export async function resetPasswordApi(userId: number, password: string): Promise<unknown> {
  return axios.post(`/api/v1/user/reset_password`, {
    user_id: userId,
    password
  });
}

/**
 * 密码过期重置个人密码
 */
export async function changePasswordApi(userName: string, password: string, new_password: string): Promise<unknown> {
  return axios.post(`/api/v1/user/change_password_public`, {
    username: userName,
    password,
    new_password
  });
}

// 已登录状态重置个人密码
export async function loggedChangePasswordApi(password: string, new_password: string): Promise<unknown> {
  return axios.post(`/api/v1/user/change_password`, {
    password,
    new_password
  })
}