/**
 * themeRuntime re-export —— 3A.2 平移垫片。
 *
 * 真实实现已平移至 @shared/theme/themeRuntime（platform + client 双前端共享）。
 * 本文件仅作路径兼容层，保持 `@/services/theme/themeRuntime` 调用方零改动。
 *
 * shared 层定位：DOM 注入层（双 style 常驻 + C5 diff + 预览态覆盖）。
 * persistence 留 platform（单适配器，不上 shared）。
 */
export * from '@shared/theme/themeRuntime';
