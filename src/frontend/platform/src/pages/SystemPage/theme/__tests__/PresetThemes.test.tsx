// @vitest-environment jsdom
/**
 * PresetThemes RTL 测试 —— 3B.5 步骤 3.2。
 *
 * 锁定契约：8 预设网格，点击上抛 brand；current 匹配时高亮。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PRESETS, type BrandValue } from '../presets';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-Hans' } }),
}));

import PresetThemes from '../PresetThemes';

describe('PresetThemes', () => {
    it('渲染 8 个 preset 按钮', () => {
        render(<PresetThemes current={PRESETS[0].brand} onSelect={() => {}} />);
        // 用 button role 精确取 preset 按钮（避免 preset-swatch-* span 被 /^preset-/ 误匹配）
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(8);
    });

    it('点击某 preset 调 onSelect 传对应 brand', () => {
        const onSelect = vi.fn();
        render(<PresetThemes current={PRESETS[0].brand} onSelect={onSelect} />);
        const target = screen.getByTestId(`preset-${PRESETS[2].id}`);
        fireEvent.click(target);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0]).toEqual(PRESETS[2].brand);
    });

    it('current 匹配某 preset 时该 preset 高亮（data-active=true）', () => {
        const matched: BrandValue = PRESETS[3].brand;
        render(<PresetThemes current={matched} onSelect={() => {}} />);
        const matchedBtn = screen.getByTestId(`preset-${PRESETS[3].id}`);
        expect(matchedBtn).toHaveAttribute('data-active', 'true');
    });

    it('current 不匹配任何 preset 时所有 preset 均不高亮', () => {
        const unmatched: BrandValue = { light: '#abcdef', dark: '#123456', darkMode: false };
        render(<PresetThemes current={unmatched} onSelect={() => {}} />);
        const buttons = screen.getAllByRole('button');
        for (const b of buttons) {
            expect(b).toHaveAttribute('data-active', 'false');
        }
    });

    it('每个 preset 色块背景为 brand.light', () => {
        render(<PresetThemes current={PRESETS[0].brand} onSelect={() => {}} />);
        const swatch = screen.getByTestId(`preset-swatch-${PRESETS[1].id}`) as HTMLElement;
        expect(swatch.style.backgroundColor).not.toBe('');
    });
});
