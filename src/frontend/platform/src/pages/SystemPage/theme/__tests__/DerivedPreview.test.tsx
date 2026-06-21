// @vitest-environment jsdom
/**
 * DerivedPreview RTL 测试 —— 3B.5 步骤 2.1。
 *
 * 锁定契约：只读展示派生结果（22 令牌 × light/dark）+ 标注固定语义色（不随品牌变）。
 * 无 onChange（纯展示）。i18n key 缺失时显示 key 本身，可接受。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { deriveTheme } from '@shared/theme/themeConfig';
import { PRESETS } from '../presets';
import { hslToRgb, rgbToHex } from '@shared/theme/colorUtils';
import type { CompTheme } from '@shared/theme/themeConfig';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-Hans' } }),
}));

import DerivedPreview from '../DerivedPreview';

const { light, dark } = deriveTheme(PRESETS[0].brand, { preset: 'slate' });

/** 复用组件内同样的换算：CompTheme HSL（0-1 制）→ hex，用于断言色块展示文本。 */
function compToHex(comp: CompTheme, key: string): string {
    const { h, s, l } = comp[key];
    const { r, g, b } = hslToRgb(h, s * 100, l * 100);
    return rgbToHex(r, g, b);
}

describe('DerivedPreview', () => {
    it('渲染 light 与 dark 两套色板区域', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        expect(screen.getByTestId('derived-light')).toBeInTheDocument();
        expect(screen.getByTestId('derived-dark')).toBeInTheDocument();
    });

    it('light 色板含多个令牌色块（数量 > 0）', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        const lightPanel = screen.getByTestId('derived-light');
        const swatches = within(lightPanel).getAllByTestId(/^swatch-/);
        expect(swatches.length).toBeGreaterThan(0);
    });

    it('含 --primary 色块并显示对应 hex', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        const lightPanel = screen.getByTestId('derived-light');
        const primary = within(lightPanel).getByTestId('swatch---primary');
        expect(primary).toBeInTheDocument();
        expect(primary).toHaveTextContent(compToHex(light, '--primary'));
    });

    it('dark 色板 --primary 与 light 不同（验证两套独立派生）', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        const lightPrimary = within(screen.getByTestId('derived-light')).getByTestId('swatch---primary');
        const darkPrimary = within(screen.getByTestId('derived-dark')).getByTestId('swatch---primary');
        expect(lightPrimary.textContent).not.toBe(darkPrimary.textContent);
    });

    it('存在固定语义色分区（destructive/warning）', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        expect(screen.getByTestId('semantic-fixed')).toBeInTheDocument();
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('--destructive');
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('--warning');
    });

    it('固定语义色分区标注「不随品牌色变化」说明', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        const fixed = screen.getByTestId('semantic-fixed');
        // i18n key 中含 fixed 提示 key（文案步骤 5 补），断言该说明存在
        expect(fixed).toHaveTextContent(/theme\.semantic\.fixed/i);
    });

    it('列出 status-* 状态色（业务固定色，不在 CompTheme 中）', () => {
        render(<DerivedPreview light={light} dark={dark} />);
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('status-blue');
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('status-green');
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('status-red');
        expect(screen.getByTestId('semantic-fixed')).toHaveTextContent('status-yellow');
    });
});
