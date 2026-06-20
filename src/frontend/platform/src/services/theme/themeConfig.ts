/**
 * themeConfig re-export —— 3A.1 平移垫片。
 *
 * 真实实现已平移至 @shared/theme/themeConfig（platform + client 双前端共享）。
 * 本文件仅作路径兼容层，保持 `@/services/theme/themeConfig` 调用方零改动。
 *
 * shared 层定位：纯函数（数据层），无 DOM、无副作用。
 * persistence 留 platform（单适配器，不上 shared）。
 */
export * from '@shared/theme/themeConfig';
