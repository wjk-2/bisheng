/**
 * deriveTheme 单元测试 —— 锁定 3B.3 品牌色派生算法（brand hex → 22 令牌 × 2 模式）。
 *
 * 派生契约（plan §3B.3）：
 *   输入：{ brand:{light,dark,darkMode}, neutral:{preset} }
 *   输出：{ light: CompTheme, dark: CompTheme }，22 个 ThemeVarKey 全覆盖
 *   制式：CompTheme 的 s/l 为 0-1 制（与 DEFAULT_*_THEME 对齐，与 themeRuntime
 *         的 `s*100+'%'` 拼接约定一致）
 *
 * 测试维度：
 *   1. 结构与令牌完整性（22 个 ThemeVarKey 全部存在）
 *   2. 制式正确（所有 s/l ∈ [0,1]，h ∈ [0,360)）
 *   3. WCAG 硬性：primary-foreground 对 primary 的对比比 ≥ 4.5（可读性底线）
 *   4. 品牌色本体：light.primary 来自 brand.light、dark.primary 来自 brand.dark
 *   5. 中性灰阶映射：background/foreground/border 等关键令牌对应 Radix step 的换算值
 *   6. snapshot：固定 brand 派生结果锁定（防回归）
 */
import { describe, it, expect } from 'vitest';
import {
    deriveTheme,
    DEFAULT_LIGHT_THEME,
    DEFAULT_DARK_THEME,
    NEUTRAL_SCALE_LIGHT,
    NEUTRAL_SCALE_DARK,
    type ThemeVarKey,
    type CompTheme,
} from '../themeConfig';
import {
    hexToRgb,
    rgbToHsl,
    hslToRgb,
    contrastRatio,
} from '@shared/theme/colorUtils';

/** ThemeVarKey 全集（22 键），用于令牌完整性断言。 */
const ALL_KEYS: ThemeVarKey[] = [
    '--primary', '--primary-foreground',
    '--background', '--foreground',
    '--muted', '--muted-foreground',
    '--card', '--card-foreground',
    '--popover', '--popover-foreground',
    '--border', '--input',
    '--secondary', '--secondary-foreground',
    '--accent', '--accent-foreground',
    '--destructive', '--destructive-foreground',
    '--ring',
    '--warning', '--warning-foreground',
    '--black-button',
];

/** 固定测试用 brand（典型蓝 + 典型深蓝）。 */
const BRAND_BLUE = {
    light: '#3b82f6', // Tailwind blue-500
    dark: '#60a5fa',  // Tailwind blue-400
    darkMode: false,
};
const NEUTRAL_SLATE = { preset: 'slate' };

/** 工具：把 CompTheme 的某个 key 还原为 hex（验证中性灰阶映射用）。 */
function compKeyToHex(comp: CompTheme, key: ThemeVarKey): string {
    const { h, s, l } = comp[key];
    // CompTheme 是 0-1 制，hslToRgb 用 0-100 制，s/l ×100
    const { r, g, b } = hslToRgb(h, s * 100, l * 100);
    // 用 rgbToHex 归一取整
    const { r: rR, g: gR, b: bR } = { r, g, b };
    // rgbToHex 已含 clamp + round，直接调
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (
        '#' +
        [rR, gR, bR]
            .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
            .join('')
    );
}

describe('deriveTheme - 结构与令牌完整性', () => {
    it('light/dark 均返回对象，且包含全部 22 个 ThemeVarKey', () => {
        const { light, dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        for (const key of ALL_KEYS) {
            expect(light[key], `light 缺 ${key}`).toBeDefined();
            expect(dark[key], `dark 缺 ${key}`).toBeDefined();
        }
        expect(Object.keys(light).length).toBeGreaterThanOrEqual(ALL_KEYS.length);
        expect(Object.keys(dark).length).toBeGreaterThanOrEqual(ALL_KEYS.length);
    });

    it('每个令牌都是 {h,s,l} 三数字结构', () => {
        const { light, dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        for (const key of ALL_KEYS) {
            for (const comp of [light, dark]) {
                const v = comp[key];
                expect(typeof v.h).toBe('number');
                expect(typeof v.s).toBe('number');
                expect(typeof v.l).toBe('number');
            }
        }
    });
});

describe('deriveTheme - 制式正确（s/l ∈ [0,1], h ∈ [0,360)）', () => {
    it('所有令牌 s/l ∈ [0,1]，h ∈ [0,360)', () => {
        const { light, dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        for (const key of ALL_KEYS) {
            for (const comp of [light, dark]) {
                const { h, s, l } = comp[key];
                expect(s, `${key}.s`).toBeGreaterThanOrEqual(0);
                expect(s, `${key}.s`).toBeLessThanOrEqual(1);
                expect(l, `${key}.l`).toBeGreaterThanOrEqual(0);
                expect(l, `${key}.l`).toBeLessThanOrEqual(1);
                expect(h, `${key}.h`).toBeGreaterThanOrEqual(0);
                expect(h, `${key}.h`).toBeLessThan(360);
            }
        }
    });
});

describe('deriveTheme - WCAG 硬性（primary-foreground 对 primary ≥ 4.5）', () => {
    it('light: primary-foreground 对 primary 对比比 ≥ 4.5', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const fg = hexToRgb(compKeyToHex(light, '--primary-foreground'));
        const bg = hexToRgb(compKeyToHex(light, '--primary'));
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('dark: primary-foreground 对 primary 对比比 ≥ 4.5', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const fg = hexToRgb(compKeyToHex(dark, '--primary-foreground'));
        const bg = hexToRgb(compKeyToHex(dark, '--primary'));
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('destructive-foreground 对 destructive 对比比 ≥ 4.5（light）', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const fg = hexToRgb(compKeyToHex(light, '--destructive-foreground'));
        const bg = hexToRgb(compKeyToHex(light, '--destructive'));
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
});

describe('deriveTheme - 品牌色本体（primary 来自 brand）', () => {
    it('light.primary 由 brand.light 换算（hex → hsl 0-1 制）', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const { h, s, l } = light['--primary'];
        // brand.light hex → rgbToHsl（0-100 制）→ ÷100 应与 light.primary 相符
        const { r, g, b } = hexToRgb(BRAND_BLUE.light);
        const exp = rgbToHsl(r, g, b);
        expect(h).toBeCloseTo(exp.h, 5);
        expect(s).toBeCloseTo(exp.s / 100, 5);
        expect(l).toBeCloseTo(exp.l / 100, 5);
    });

    it('dark.primary 由 brand.dark 换算', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const { h, s, l } = dark['--primary'];
        const { r, g, b } = hexToRgb(BRAND_BLUE.dark);
        const exp = rgbToHsl(r, g, b);
        expect(h).toBeCloseTo(exp.h, 5);
        expect(s).toBeCloseTo(exp.s / 100, 5);
        expect(l).toBeCloseTo(exp.l / 100, 5);
    });
});

describe('deriveTheme - 中性灰阶映射（关键令牌对齐 Radix step）', () => {
    it('light: background ↔ NEUTRAL_SCALE_LIGHT step1', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--background').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['1']);
    });
    it('light: foreground ↔ step12', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--foreground').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['12']);
    });
    it('light: border ↔ step5', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--border').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['5']);
    });
    it('light: muted ↔ step2', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--muted').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['2']);
    });
    it('light: muted-foreground ↔ step11', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--muted-foreground').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['11']);
    });

    it('dark: background ↔ NEUTRAL_SCALE_DARK step1', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(dark, '--background').toLowerCase()).toBe(NEUTRAL_SCALE_DARK['1']);
    });
    it('dark: foreground ↔ step12', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(dark, '--foreground').toLowerCase()).toBe(NEUTRAL_SCALE_DARK['12']);
    });
    it('dark: border ↔ step6', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(dark, '--border').toLowerCase()).toBe(NEUTRAL_SCALE_DARK['6']);
    });

    it('light: card-foreground = foreground 同值（前景色令牌统一）', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(light['--card-foreground']).toEqual(light['--foreground']);
        expect(light['--popover-foreground']).toEqual(light['--foreground']);
        expect(light['--secondary-foreground']).toEqual(light['--foreground']);
        expect(light['--accent-foreground']).toEqual(light['--foreground']);
    });
});

describe('deriveTheme - 黑色按钮（black-button 反相）', () => {
    it('light: black-button = step12（最深黑）', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(light, '--black-button').toLowerCase()).toBe(NEUTRAL_SCALE_LIGHT['12']);
    });
    it('dark: black-button = step1（反相最浅→实际是深色 step1）', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(compKeyToHex(dark, '--black-button').toLowerCase()).toBe(NEUTRAL_SCALE_DARK['1']);
    });
});

describe('deriveTheme - 纯函数性（同入参同出参）', () => {
    it('两次调用产出深相等且不共享引用', () => {
        const a = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        const b = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(a.light).toEqual(b.light);
        expect(a.dark).toEqual(b.dark);
        // 不共享引用（调用方改一个不影响另一个）
        expect(a.light).not.toBe(b.light);
        expect(a.dark).not.toBe(b.dark);
    });
});

describe('deriveTheme - snapshot（防回归）', () => {
    it('固定 brand #3b82f6/#60a5fa 派生 light 快照', () => {
        const { light } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(light).toMatchInlineSnapshot(`
          {
            "--accent": {
              "h": 240,
              "l": 0.9470588235294117,
              "s": 0.11111111111111065,
            },
            "--accent-foreground": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--background": {
              "h": 240,
              "l": 0.9901960784313727,
              "s": 0.2,
            },
            "--black-button": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--border": {
              "h": 230.00000000000003,
              "l": 0.8901960784313725,
              "s": 0.10714285714285722,
            },
            "--card": {
              "h": 240,
              "l": 0.9901960784313727,
              "s": 0.2,
            },
            "--card-foreground": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--destructive": {
              "h": 0,
              "l": 0.6,
              "s": 0.84,
            },
            "--destructive-foreground": {
              "h": 0,
              "l": 0,
              "s": 0,
            },
            "--foreground": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--input": {
              "h": 230.00000000000003,
              "l": 0.8901960784313725,
              "s": 0.10714285714285722,
            },
            "--muted": {
              "h": 240,
              "l": 0.9803921568627451,
              "s": 0.19999999999999943,
            },
            "--muted-foreground": {
              "h": 220,
              "l": 0.4,
              "s": 0.0588235294117647,
            },
            "--popover": {
              "h": 240,
              "l": 0.9901960784313727,
              "s": 0.2,
            },
            "--popover-foreground": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--primary": {
              "h": 217.21925133689842,
              "l": 0.5980392156862745,
              "s": 0.9121951219512198,
            },
            "--primary-foreground": {
              "h": 0,
              "l": 0,
              "s": 0,
            },
            "--ring": {
              "h": 217.21925133689842,
              "l": 0.5980392156862745,
              "s": 0.9121951219512198,
            },
            "--secondary": {
              "h": 240,
              "l": 0.9803921568627451,
              "s": 0.19999999999999943,
            },
            "--secondary-foreground": {
              "h": 210,
              "l": 0.12549019607843137,
              "s": 0.125,
            },
            "--warning": {
              "h": 38,
              "l": 0.5,
              "s": 0.92,
            },
            "--warning-foreground": {
              "h": 0,
              "l": 0,
              "s": 0,
            },
          }
        `);
    });

    it('固定 brand #3b82f6/#60a5fa 派生 dark 快照', () => {
        const { dark } = deriveTheme(BRAND_BLUE, NEUTRAL_SLATE);
        expect(dark).toMatchInlineSnapshot(`
          {
            "--accent": {
              "h": 225.00000000000006,
              "l": 0.13725490196078433,
              "s": 0.057142857142857134,
            },
            "--accent-foreground": {
              "h": 220,
              "l": 0.9352941176470588,
              "s": 0.09090909090909059,
            },
            "--background": {
              "h": 240,
              "l": 0.07058823529411765,
              "s": 0.05555555555555555,
            },
            "--black-button": {
              "h": 240,
              "l": 0.07058823529411765,
              "s": 0.05555555555555555,
            },
            "--border": {
              "h": 213.33333333333334,
              "l": 0.22941176470588234,
              "s": 0.07692307692307694,
            },
            "--card": {
              "h": 220,
              "l": 0.1,
              "s": 0.0588235294117647,
            },
            "--card-foreground": {
              "h": 220,
              "l": 0.9352941176470588,
              "s": 0.09090909090909059,
            },
            "--destructive": {
              "h": 0,
              "l": 0.51,
              "s": 0.72,
            },
            "--destructive-foreground": {
              "h": 0,
              "l": 1,
              "s": 0,
            },
            "--foreground": {
              "h": 220,
              "l": 0.9352941176470588,
              "s": 0.09090909090909059,
            },
            "--input": {
              "h": 213.33333333333334,
              "l": 0.22941176470588234,
              "s": 0.07692307692307694,
            },
            "--muted": {
              "h": 220,
              "l": 0.1,
              "s": 0.0588235294117647,
            },
            "--muted-foreground": {
              "h": 215.9999999999999,
              "l": 0.7098039215686274,
              "s": 0.06756756756756753,
            },
            "--popover": {
              "h": 220,
              "l": 0.1,
              "s": 0.0588235294117647,
            },
            "--popover-foreground": {
              "h": 220,
              "l": 0.9352941176470588,
              "s": 0.09090909090909059,
            },
            "--primary": {
              "h": 213.11688311688312,
              "l": 0.6784313725490196,
              "s": 0.9390243902439025,
            },
            "--primary-foreground": {
              "h": 0,
              "l": 0,
              "s": 0,
            },
            "--ring": {
              "h": 213.11688311688312,
              "l": 0.6784313725490196,
              "s": 0.9390243902439025,
            },
            "--secondary": {
              "h": 220,
              "l": 0.1,
              "s": 0.0588235294117647,
            },
            "--secondary-foreground": {
              "h": 220,
              "l": 0.9352941176470588,
              "s": 0.09090909090909059,
            },
            "--warning": {
              "h": 38,
              "l": 0.62,
              "s": 0.95,
            },
            "--warning-foreground": {
              "h": 0,
              "l": 0,
              "s": 0,
            },
          }
        `);
    });
});
