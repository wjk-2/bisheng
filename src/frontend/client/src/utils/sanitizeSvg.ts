import DOMPurify from 'dompurify';

/**
 * SVG 消毒函数，使用 DOMPurify 移除潜在的 XSS 攻击向量
 * - 启用 SVG 配置文件，保留 SVG 标签和属性
 * - 自动移除 script 标签、事件处理器、javascript: 伪协议等危险内容
 * - 处理 foreignObject、data: 协议等正则难以覆盖的攻击向量
 */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true },
    ADD_TAGS: ['use'], // 允许 SVG <use> 标签用于图标复用
  });
}
