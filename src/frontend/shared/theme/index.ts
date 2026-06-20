/**
 * shared/theme —— 主题共享层（platform + client 双前端共用）
 *
 * 层次定位：
 *   themeConfig（纯函数，数据层）→ themeRuntime（DOM 注入）
 *   两层平移至 shared 供双前端 @shared/theme/* alias 引用。
 *
 * 不在此处的内容：
 *   - themePersistence（网络 + debounce + C7 乐观锁）留 platform：
 *     它依赖 platform 的 axios/i18n/toast 适配器，是单前端专属，不上 shared。
 *
 * 平移垫片：
 *   platform 原 `src/services/theme/{themeConfig,themeRuntime}.ts` 改为 re-export
 *   本模块，保持 `@/services/theme/...` 调用方零改动（3A.1 / 3A.2）。
 *   client 侧由 3A.3 接入。
 *
 * 命名冲突：themeConfig 与 themeRuntime 导出符号无重名，export * 安全。
 */
export * from './themeConfig';
export * from './themeRuntime';
