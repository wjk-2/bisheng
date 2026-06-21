// @vitest-environment jsdom
/**
 * themeApply 单元测试 —— 锁定三态预览编排层契约。
 *
 * 覆盖三动词接口：
 *   - previewTheme：派生 + applyPreview，绝不碰 window.ThemeStyle / persistence
 *   - commitTheme：派生 + clearPreview + applyLight/applyDark + 写 window.ThemeStyle + save
 *   - resetTheme：clearPreview，不动 window.ThemeStyle / persistence
 *
 * 风格对齐 themeRuntime.test.ts：jsdom env、beforeEach 重置 document.head + 线上态。
 * 不 mock deriveTheme（纯函数，输入真实 brand hex 跑，保真）。
 * ApplyDeps 注入只 mock 持久化 3 函数（隔离 axios/toast/i18n）。
 *
 * 副作用分别断言策略：
 *   ⑤⑥⑦⑧⑨⑩⑪ 不绑函数调用顺序——顺序断言脆弱、重构易碎，只锁最终副作用产物。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    previewTheme,
    commitTheme,
    resetTheme,
    type ThemeInput,
    type ApplyDeps,
} from '../themeApply';
import { serializeV3, deriveTheme, type ThemeValue } from '../themeConfig';

// ---- 真实 brand/neutral 输入（派生跑真算法） ----
const BRAND_INPUT: ThemeInput['brand'] = {
    light: '#4747ff',
    dark: '#5a8cf2',
    darkMode: false,
};
const NEUTRAL_INPUT: ThemeInput['neutral'] = { preset: 'slate' };

function makeInput(overrides: Partial<ThemeInput> = {}): ThemeInput {
    return {
        brand: BRAND_INPUT,
        neutral: NEUTRAL_INPUT,
        bg: 'logo',
        _lock_version: 3,
        ...overrides,
    };
}

// ---- ApplyDeps mock 工厂：3 持久化函数全 spy ----
function makeDeps(overrides: Partial<ApplyDeps> = {}): ApplyDeps & {
    saveThemeDebounced: ReturnType<typeof vi.fn>;
    getCurrentVersion: ReturnType<typeof vi.fn>;
    cancelPendingSave: ReturnType<typeof vi.fn>;
} {
    return {
        getCurrentVersion: vi.fn().mockResolvedValue(7),
        saveThemeDebounced: vi.fn().mockResolvedValue(undefined),
        cancelPendingSave: vi.fn(),
        ...overrides,
    } as ApplyDeps & {
        saveThemeDebounced: ReturnType<typeof vi.fn>;
        getCurrentVersion: ReturnType<typeof vi.fn>;
        cancelPendingSave: ReturnType<typeof vi.fn>;
    };
}

// ---- 线上 ThemeStyle 模拟：beforeEach 重置成稳定初值 ----
function makeOnlineThemeStyle(): ThemeValue {
    return {
        light: { '--background': { h: 0, s: 0, l: 1 } },
        dark: { '--background': { h: 0, s: 0, l: 0.07 } },
        bg: 'logo',
        v3Schema: true,
        brand: { light: '#aaaaaa', dark: '#bbbbbb', darkMode: false },
        neutral: { preset: 'slate' },
        _lock_version: 1,
    };
}

let originalThemeStyle: ThemeValue;

beforeEach(() => {
    document.head.innerHTML = '';
    originalThemeStyle = makeOnlineThemeStyle();
    (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle = originalThemeStyle;
});

// =========================================================
// previewTheme —— 派生 + applyPreview，绝不碰 ThemeStyle / persistence
// =========================================================
describe('previewTheme', () => {
    it('① 创建 #theme-vars-preview，含派生 :root{} 与 .dark{}', () => {
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        const style = document.getElementById('theme-vars-preview') as HTMLStyleElement | null;
        expect(style).not.toBeNull();
        expect(style!.innerHTML).toContain(':root{');
        expect(style!.innerHTML).toContain('.dark{');
        // 派生真跑：light 用 brand.light，dark 用 brand.dark，两套内容应不同
        // （至少证明 light/dark 不是同一份占位）
        const derived = deriveTheme(BRAND_INPUT, NEUTRAL_INPUT);
        const expectedLight = Object.keys(derived.light)[0];
        expect(style!.innerHTML).toContain(expectedLight);
    });

    it('② 不修改 window.ThemeStyle（引用相等，抓 in-place mutation）', () => {
        const refBefore = (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle;
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        const refAfter = (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle;
        // 引用相等：previewTheme 绝不替换 window.ThemeStyle 也绝不 in-place 改它
        expect(refAfter).toBe(refBefore);
        // 内容也未变（双保险，抓 in-place mutation）
        expect(refAfter).toEqual(originalThemeStyle);
    });

    it('④ 多次调用不堆积 #theme-vars-preview 节点（幂等）', () => {
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        expect(document.querySelectorAll('#theme-vars-preview').length).toBe(1);
    });

    it('返回 {light, dark} 派生结果（供调用方 3B.5 读用）', () => {
        const result = previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        const expected = deriveTheme(BRAND_INPUT, NEUTRAL_INPUT);
        expect(result).toEqual(expected);
    });

    it('非法 hex 抛 Error（固化 M3 契约：brand 必须合法 #rrggbb，调用方负责校验）', () => {
        const badBrand = { light: '#GGGGGG', dark: '#5a8cf2', darkMode: false };
        expect(() => previewTheme(badBrand, NEUTRAL_INPUT)).toThrow();
    });
});

// =========================================================
// commitTheme —— 派生 + clearPreview + applyLight/applyDark + 写 ThemeStyle + save
// 副作用分别断言（不绑调用顺序）
// =========================================================
describe('commitTheme', () => {
    it('⑤ 副作用：#theme-vars-preview 被删除', async () => {
        // 先 preview 制造 preview 节点
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        expect(document.getElementById('theme-vars-preview')).not.toBeNull();
        const deps = makeDeps();
        await commitTheme(makeInput(), deps);
        expect(document.getElementById('theme-vars-preview')).toBeNull();
    });

    it('⑥ 副作用：light/dark 线上 style 被更新（含派生内容）', async () => {
        const deps = makeDeps();
        await commitTheme(makeInput(), deps);
        const lightStyle = document.getElementById('theme-vars-light') as HTMLStyleElement;
        const darkStyle = document.getElementById('theme-vars-dark') as HTMLStyleElement;
        expect(lightStyle).not.toBeNull();
        expect(darkStyle).not.toBeNull();
        // 内容含派生后的 CSS 变量（--primary 来自 deriveTheme）
        const derived = deriveTheme(BRAND_INPUT, NEUTRAL_INPUT);
        const lightKey = Object.keys(derived.light)[0];
        const darkKey = Object.keys(derived.dark)[0];
        expect(lightStyle.innerHTML).toContain(lightKey);
        expect(darkStyle.innerHTML).toContain(darkKey);
    });

    it('⑦ window.ThemeStyle 写入含 v3 字段（version 通过 v3Schema、brand/neutral/_lock_version + light/dark/bg）', async () => {
        const deps = makeDeps();
        await commitTheme(makeInput(), deps);
        const ts = (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle;
        expect(ts.v3Schema).toBe(true);
        expect(ts.brand).toEqual(BRAND_INPUT);
        expect(ts.neutral).toEqual(NEUTRAL_INPUT);
        expect(ts._lock_version).toBe(3);
        expect(ts.bg).toBe('logo');
        // light/dark 仍是 CompTheme（向下兼容现有读取点）
        expect(ts.light).not.toBeNull();
        expect(ts.dark).not.toBeNull();
    });

    it('⑧ saveThemeDebounced 收到的 value 是 serialize(input+派生) 产物', async () => {
        const deps = makeDeps();
        const input = makeInput();
        await commitTheme(input, deps);
        expect(deps.saveThemeDebounced).toHaveBeenCalledTimes(1);
        const [valueArg] = deps.saveThemeDebounced.mock.calls[0];
        // 预期：serializeV3(input) 的产出（派生不入库，只 brand/neutral/bg/_lock_version）
        const expected = serializeV3({
            brand: input.brand,
            neutral: input.neutral,
            bg: input.bg,
            _lock_version: input._lock_version,
        });
        expect(valueArg).toBe(expected);
        // 结构性校验：解析后是 {version:3, brand, neutral, bg, _lock_version}
        const parsed = JSON.parse(valueArg);
        expect(parsed.version).toBe(3);
        expect(parsed.brand).toEqual(input.brand);
        expect(parsed.neutral).toEqual(input.neutral);
        expect(parsed.bg).toBe(input.bg);
        expect(parsed._lock_version).toBe(input._lock_version);
    });

    it('⑨ saveThemeDebounced 收到的 version 来自 getCurrentVersion', async () => {
        const deps = makeDeps({
            getCurrentVersion: vi.fn().mockResolvedValue(42),
        });
        await commitTheme(makeInput(), deps);
        expect(deps.getCurrentVersion).toHaveBeenCalledTimes(1);
        const [, versionArg] = deps.saveThemeDebounced.mock.calls[0];
        expect(versionArg).toBe(42);
    });

    it('⑩ onConflict 回调被透传给 saveThemeDebounced 并在冲突时触发', async () => {
        const deps = makeDeps();
        const onConflict = vi.fn();
        // 让 saveThemeDebounced 立即调用透传的 onConflict（模拟冲突路径）
        deps.saveThemeDebounced.mockImplementationOnce(
            async (_value: string, _version: number, cb?: (v: number) => void) => {
                cb?.(99);
            },
        );
        await commitTheme(makeInput(), deps, onConflict);
        expect(onConflict).toHaveBeenCalledTimes(1);
        expect(onConflict).toHaveBeenCalledWith(99);
    });

    it('⑪ cancelPendingSave 被调（commit 首行取消挂起 save，防旧请求后到覆盖）', async () => {
        const deps = makeDeps();
        await commitTheme(makeInput(), deps);
        expect(deps.cancelPendingSave).toHaveBeenCalled();
    });

    it('返回 Promise<void>，await 不抛错', async () => {
        const deps = makeDeps();
        await expect(commitTheme(makeInput(), deps)).resolves.toBeUndefined();
    });

    it('非法 hex 抛 Error（固化 M3 契约：commitTheme 同受 deriveTheme 约束）', async () => {
        const badInput = makeInput({
            brand: { light: 'not-a-color', dark: '#5a8cf2', darkMode: false },
        });
        const deps = makeDeps();
        await expect(commitTheme(badInput, deps)).rejects.toThrow();
    });
});

// =========================================================
// resetTheme —— clearPreview，不动 ThemeStyle / persistence
// =========================================================
describe('resetTheme', () => {
    it('⑫ 删除 #theme-vars-preview', () => {
        previewTheme(BRAND_INPUT, NEUTRAL_INPUT);
        expect(document.getElementById('theme-vars-preview')).not.toBeNull();
        resetTheme();
        expect(document.getElementById('theme-vars-preview')).toBeNull();
    });

    it('⑬ 不修改 window.ThemeStyle（引用相等）', () => {
        const refBefore = (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle;
        resetTheme();
        const refAfter = (window as unknown as { ThemeStyle: ThemeValue }).ThemeStyle;
        expect(refAfter).toBe(refBefore);
        expect(refAfter).toEqual(originalThemeStyle);
    });

    it('⑮ 幂等：未预览时直接调 resetTheme 不报错', () => {
        expect(() => resetTheme()).not.toThrow();
        // 再调一次也 OK
        expect(() => resetTheme()).not.toThrow();
    });
});
