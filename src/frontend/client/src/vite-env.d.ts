/// <reference types="vite/client" />

/**
 * Vite 环境变量类型声明
 * @see https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
 */
interface ImportMetaEnv {
  /** 是否启用日志 */
  readonly VITE_ENABLE_LOGGER: string;
  /** 日志过滤器 */
  readonly VITE_LOGGER_FILTER: string;
  /** 开发模式 */
  readonly DEV: boolean;
  /** 生产模式 */
  readonly PROD: boolean;
  /** 模式 */
  readonly MODE: string;
  /** 基础 URL */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
