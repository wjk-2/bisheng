// @vitest-environment jsdom
/**
 * inlineThemePlugin 单测 —— 3B.6 步骤 1。
 *
 * 验证 build-time 内联插件产出正确：
 *   - 注入双 style（theme-vars-light/dark），内容是 DEFAULT_BRAND 派生的 CSS
 *   - 注入脚本设 window.ThemeStyle（v3 元数据）+ window.__themeVersion=0
 *   - light/dark CSS 不同（两套派生结果）
 *   - primary 值 = 学术蓝派生（h≈221，非紫蓝 h240）
 */
import { describe, it, expect } from 'vitest';
import { inlineThemePlugin } from '@shared/theme/inlineThemePlugin';
import { deriveTheme, DEFAULT_BRAND } from '@shared/theme/themeConfig';
import { formatCssRules } from '@shared/theme/themeRuntime';

describe('inlineThemePlugin', () => {
    const plugin = inlineThemePlugin('platform');
    // transformIndexHtml 可能是函数或对象（带 handler），统一取函数
    const hook = typeof plugin.transformIndexHtml === 'function'
        ? plugin.transformIndexHtml
        : (plugin.transformIndexHtml as { handler: () => unknown }).handler;
    const tags = (hook as () => unknown[])();

    it('注入 3 个标签（light style / dark style / script）', () => {
        expect(Array.isArray(tags)).toBe(true);
        expect(tags).toHaveLength(3);
    });

    it('light style 含 id=theme-vars-light + :root{...} 派生 CSS', () => {
        const lightStyle = tags[0] as { tag: string; attrs: { id: string }; children: string };
        expect(lightStyle.tag).toBe('style');
        expect(lightStyle.attrs.id).toBe('theme-vars-light');
        const expected = `:root{${formatCssRules(deriveTheme(DEFAULT_BRAND, { preset: 'slate' }).light)}}`;
        expect(lightStyle.children).toBe(expected);
    });

    it('dark style 含 id=theme-vars-dark + .dark{...} 派生 CSS', () => {
        const darkStyle = tags[1] as { tag: string; attrs: { id: string }; children: string };
        expect(darkStyle.tag).toBe('style');
        expect(darkStyle.attrs.id).toBe('theme-vars-dark');
        expect(darkStyle.children).toContain('.dark{');
    });

    it('light 与 dark CSS 不同（两套派生结果）', () => {
        const lightCss = (tags[0] as { children: string }).children;
        const darkCss = (tags[1] as { children: string }).children;
        expect(lightCss).not.toBe(darkCss);
    });

    it('primary 是学术蓝派生（h≈221），非紫蓝 h240', () => {
        const lightCss = (tags[0] as { children: string }).children;
        // 学术蓝 #2563EB ≈ hsl(221, 83%, 53%)，派生 primary hue 应以 221 开头（浮点 221.21...）
        expect(lightCss).toContain('--primary:221.');
    });

    it('脚本设 window.ThemeStyle 含 v3 元数据（brand/neutral/v3Schema/_lock_version）', () => {
        const script = tags[2] as { tag: string; children: string };
        expect(script.tag).toBe('script');
        // 含 DEFAULT_BRAND + slate + v3Schema:true + __themeVersion=0
        expect(script.children).toContain('#2563EB');
        expect(script.children).toContain('"preset":"slate"');
        expect(script.children).toContain('"v3Schema":true');
        expect(script.children).toContain('window.__themeVersion=0');
    });

    it('脚本 JSON 合法（window.ThemeStyle= 后是合法 JSON 对象）', () => {
        const script = tags[2] as { children: string };
        const match = script.children.match(/window\.ThemeStyle=(\{.*?\});/);
        expect(match).not.toBeNull();
        const parsed = JSON.parse(match![1]);
        expect(parsed.v3Schema).toBe(true);
        expect(parsed.brand.light).toBe('#2563EB');
        expect(parsed._lock_version).toBe(0);
    });
});
