/**
 * colorUtils 单元测试 —— 验证标准 sRGB / WCAG 颜色数学算法的正确性。
 *
 * 断言值来自规范定义的已知结果（白/黑/纯红/纯绿等基本色），用于锁定
 * 3B.3 派生算法底层工具的行为契约。
 */
import { describe, it, expect } from 'vitest';
import {
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    relativeLuminance,
    contrastRatio,
    pickForeground,
} from '@shared/theme/colorUtils';

describe('hexToRgb', () => {
    it('#ffffff → {255,255,255}', () => {
        expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });
    it('#3b82f6 → {59,130,246}', () => {
        expect(hexToRgb('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
    });
    it('000000 无 # 也能解析 → {0,0,0}', () => {
        expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
    });
    it('大写 #FF8000 → {255,128,0}', () => {
        expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 });
    });
    it('非法输入抛错', () => {
        expect(() => hexToRgb('#ff')).toThrow();
        expect(() => hexToRgb('xyz123')).toThrow();
    });
});

describe('rgbToHex', () => {
    it('(0,0,0) → #000000', () => {
        expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
    it('(255,128,0) → #ff8000', () => {
        expect(rgbToHex(255, 128, 0)).toBe('#ff8000');
    });
    it('clamp：(-10, 300, 128) → #00ff80', () => {
        expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
    });
    it('浮点四舍五入：255.4 → ff, 255.6 → ff', () => {
        expect(rgbToHex(255.4, 255.6, 0)).toBe('#ffff00');
    });
});

describe('rgbToHsl', () => {
    it('(255,0,0) 纯红 → {0,100,50}', () => {
        expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    });
    it('(0,255,0) 纯绿 → {120,100,50}', () => {
        expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 });
    });
    it('(0,0,255) 纯蓝 → {240,100,50}', () => {
        expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });
    });
    it('(255,255,255) 纯白 → {0,0,100}（灰度 s=0）', () => {
        expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 });
    });
    it('(0,0,0) 纯黑 → {0,0,0}', () => {
        expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
    });
});

describe('hslToRgb', () => {
    it('(0,100,50) 纯红 → {255,0,0}', () => {
        expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });
    });
    it('(120,100,50) 纯绿 → {0,255,0}', () => {
        expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 });
    });
    it('(240,100,50) 纯蓝 → {0,0,255}', () => {
        expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 });
    });
});

describe('HSL 往返精度（rgbToHsl → hslToRgb）', () => {
    const cases: Array<[number, number, number]> = [
        [59, 130, 246], // tailwind blue-500
        [234, 88, 12], // orange
        [128, 128, 128], // 中灰
        [200, 50, 100],
    ];
    cases.forEach(([r, g, b]) => {
        it(`rgb(${r},${g},${b}) 往返误差 < 0.5`, () => {
            const hsl = rgbToHsl(r, g, b);
            const back = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(Math.abs(back.r - r)).toBeLessThan(0.5);
            expect(Math.abs(back.g - g)).toBeLessThan(0.5);
            expect(Math.abs(back.b - b)).toBeLessThan(0.5);
        });
    });
});

describe('relativeLuminance', () => {
    it('(255,255,255) 纯白 → 1.0（±0.001）', () => {
        expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 3);
    });
    it('(0,0,0) 纯黑 → 0.0', () => {
        expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 5);
    });
});

describe('contrastRatio', () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    it('黑白对比 ≈ 21（20.9~21.0）', () => {
        const ratio = contrastRatio(white, black);
        expect(ratio).toBeGreaterThanOrEqual(20.9);
        expect(ratio).toBeLessThanOrEqual(21.0);
    });
    it('同色对比 = 1.0', () => {
        expect(contrastRatio(black, black)).toBe(1);
        expect(contrastRatio(white, white)).toBe(1);
    });
    it('参数顺序无关', () => {
        expect(contrastRatio(white, black)).toBeCloseTo(contrastRatio(black, white), 10);
    });
});

describe('pickForeground', () => {
    it('#3b82f6 蓝底 → 黑字（WCAG 相对亮度 0.235，黑字对比比 5.71 > 白字 3.68）', () => {
        // 任务单原写「白字」，但 WCAG 算法实测蓝底相对亮度 0.235 偏暗，
        // 黑字对比比 (5.71) > 白字对比比 (3.68)。算法遵循规范，修正此断言。
        expect(pickForeground('#3b82f6')).toBe('#000000');
    });
    it('#ffff00 黄底 → 黑字', () => {
        expect(pickForeground('#ffff00')).toBe('#000000');
    });
    it('#000000 黑底 → 白字', () => {
        expect(pickForeground('#000000')).toBe('#ffffff');
    });
    it('#ffffff 白底 → 黑字', () => {
        expect(pickForeground('#ffffff')).toBe('#000000');
    });
});
