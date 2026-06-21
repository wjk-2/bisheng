/**
 * presets 单元测试 —— 锁定 8 个学术品牌预设的数据契约。
 *
 * 校验：数量、id 唯一/非空、labelKey 非空、brand.light/dark 均为合法 #rrggbb、
 * darkMode 默认 false（本步骤仅记录偏好，不切全局 mode）。
 */
import { describe, it, expect } from 'vitest';
import { PRESETS } from '../presets';
import { isValidHex } from '@shared/theme/colorUtils';

describe('PRESETS', () => {
    it('数量为 8', () => {
        expect(PRESETS).toHaveLength(8);
    });

    it('每个 preset 的 id 非空', () => {
        for (const p of PRESETS) {
            expect(p.id).toBeTruthy();
        }
    });

    it('每个 preset 的 labelKey 非空', () => {
        for (const p of PRESETS) {
            expect(p.labelKey).toBeTruthy();
        }
    });

    it('id 全局唯一', () => {
        const ids = PRESETS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个 brand.light 为合法 #rrggbb', () => {
        for (const p of PRESETS) {
            expect(isValidHex(p.brand.light)).toBe(true);
        }
    });

    it('每个 brand.dark 为合法 #rrggbb', () => {
        for (const p of PRESETS) {
            expect(isValidHex(p.brand.dark)).toBe(true);
        }
    });

    it('每个 brand.darkMode 默认 false（本步骤仅记录偏好）', () => {
        for (const p of PRESETS) {
            expect(p.brand.darkMode).toBe(false);
        }
    });

    it('brand.light ≠ brand.dark（dark 是独立适配值）', () => {
        for (const p of PRESETS) {
            expect(p.brand.light).not.toBe(p.brand.dark);
        }
    });

    it('包含学术蓝 #2563EB 预设', () => {
        expect(PRESETS.some((p) => p.brand.light.toLowerCase() === '#2563eb')).toBe(true);
    });
});
