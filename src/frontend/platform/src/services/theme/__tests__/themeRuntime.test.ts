// @vitest-environment jsdom
/**
 * themeRuntime 单元测试 —— 锁定 DOM 注入层契约。
 *
 * 覆盖：
 *   - formatCssRules：S1 校验（key 白名单 + hsl 数值范围 + 跳过非法项）+ 0-1 制 ×100 拼接
 *   - applyLight / applyDark：双 style 常驻（各自独立 id，原位更新不重复）
 *   - applyPreview：head 末尾覆盖、幂等重建
 *   - clearPreview：幂等（不存在不报错）
 *   - setMode：只 toggle .dark class，不重写 style
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    formatCssRules,
    applyLight,
    applyDark,
    applyPreview,
    clearPreview,
    setMode,
} from '../themeRuntime';
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from '../themeConfig';

describe('formatCssRules', () => {
    it('合法 0-1 制 → 拼 `key:h s% l%;`（s/l ×100）', () => {
        const rules = formatCssRules({ '--primary': { h: 240, s: 1, l: 0.64 } });
        expect(rules).toBe('--primary:240 100% 64%;');
    });

    it('多 key 全部拼接', () => {
        const rules = formatCssRules({
            '--primary': { h: 240, s: 1, l: 0.64 },
            '--background': { h: 0, s: 0, l: 1 },
        });
        expect(rules).toBe('--primary:240 100% 64%;--background:0 0% 100%;');
    });

    it('S1: 非法 key（非 --[a-z-] 格式）跳过', () => {
        const rules = formatCssRules({
            '--primary': { h: 240, s: 1, l: 0.64 },
            // @ts-expect-error: 故意塞非法 key 验证白名单
            'evil{evil}': { h: 0, s: 0, l: 0 },
            '--UPPER': { h: 0, s: 0, l: 0 },
        });
        expect(rules).toBe('--primary:240 100% 64%;');
    });

    it('S1: h/s/l 非 number 跳过', () => {
        const rules = formatCssRules({
            // @ts-expect-error: 故意非 number
            '--a': { h: 'x', s: 1, l: 0.5 },
            '--b': { h: 0, s: 1, l: 0.5 },
        });
        expect(rules).toBe('--b:0 100% 50%;');
    });

    it('S1: h 越界跳过（>360 / <0）', () => {
        const rules = formatCssRules({
            '--a': { h: 361, s: 1, l: 0.5 },
            '--b': { h: -1, s: 1, l: 0.5 },
            '--c': { h: 360, s: 1, l: 0.5 },
            '--d': { h: 0, s: 1, l: 0.5 },
        });
        expect(rules).toBe('--c:360 100% 50%;--d:0 100% 50%;');
    });

    it('S1: s/l 越界跳过（>1 / <0）', () => {
        const rules = formatCssRules({
            '--a': { h: 0, s: 1.1, l: 0.5 },
            '--b': { h: 0, s: 1, l: 1.1 },
            '--c': { h: 0, s: -0.1, l: 0.5 },
            '--d': { h: 0, s: 1, l: 1 }, // 边界合法
        });
        expect(rules).toBe('--d:0 100% 100%;');
    });

    it('空对象 → 空串', () => {
        expect(formatCssRules({})).toBe('');
    });
});

describe('applyLight', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
    });

    it('style 不存在 → 创建 #theme-vars-light，内容为 :root{...}', () => {
        applyLight(DEFAULT_LIGHT_THEME);
        const style = document.getElementById('theme-vars-light') as HTMLStyleElement;
        expect(style).not.toBeNull();
        expect(style.innerHTML).toContain(':root{');
        expect(style.innerHTML).toContain('--primary:');
    });

    it('已存在 → 原位更新内容，不新增重复节点', () => {
        applyLight({ '--primary': { h: 0, s: 1, l: 0.5 } });
        applyLight({ '--primary': { h: 240, s: 1, l: 0.64 } });
        const styles = document.querySelectorAll('#theme-vars-light');
        expect(styles.length).toBe(1);
        expect(styles[0].innerHTML).toContain('--primary:240');
    });
});

describe('applyDark', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
    });

    it('创建 #theme-vars-dark，选择器为 .dark', () => {
        applyDark(DEFAULT_DARK_THEME);
        const style = document.getElementById('theme-vars-dark') as HTMLStyleElement;
        expect(style).not.toBeNull();
        expect(style.innerHTML).toContain('.dark{');
    });

    it('与 light 独立，互不影响（双 style 常驻）', () => {
        applyLight(DEFAULT_LIGHT_THEME);
        applyDark(DEFAULT_DARK_THEME);
        expect(document.getElementById('theme-vars-light')).not.toBeNull();
        expect(document.getElementById('theme-vars-dark')).not.toBeNull();
    });
});

describe('applyPreview / clearPreview', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
    });

    it('applyPreview 创建 #theme-vars-preview，含 :root{} 与 .dark{}', () => {
        applyPreview(DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME);
        const style = document.getElementById('theme-vars-preview') as HTMLStyleElement;
        expect(style).not.toBeNull();
        expect(style.innerHTML).toContain(':root{');
        expect(style.innerHTML).toContain('.dark{');
    });

    it('applyPreview 位于 head 末尾（覆盖线上，source order 最末）', () => {
        applyLight(DEFAULT_LIGHT_THEME);
        applyDark(DEFAULT_DARK_THEME);
        applyPreview(DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME);
        const headChildren = Array.from(document.head.children);
        const previewIdx = headChildren.findIndex(el => el.id === 'theme-vars-preview');
        const lightIdx = headChildren.findIndex(el => el.id === 'theme-vars-light');
        expect(previewIdx).toBeGreaterThan(lightIdx);
        expect(previewIdx).toBe(headChildren.length - 1);
    });

    it('applyPreview 幂等：重复调用不堆积节点', () => {
        applyPreview(DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME);
        applyPreview(DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME);
        expect(document.querySelectorAll('#theme-vars-preview').length).toBe(1);
    });

    it('clearPreview 删除 preview style', () => {
        applyPreview(DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME);
        clearPreview();
        expect(document.getElementById('theme-vars-preview')).toBeNull();
    });

    it('clearPreview 幂等：不存在时不报错', () => {
        expect(() => clearPreview()).not.toThrow();
    });
});

describe('setMode', () => {
    beforeEach(() => {
        document.documentElement.classList.remove('dark');
    });

    it('mode=dark → html 加 .dark class', () => {
        setMode('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('mode=light → html 移除 .dark class', () => {
        document.documentElement.classList.add('dark');
        setMode('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('只 toggle class，不创建/重写任何 theme-vars style', () => {
        document.head.innerHTML = '';
        setMode('dark');
        setMode('light');
        // setMode 绝不碰 style 标签
        expect(document.getElementById('theme-vars-light')).toBeNull();
        expect(document.getElementById('theme-vars-dark')).toBeNull();
    });
});
