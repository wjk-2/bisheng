// @vitest-environment jsdom
/**
 * BrandPicker RTL 测试 —— 3B.5 步骤 3.1。
 *
 * 锁定契约：light + dark 两套 hex 输入（color + text）+ darkMode 开关；
 * 三态校验：合法调 onChange / 中间态（#123）不调 / 非法（#GGG）不调。
 * onChange 仅在 light+dark 同时合法时才上抛。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PRESETS, type BrandValue } from '../presets';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-Hans' } }),
}));

import BrandPicker from '../BrandPicker';

const initial: BrandValue = PRESETS[0].brand; // light:#2563EB dark:#60A5FA darkMode:false

describe('BrandPicker', () => {
    it('初始 value 正确渲染（light/dark text + darkMode）', () => {
        render(<BrandPicker value={initial} onChange={() => {}} />);
        const lightText = screen.getByTestId('brand-light-text') as HTMLInputElement;
        const darkText = screen.getByTestId('brand-dark-text') as HTMLInputElement;
        expect(lightText.value.toLowerCase()).toBe('#2563eb');
        expect(darkText.value.toLowerCase()).toBe('#60a5fa');
    });

    it('合法 hex 输入调 onChange（light text → 合法值）', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        const lightText = screen.getByTestId('brand-light-text');
        fireEvent.change(lightText, { target: { value: '#000000' } });
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0][0] as BrandValue;
        expect(next.light.toLowerCase()).toBe('#000000');
        // 其它字段保留
        expect(next.dark).toBe(initial.dark);
        expect(next.darkMode).toBe(initial.darkMode);
    });

    it('非法 hex（#GGG）不调 onChange 且 UI 进入非法态', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        const lightText = screen.getByTestId('brand-light-text');
        fireEvent.change(lightText, { target: { value: '#GGG' } });
        expect(onChange).not.toHaveBeenCalled();
        // 非法标记存在
        expect(screen.getByTestId('brand-light-invalid')).toBeInTheDocument();
    });

    it('中间态（#123）不调 onChange 且 UI 进入输入中态', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        const lightText = screen.getByTestId('brand-light-text');
        fireEvent.change(lightText, { target: { value: '#123' } });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('brand-light-pending')).toBeInTheDocument();
    });

    it('type=color change 同步 text + 调 onChange', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        const lightColor = screen.getByTestId('brand-light-color') as HTMLInputElement;
        fireEvent.change(lightColor, { target: { value: '#abcdef' } });
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0][0] as BrandValue;
        expect(next.light.toLowerCase()).toBe('#abcdef');
    });

    it('darkMode Switch 切换调 onChange（darkMode 字段更新）', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        const darkSwitch = screen.getByTestId('brand-darkmode-switch');
        fireEvent.click(darkSwitch);
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0][0] as BrandValue;
        expect(next.darkMode).toBe(true);
    });

    it('light 进入中间态时 dark 合法修改仍不调 onChange（两端需同时合法）', () => {
        const onChange = vi.fn();
        render(<BrandPicker value={initial} onChange={onChange} />);
        // 先把 light 弄成中间态
        fireEvent.change(screen.getByTestId('brand-light-text'), { target: { value: '#123' } });
        // 再改 dark 为合法值
        fireEvent.change(screen.getByTestId('brand-dark-text'), { target: { value: '#00ff00' } });
        // onChange 仍不应触发（light 中间态）
        expect(onChange).not.toHaveBeenCalled();
    });
});
