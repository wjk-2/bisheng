/**
 * inlineThemePlugin —— 3B.6 build-time 默认主题内联 vite 插件。
 *
 * 职责：在 vite build（与 dev）时，把 DEFAULT_BRAND 派生的 22 令牌 light/dark
 * 内联进 index.html，作为首屏默认主题（零 FOUC + 消除首屏 fetch web_config 的
 * P2 阻塞 + 首屏未登录 401）。注：仅消除「首屏」fetch，登录后 ThemeContext/orchestrator
 * 仍 fetch 用户自定义主题（必要：拉用户配置覆盖内联默认）。
 *
 * 注入内容（head 内，FOUC 脚本之后）：
 *   1. <style id="theme-vars-light">:root{...light 派生...}</style>
 *   2. <style id="theme-vars-dark">.dark{...dark 派生...}</style>
 *   3. <script> 设 window.ThemeStyle（v3 元数据，orchestrator 读 brand/neutral/bg）
 *      + window.__themeVersion=0（versionRef 方案 B 同步读，消除 fetch 异步竞态）
 *
 * 设计要点：
 *   - 纯函数派生（deriveTheme/formatCssRules 无 DOM 依赖），node 端 build 时跑一次，运行时零计算
 *   - 双端共用同一插件源（platform SWC+TS / client Babel+rollup，transformIndexHtml 是 vite 核心 API 均支持）
 *   - 注入的 CSS 走 formatCssRules 的 KEY_RE 白名单 + hsl 校验（与 themeRuntime 线上写入同源，C5 diff 生效）
 *   - window.ThemeStyle 不含 light/dark CompTheme（派生结果已在双 style 里，orchestrator 只读 brand/neutral/bg/v3Schema）
 *
 * 内联后首屏链路：build-time 双 style 常驻 → FOUC 脚本给 .dark class → 首屏正确渲染默认主题
 *   → 登录后 React 挂载，orchestrator/ThemeContext 拉用户自定义主题覆盖（applyLight/applyDark 写同 id 节点，C5 diff 无闪烁）。
 */
import type { Plugin } from 'vite';
import { deriveTheme, DEFAULT_BRAND } from './themeConfig';
import { formatCssRules } from './themeRuntime';

/**
 * 构造内联的 window.ThemeStyle 初始化脚本。
 *
 * window.ThemeStyle 只需 v3 元数据（orchestrator computeInitialBrand 读 v3Schema/brand），
 * light/dark 派生结果已由双 style 注入，不在此重复（减少 HTML 体积）。
 */
function buildThemeStyleInitScript(): string {
    const ts = {
        // bg 默认 'logo'（与 orchestrator useState(window.ThemeStyle?.bg || 'logo') 兜底一致），
        // 让 Panne.tsx 首屏读到正确 bg 挂 flow-bg-logo class，无需等 React 挂载后 fetch。
        bg: 'logo',
        v3Schema: true,
        brand: { ...DEFAULT_BRAND },
        neutral: { preset: 'slate' },
        _lock_version: 0,
    };
    // JSON.stringify 注入 inline script。转义 < 防御 </script> 序列破坏 HTML 解析
    // （DEFAULT_BRAND 当前是硬编码常量不含 <，但若未来改为可配置则成 XSS 向量，零成本加固）。
    const json = JSON.stringify(ts).replace(/</g, '\\u003c');
    return `window.ThemeStyle=${json};window.__themeVersion=0;`;
}

/**
 * build-time 默认主题内联插件。
 *
 * @param mode 'platform' | 'client'，仅用于注释标记（派生算法本体双端相同）
 */
export function inlineThemePlugin(_mode: 'platform' | 'client' = 'platform'): Plugin {
    // build 时算一次派生（deriveTheme 纯函数，结果固定）
    const { light, dark } = deriveTheme(DEFAULT_BRAND, { preset: 'slate' });
    const lightCss = `:root{${formatCssRules(light)}}`;
    const darkCss = `.dark{${formatCssRules(dark)}}`;
    const initScript = buildThemeStyleInitScript();

    return {
        name: 'inline-theme',
        // apply: 'build' 仅 build 时注入（dev 也注入保持一致，避免 dev/build 行为分叉）
        transformIndexHtml() {
            return [
                {
                    tag: 'style',
                    attrs: { id: 'theme-vars-light' },
                    children: lightCss,
                    injectTo: 'head-prepend',
                },
                {
                    tag: 'style',
                    attrs: { id: 'theme-vars-dark' },
                    children: darkCss,
                    injectTo: 'head-prepend',
                },
                {
                    tag: 'script',
                    children: initScript,
                    injectTo: 'head-prepend',
                },
            ];
        },
    };
}
