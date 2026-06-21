// @vitest-environment jsdom
/**
 * ThemePreview RTL 测试 —— 3B.5 步骤 2.2。
 *
 * 锁定契约：业务 mock + light/dark 同屏 split，靠 scope class 隔离 CSS 变量。
 * 不引 reactflow，工作流用 div+SVG。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { deriveTheme } from '@shared/theme/themeConfig';
import { buildScopedCss } from '@shared/theme/themeRuntime';
import { PRESETS } from '../presets';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-Hans' } }),
}));

import ThemePreview from '../ThemePreview';

const { light, dark } = deriveTheme(PRESETS[0].brand, { preset: 'slate' });

describe('ThemePreview', () => {
    it('渲染 light 与 dark 两个 scope 容器', () => {
        render(<ThemePreview light={light} dark={dark} />);
        expect(screen.getByTestId('theme-preview-light')).toBeInTheDocument();
        expect(screen.getByTestId('theme-preview-dark')).toBeInTheDocument();
    });

    it('light 容器注入 buildScopedCss 产出的 <style>', () => {
        const { container } = render(<ThemePreview light={light} dark={dark} />);
        const styles = container.querySelectorAll('style');
        expect(styles.length).toBeGreaterThan(0);
        const allCss = Array.from(styles).map((s) => s.textContent || '').join('\n');
        expect(allCss).toContain(buildScopedCss('theme-preview-light', light));
    });

    it('dark 容器注入的 CSS 与 light 不同（--primary 值不同）', () => {
        const { container } = render(<ThemePreview light={light} dark={dark} />);
        const allCss = Array.from(container.querySelectorAll('style')).map((s) => s.textContent || '').join('\n');
        const lightScoped = buildScopedCss('theme-preview-light', light);
        const darkScoped = buildScopedCss('theme-preview-dark', dark);
        expect(allCss).toContain(lightScoped);
        expect(allCss).toContain(darkScoped);
        expect(lightScoped).not.toBe(darkScoped);
    });

    it('两个容器内均渲染业务 mock 元件（Button）', () => {
        render(<ThemePreview light={light} dark={dark} />);
        // 每个容器有多个 Button（default/outline/secondary），用 getAllByRole
        const lightContainer = screen.getByTestId('theme-preview-light');
        const darkContainer = screen.getByTestId('theme-preview-dark');
        expect(within(lightContainer).getAllByRole('button').length).toBeGreaterThan(0);
        expect(within(darkContainer).getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('渲染工作流 mock（节点+连线 SVG，不引 reactflow）', () => {
        const { container } = render(<ThemePreview light={light} dark={dark} />);
        const svgs = container.querySelectorAll('svg');
        expect(svgs.length).toBeGreaterThan(0);
    });

    it('渲染对话 mock（用户/助手气泡）', () => {
        render(<ThemePreview light={light} dark={dark} />);
        // i18n mock 返回 key 本身，对话气泡 key 为 theme.preview.chatUser / chatAssistant
        expect(screen.getAllByText(/theme\.preview\.chat/i).length).toBeGreaterThan(0);
    });
});
