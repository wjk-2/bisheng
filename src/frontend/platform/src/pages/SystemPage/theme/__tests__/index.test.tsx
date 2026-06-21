// @vitest-environment jsdom
/**
 * Theme orchestrator RTL 集成测试 —— 3B.5 步骤 6 装配层验收。
 *
 * 验证装配契约（非组件内部，4 组件有独立测试）：
 *   - 单向数据流：preview 联动（BrandPicker/PresetThemes → previewTheme → derived 刷新）
 *   - commit：应用按钮 / bg → commitTheme 统一路径
 *   - M1 闭环：commit 失败 toast 不白屏
 *   - M2 闭环：bg 走 commitTheme（非老序列化）、onConflict 透传、_lock_version 来自 versionRef
 *   - v2 降级 banner：检测 / 不显示 / 关闭
 *
 * mock 策略：mock themeApply 三函数（验证 orchestrator 调用契约）+ persistence + toast；
 *   4 组件真渲染（集成真实）；deriveTheme 真跑（纯函数无副作用，orchestrator 初值用它）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PRESETS, type BrandValue } from '../presets';

// ---- mock themeApply（装配契约核心断言点）----
const previewThemeMock = vi.fn((_brand: BrandValue, _neutral: { preset: string }) => ({
    light: { '--primary': { h: 220, s: 0.8, l: 0.5 } },
    dark: { '--primary': { h: 220, s: 0.7, l: 0.6 } },
}));
const commitThemeMock = vi.fn().mockResolvedValue(undefined);
const resetThemeMock = vi.fn();
vi.mock('@/services/theme/themeApply', () => ({
    previewTheme: (b: BrandValue, n: { preset: string }) => previewThemeMock(b, n),
    commitTheme: (...args: unknown[]) => commitThemeMock(...args),
    resetTheme: () => resetThemeMock(),
}));

// ---- mock persistence（orchestrator 装配 ApplyDeps）----
const getCurrentVersionMock = vi.fn().mockResolvedValue(0);
const saveThemeDebouncedMock = vi.fn().mockResolvedValue(undefined);
const cancelPendingSaveMock = vi.fn();
vi.mock('@/services/theme/themePersistence', () => ({
    getCurrentVersion: () => getCurrentVersionMock(),
    saveThemeDebounced: (...a: unknown[]) => saveThemeDebouncedMock(...a),
    cancelPendingSave: () => cancelPendingSaveMock(),
}));

// ---- mock toast（M1 反馈断言）----
const toastMock = vi.fn();
vi.mock('@/components/bs-ui/toast/use-toast', () => ({
    toast: (...a: unknown[]) => toastMock(...a),
}));

// ---- mock i18n（与 4 组件测试一致：t 返回 key 本身）----
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-Hans' } }),
}));

import Theme from '../index';

/** 设 window.ThemeStyle 为 v3 数据（无 legacy banner）。 */
function setV3ThemeStyle(): void {
    (window as unknown as { ThemeStyle: unknown }).ThemeStyle = {
        light: { '--primary': { h: 220, s: 0.8, l: 0.5 } },
        dark: { '--primary': { h: 220, s: 0.7, l: 0.6 } },
        bg: 'logo',
        v3Schema: true,
        brand: { ...PRESETS[0].brand },
        neutral: { preset: 'slate' },
        _lock_version: 3,
    };
}

/** 设 window.ThemeStyle 为 v2 数据（有 light 无 v3Schema → 触发 legacy banner）。 */
function setV2ThemeStyle(): void {
    (window as unknown as { ThemeStyle: unknown }).ThemeStyle = {
        light: { '--primary': { h: 200, s: 0.5, l: 0.4 } },
        dark: { '--primary': { h: 200, s: 0.5, l: 0.6 } },
        bg: 'logo',
    };
}

beforeEach(() => {
    previewThemeMock.mockClear();
    commitThemeMock.mockClear();
    commitThemeMock.mockResolvedValue(undefined);
    resetThemeMock.mockClear();
    getCurrentVersionMock.mockClear();
    saveThemeDebouncedMock.mockClear();
    cancelPendingSaveMock.mockClear();
    toastMock.mockClear();
    (window as unknown as { __themeVersion?: number }).__themeVersion = 5;
    setV3ThemeStyle();
});

describe('Theme orchestrator —— 渲染与初始', () => {
    it('① 渲染不崩，4 子组件容器 + 应用按钮都在', () => {
        render(<Theme />);
        expect(screen.getByTestId('brand-light-text')).toBeInTheDocument();
        expect(screen.getByTestId(`preset-${PRESETS[0].id}`)).toBeInTheDocument();
        expect(screen.getByTestId('derived-light')).toBeInTheDocument();
        expect(screen.getByTestId('theme-preview-light')).toBeInTheDocument();
        expect(screen.getByTestId('theme-apply')).toBeInTheDocument();
    });

    it('② mount 不调 previewTheme（初值用纯 deriveTheme，不污染线上态）', () => {
        render(<Theme />);
        // 关键不变量：组件 mount 仅渲染，不写 #theme-vars-preview（用户未调色）
        expect(previewThemeMock).not.toHaveBeenCalled();
    });
});

describe('Theme orchestrator —— preview 联动（编辑态）', () => {
    it('③ 点 preset → previewTheme 被调（参数为该 preset.brand + slate）', () => {
        render(<Theme />);
        fireEvent.click(screen.getByTestId(`preset-${PRESETS[2].id}`));
        expect(previewThemeMock).toHaveBeenCalledTimes(1);
        expect(previewThemeMock).toHaveBeenCalledWith(PRESETS[2].brand, { preset: 'slate' });
    });

    it('④ BrandPicker 合法 hex 输入 → previewTheme 被调（新 brand）', () => {
        render(<Theme />);
        fireEvent.change(screen.getByTestId('brand-light-text'), { target: { value: '#000000' } });
        expect(previewThemeMock).toHaveBeenCalled();
        const lastCall = previewThemeMock.mock.calls[previewThemeMock.mock.calls.length - 1];
        expect((lastCall[0] as BrandValue).light.toLowerCase()).toBe('#000000');
    });

    it('⑤ preview 不调 commitTheme（编辑态不落库）', () => {
        render(<Theme />);
        fireEvent.click(screen.getByTestId(`preset-${PRESETS[1].id}`));
        fireEvent.change(screen.getByTestId('brand-light-text'), { target: { value: '#112233' } });
        expect(commitThemeMock).not.toHaveBeenCalled();
    });
});

describe('Theme orchestrator —— commit（应用按钮）', () => {
    it('⑥ 点应用 → commitTheme 调一次，参数含 brand/neutral/bg/_lock_version + deps + onConflict', async () => {
        render(<Theme />);
        fireEvent.click(screen.getByTestId('theme-apply'));
        await waitFor(() => expect(commitThemeMock).toHaveBeenCalledTimes(1));
        const [input, deps, onConflict] = commitThemeMock.mock.calls[0];
        expect((input as { neutral: unknown }).neutral).toEqual({ preset: 'slate' });
        expect((input as { bg: string }).bg).toBe('logo');
        expect((input as { _lock_version: number })._lock_version).toBe(5); // versionRef 初值 __themeVersion
        expect((input as { brand: BrandValue }).brand).toEqual(PRESETS[0].brand);
        expect(deps).toBeDefined();
        expect(typeof onConflict).toBe('function');
    });

    it('⑦ commit 成功 → 成功 toast（theme.applied）', async () => {
        render(<Theme />);
        fireEvent.click(screen.getByTestId('theme-apply'));
        await waitFor(() => expect(toastMock).toHaveBeenCalled());
        const arg = toastMock.mock.calls[0][0] as { variant: string; description: string };
        expect(arg.variant).toBe('success');
        expect(arg.description).toBe('theme.applied');
    });

    it('⑧ commit 失败 → 失败 toast（theme.applyFailed），不抛不白屏（M1/M3 闭环）', async () => {
        commitThemeMock.mockRejectedValueOnce(new Error('boom'));
        render(<Theme />);
        fireEvent.click(screen.getByTestId('theme-apply'));
        await waitFor(() => expect(toastMock).toHaveBeenCalled());
        const arg = toastMock.mock.calls[0][0] as { variant: string; description: string };
        expect(arg.variant).toBe('error');
        expect(arg.description).toBe('theme.applyFailed');
        // 不白屏：应用按钮仍在
        expect(screen.getByTestId('theme-apply')).toBeInTheDocument();
    });
});

describe('Theme orchestrator —— reset', () => {
    it('⑨ 点还原默认 → resetTheme 被调 + brand 回 PRESETS[0] + 不 commit', () => {
        render(<Theme />);
        // 先改成别的 preset
        fireEvent.click(screen.getByTestId(`preset-${PRESETS[3].id}`));
        previewThemeMock.mockClear();
        // 点还原默认（t 返回 key，按钮文案 theme.restoreDefault）
        fireEvent.click(screen.getByText('theme.restoreDefault'));
        expect(resetThemeMock).toHaveBeenCalledTimes(1);
        // 还原后 previewTheme 被调 with PRESETS[0]
        expect(previewThemeMock).toHaveBeenCalledWith(PRESETS[0].brand, { preset: 'slate' });
        // 还原不自动落库
        expect(commitThemeMock).not.toHaveBeenCalled();
    });
});

describe('Theme orchestrator —— bg（M2 统一路径）', () => {
    it('⑩ bg 切 gradient → commitTheme 被调（bg 走统一路径，非老序列化），参数 bg:gradient', async () => {
        render(<Theme />);
        // RadioGroupItem value=gradient
        fireEvent.click(screen.getByText('theme.themeColorGradientEffect'));
        await waitFor(() => expect(commitThemeMock).toHaveBeenCalled());
        const [input] = commitThemeMock.mock.calls[0];
        expect((input as { bg: string }).bg).toBe('gradient');
    });
});

describe('Theme orchestrator —— v2 降级 banner', () => {
    it('⑪ v2 数据 → legacy banner 渲染', () => {
        setV2ThemeStyle();
        render(<Theme />);
        expect(screen.getByTestId('legacy-v2-banner')).toBeInTheDocument();
    });

    it('⑫ v3 数据 → banner 不渲染', () => {
        setV3ThemeStyle();
        render(<Theme />);
        expect(screen.queryByTestId('legacy-v2-banner')).toBeNull();
    });

    it('⑬ 点 banner 关闭 → banner 消失', () => {
        setV2ThemeStyle();
        render(<Theme />);
        expect(screen.getByTestId('legacy-v2-banner')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('legacy-v2-banner-close'));
        expect(screen.queryByTestId('legacy-v2-banner')).toBeNull();
    });
});
