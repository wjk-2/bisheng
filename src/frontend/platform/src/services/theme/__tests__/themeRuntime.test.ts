// @vitest-environment jsdom
/**
 * themeRuntime 单元测试 —— 锁定 DOM 注入层契约。
 *
 * 覆盖：
 *   - formatCssRules：S1 校验（key 白名单 + hsl 数值范围 + 跳过非法项）+ 0-1 制 ×100 拼接
 *   - buildStyleContent：selector + formatCssRules 拼完整 style 内容
 *   - applyLight / applyDark：双 style 常驻（各自独立 id，原位更新不重复）+ C5 diff（相同 comp 不重写 innerHTML）
 *   - applyPreview：head 末尾覆盖、幂等重建
 *   - clearPreview：幂等（不存在不报错）
 *   - setMode：只 toggle .dark class，不重写 style
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    formatCssRules,
    buildStyleContent,
    buildScopedCss,
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
        expect(rules).toBe('--primary:240 100% 64%');
    });

    it('多 key 全部拼接', () => {
        const rules = formatCssRules({
            '--primary': { h: 240, s: 1, l: 0.64 },
            '--background': { h: 0, s: 0, l: 1 },
        });
        expect(rules).toBe('--primary:240 100% 64%;--background:0 0% 100%');
    });

    it('S1: 非法 key（非 --[a-z][a-z0-9-]* 格式）跳过', () => {
        const rules = formatCssRules({
            '--primary': { h: 240, s: 1, l: 0.64 },
            // @ts-expect-error: 故意塞非法 key 验证白名单
            'evil{evil}': { h: 0, s: 0, l: 0 },
            '--UPPER': { h: 0, s: 0, l: 0 },
            '--under_score': { h: 0, s: 0, l: 0 },
            '--123': { h: 0, s: 0, l: 0 },
        });
        expect(rules).toBe('--primary:240 100% 64%');
    });

    it('S1: 数字键放行（阶段3 品牌色色阶 --brand-50 / --brand-500 / --brand-900）', () => {
        const rules = formatCssRules({
            '--brand-50': { h: 240, s: 1, l: 0.95 },
            '--brand-500': { h: 240, s: 1, l: 0.64 },
            '--brand-900': { h: 240, s: 1, l: 0.10 },
        });
        expect(rules).toBe('--brand-50:240 100% 95%;--brand-500:240 100% 64%;--brand-900:240 100% 10%');
    });

    it('S1: 首字符数字仍非法（--123 / --4xx）', () => {
        const rules = formatCssRules({
            '--123': { h: 0, s: 1, l: 0.5 },
            '--4xx': { h: 0, s: 1, l: 0.5 },
            '--brand-1': { h: 0, s: 1, l: 0.5 }, // 对照组：首字母合法，放行
        });
        expect(rules).toBe('--brand-1:0 100% 50%');
    });

    it('S1: h/s/l 非 number 跳过', () => {
        const rules = formatCssRules({
            // @ts-expect-error: 故意非 number
            '--a': { h: 'x', s: 1, l: 0.5 },
            '--b': { h: 0, s: 1, l: 0.5 },
        });
        expect(rules).toBe('--b:0 100% 50%');
    });

    it('S1: h 越界跳过（>360 / <0）', () => {
        const rules = formatCssRules({
            '--a': { h: 361, s: 1, l: 0.5 },
            '--b': { h: -1, s: 1, l: 0.5 },
            '--c': { h: 360, s: 1, l: 0.5 },
            '--d': { h: 0, s: 1, l: 0.5 },
        });
        expect(rules).toBe('--c:360 100% 50%;--d:0 100% 50%');
    });

    it('S1: s/l 越界跳过（>1 / <0）', () => {
        const rules = formatCssRules({
            '--a': { h: 0, s: 1.1, l: 0.5 },
            '--b': { h: 0, s: 1, l: 1.1 },
            '--c': { h: 0, s: -0.1, l: 0.5 },
            '--d': { h: 0, s: 1, l: 1 }, // 边界合法
        });
        expect(rules).toBe('--d:0 100% 100%');
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

    it('C5 diff：相同 comp 重复 applyLight 不重写 innerHTML', () => {
        const comp = { '--primary': { h: 240, s: 1, l: 0.64 } };
        applyLight(comp);
        const style = document.getElementById('theme-vars-light') as HTMLStyleElement;
        const firstContent = style.innerHTML;
        // 模拟外部（如 bootstrap）介入后内容被改，再以同样 comp apply 应跳过
        // 这里直接验证：第二次同样 comp 调用后内容不变（diff 命中 return）
        // 用 spy 确认 innerHTML setter 未被触发
        const spy = vi.spyOn(style, 'innerHTML', 'set');
        applyLight(comp);
        expect(style.innerHTML).toBe(firstContent);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('C5 diff：comp 变化时正常重写', () => {
        applyLight({ '--primary': { h: 0, s: 1, l: 0.5 } });
        applyLight({ '--primary': { h: 240, s: 1, l: 0.64 } });
        const style = document.getElementById('theme-vars-light') as HTMLStyleElement;
        expect(style.innerHTML).toContain('--primary:240 100% 64%');
    });
});

describe('buildStyleContent', () => {
    it('selector + comp → `selector{rules}`', () => {
        const content = buildStyleContent(':root', { '--primary': { h: 240, s: 1, l: 0.64 } });
        expect(content).toBe(':root{--primary:240 100% 64%}');
    });

    it('.dark 选择器同样拼接', () => {
        const content = buildStyleContent('.dark', { '--background': { h: 240, s: 0.1, l: 0.04 } });
        expect(content).toBe('.dark{--background:240 10% 4%}');
    });

    it('空 comp → `selector{}`', () => {
        expect(buildStyleContent(':root', {})).toBe(':root{}');
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

    it('C5 diff：相同 comp 重复 applyDark 不重写 innerHTML', () => {
        const comp = { '--background': { h: 240, s: 0.1, l: 0.04 } };
        applyDark(comp);
        const style = document.getElementById('theme-vars-dark') as HTMLStyleElement;
        const firstContent = style.innerHTML;
        const spy = vi.spyOn(style, 'innerHTML', 'set');
        applyDark(comp);
        expect(style.innerHTML).toBe(firstContent);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('C5 diff：comp 变化时正常重写（对称 applyLight 用例）', () => {
        applyDark({ '--background': { h: 240, s: 0.1, l: 0.04 } });
        const style = document.getElementById('theme-vars-dark') as HTMLStyleElement;
        const spy = vi.spyOn(style, 'innerHTML', 'set');
        applyDark({ '--background': { h: 200, s: 0.2, l: 0.1 } });
        // setter 被触发（diff 未命中 → 重写）
        expect(spy).toHaveBeenCalled();
        // 内容正确：新 comp 拼接结果
        expect(style.innerHTML).toBe('.dark{--background:200 20% 10%}');
        spy.mockRestore();
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

describe('buildScopedCss', () => {
    // 用途：ThemePreview 同屏 split，两容器各自 scope CSS 变量绕过全局 .dark。
    // 复用 formatCssRules（已含 KEY_RE 白名单 + hsl 校验）。
    it('返回 .scopeClass{formatCssRules(comp)} 形式', () => {
        const css = buildScopedCss('brand-preview-a', { '--primary': { h: 240, s: 1, l: 0.64 } });
        expect(css).toBe('.brand-preview-a{--primary:240 100% 64%}');
    });

    it('结果含 scopeClass 选择器前缀', () => {
        const css = buildScopedCss('my-scope', { '--background': { h: 0, s: 0, l: 1 } });
        expect(css.startsWith('.my-scope{')).toBe(true);
        expect(css.endsWith('}')).toBe(true);
    });

    it('空 comp → 仅 .scopeClass{}（formatCssRules 返空串）', () => {
        expect(buildScopedCss('empty', {})).toBe('.empty{}');
    });

    it('非法 key 被白名单过滤（复用 formatCssRules 的 KEY_RE）', () => {
        const css = buildScopedCss('s', {
            'evil;}:root{--x': { h: 0, s: 0, l: 0 }, // 非法 key
            '--primary': { h: 240, s: 1, l: 0.5 },
        });
        // 非法 key 被跳过，只保留合法项
        expect(css).toBe('.s{--primary:240 100% 50%}');
    });

    it('非法 hsl 数值被跳过（s>1）', () => {
        const css = buildScopedCss('s', {
            '--bad': { h: 0, s: 2, l: 0.5 }, // s 越界
            '--ok': { h: 0, s: 1, l: 0.5 },
        });
        expect(css).toBe('.s{--ok:0 100% 50%}');
    });
});
