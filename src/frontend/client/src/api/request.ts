/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig } from 'axios';
import i18next from "i18next";

// 报错的时候是否弹窗
type ErrorOptions = {
  showError?: boolean;
};

const customAxios = axios.create({
  baseURL: import.meta.env.BASE_URL
  // 配置
});

async function _get<T>(url: string, options?: AxiosRequestConfig & ErrorOptions): Promise<T> {
  const response = await customAxios.get(url, { ...options });
  return response.data;
}

async function _getResponse<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
  return await customAxios.get(url, { ...options });
}

async function _post(url: string, data?: any, config?: AxiosRequestConfig) {
  const response = await customAxios.post(url, config ? data : JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    ...config
  });
  return response.data;
}

async function _postMultiPart(url: string, formData: FormData, options?: AxiosRequestConfig) {
  const response = await customAxios.post(url, formData, {
    ...options,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

async function _postTTS(url: string, formData: FormData, options?: AxiosRequestConfig) {
  const response = await customAxios.post(url, formData, {
    ...options,
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'arraybuffer',
  });
  return response.data;
}

async function _put(url: string, data?: any, options?: AxiosRequestConfig) {
  const response = await customAxios.put(url, JSON.stringify(data), {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

async function _delete<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
  const response = await customAxios.delete(url, { ...options });
  return response.data;
}

async function _deleteWithOptions<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
  const response = await customAxios.delete(url, { ...options });
  return response.data;
}

async function _patch(url: string, data?: any, options?: AxiosRequestConfig) {
  const response = await customAxios.patch(url, JSON.stringify(data), {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

// S-5/37: Token refresh logic is intentionally disabled. This system uses HttpOnly cookie
// authentication (same-domain shared between Platform and Client). On 401, we clear local
// state and redirect to the login page. This is a design choice — cookie-based auth does
// not require frontend token refresh.

customAxios.interceptors.response.use(
  (response) => {
    if (response.data.status_code === 403) {
      // Share 路由无需登录，403 直接返回，不跳转
      if (location.pathname.includes('/share/')) {
        return response;
      }
      // S-35: ERROR_REQUEST_PATH stores a URL path (non-sensitive) for post-login redirect
      localStorage.setItem('ERROR_REQUEST_PATH', response.config.url || '')
      location.href = `${__APP_ENV__.BASE_URL}/c/new?error=11403`;
      return response
    }

    if (response.config.showError && response.data && response.data.status_code !== 200) {
      window.showToast?.({ message: i18next.t(`api_errors.${response.data.status_code}`, response.data.data), status: 'error' });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!error.response) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/api/auth/2fa') === true) {
      return Promise.reject(error);
    }
    if (originalRequest.url?.includes('/api/auth/logout') === true) {
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      // Share 路由无需登录，401 直接 reject，不跳转
      if (location.pathname.includes('/share/')) {
        return Promise.reject(error);
      }

      console.warn('401 Unauthorized — session expired, cleaning up local state');
      originalRequest._retry = true;

      // Clean up local auth state before redirecting
      localStorage.removeItem('ws_token');
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');

      // R-06: 开发/生产环境行为统一，401 均重定向到登录页
      // S-35: LOGIN_PATHNAME stores current path (non-sensitive) for post-login redirect
      localStorage.setItem('LOGIN_PATHNAME', location.pathname)
      location.href = location.origin + '/'
    }

    return Promise.reject(error);
  },
);

export default {
  get: _get,
  getResponse: _getResponse,
  post: _post,
  postMultiPart: _postMultiPart,
  postTTS: _postTTS,
  put: _put,
  delete: _delete,
  deleteWithOptions: _deleteWithOptions,
  patch: _patch,
};
