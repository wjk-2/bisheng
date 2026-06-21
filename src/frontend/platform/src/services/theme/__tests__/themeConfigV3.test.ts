/**
 * themeConfig v3 单元测试 —— 锁定 v3 数据模型与 parse/serialize/migrate 契约。
 *
 * v3 设计（plan smooth-noodling-quiche.md 已定）：
 *   { version:3, brand:{light, dark, darkMode}, neutral:{preset}, bg, _lock_version:N }
 *   - brand.light / brand.dark：品牌色 hex（light 模式 + dark 模式各一）
 *   - brand.darkMode：dark 模式开关（bool）
 *   - neutral.preset：中性灰阶预设名（对应 NEUTRAL_SCALE_*，如 'slate'）
 *   - bg：背景类型（沿用现网，如 'logo'）
 *   - _lock_version：乐观锁版本号（独立字段，不复用 version）
 *
 * 3B.2 边界（严格）：
 *   - 不实现派生（brand → 21 令牌是 3B.3，用 colorUtils）
 *   - parseWebConfig v3 分支：返回 v3 结构（brand/neutral/bg/_lock_version），
 *     light/dark 占位为 null（派生未实现，调用方据此判定「待派生」走 3B.3）
 *   - migrate v2→v3：保留 v2 原始 light/dark 值在 legacy 字段（避免丢现网微调配置）
 *
 * assert 用 toEqual 深比较 + toMatchInlineSnapshot 锁定关键产出格式。
 */
import { describe, it, expect } from 'vitest';
import {
    parseWebConfig,
    serializeV3,
    migrateV2ToV3,
    DEFAULT_LIGHT_THEME,
    DEFAULT_DARK_THEME,
} from '../themeConfig';
import { hslToRgb, rgbToHex } from '@shared/theme/colorUtils';

describe('parseWebConfig v3 分支', () => {
    it('v3（version=3，brand 完整）→ 返回 v3 结构，light/dark 由 deriveTheme 派生填充', () => {
        const raw = JSON.stringify({
            version: 3,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: false },
            neutral: { preset: 'slate' },
            bg: 'logo',
            _lock_version: 7,
        });
        const result = parseWebConfig(raw);
        // v3 识别：v3Schema=true，原始字段透传
        expect(result.v3Schema).toBe(true);
        expect(result.brand).toEqual({
            light: '#3b82f6',
            dark: '#60a5fa',
            darkMode: false,
        });
        expect(result.neutral).toEqual({ preset: 'slate' });
        expect(result.bg).toBe('logo');
        expect(result._lock_version).toBe(7);
        // 3B.3 后：light/dark 不再是 null，而是 deriveTheme 派生的 CompTheme（22 令牌）
        expect(result.light).not.toBeNull();
        expect(result.dark).not.toBeNull();
        // primary 来自 brand（light 用 brand.light、dark 用 brand.dark）
        expect(result.light!['--primary']).toBeDefined();
        expect(result.dark!['--primary']).toBeDefined();
        // 22 个 ThemeVarKey 全覆盖（v3 派生产出与 v2 同结构）
        const expectedKeys = [
            '--primary', '--primary-foreground', '--background', '--foreground',
            '--muted', '--muted-foreground', '--card', '--card-foreground',
            '--popover', '--popover-foreground', '--border', '--input',
            '--secondary', '--secondary-foreground', '--accent', '--accent-foreground',
            '--destructive', '--destructive-foreground', '--ring',
            '--warning', '--warning-foreground', '--black-button',
        ];
        for (const k of expectedKeys) {
            expect(result.light![k], `light 缺 ${k}`).toBeDefined();
            expect(result.dark![k], `dark 缺 ${k}`).toBeDefined();
        }
    });

    it('v3 缺 _lock_version → _lock_version 兜底 0（兼容首次写入）', () => {
        const raw = JSON.stringify({
            version: 3,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: true },
            neutral: { preset: 'slate' },
            bg: 'gradient',
        });
        const result = parseWebConfig(raw);
        expect(result.v3Schema).toBe(true);
        expect(result._lock_version).toBe(0);
    });

    it('v3 缺 brand → 视为损坏，回退默认主题（v3Schema=false）', () => {
        // version=3 但缺 brand：不完整 v3，按损坏处理兜底默认主题
        const raw = JSON.stringify({ version: 3, bg: 'logo' });
        const result = parseWebConfig(raw);
        expect(result.v3Schema).toBe(false);
        expect(result.light).toBe(DEFAULT_LIGHT_THEME);
        expect(result.dark).toBe(DEFAULT_DARK_THEME);
    });

    it('v1/v2 仍走原分支，v3Schema=false（向后兼容不破坏）', () => {
        // v2
        const v2 = parseWebConfig(JSON.stringify({
            light: { '--primary': { h: 240, s: 1, l: 0.64 } },
            dark: { '--primary': { h: 220, s: 0.85, l: 0.65 } },
            bg: 'logo',
        }));
        expect(v2.v3Schema).toBe(false);
        expect(v2.light!['--primary']).toEqual({ h: 240, s: 1, l: 0.64 });
        // v1
        const v1 = parseWebConfig(JSON.stringify({
            comp: { '--primary': { h: 240, s: 100, l: 64 } },
            bg: 'logo',
        }));
        expect(v1.v3Schema).toBe(false);
        expect(v1.light!['--primary']).toEqual({ h: 240, s: 1, l: 0.64 });
    });
});

describe('serializeV3', () => {
    it('v3 结构 → JSON 字符串，与 parseWebConfig 对称（round-trip）', () => {
        const v3 = {
            v3Schema: true as const,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: false },
            neutral: { preset: 'slate' },
            bg: 'logo',
            _lock_version: 3,
            light: null,
            dark: null,
        };
        const json = serializeV3(v3);
        const reparsed = parseWebConfig(json);
        expect(reparsed.v3Schema).toBe(true);
        expect(reparsed.brand).toEqual(v3.brand);
        expect(reparsed.neutral).toEqual(v3.neutral);
        expect(reparsed.bg).toBe('logo');
        expect(reparsed._lock_version).toBe(3);
    });

    it('serializeV3 产出顶层 version=3，不产出 light/dark 占位（占位是运行期语义不入库）', () => {
        const v3 = {
            v3Schema: true as const,
            brand: { light: '#000000', dark: '#ffffff', darkMode: true },
            neutral: { preset: 'slate' },
            bg: 'logo',
            _lock_version: 0,
            light: null,
            dark: null,
        };
        const obj = JSON.parse(serializeV3(v3));
        expect(obj.version).toBe(3);
        expect(obj.brand).toEqual(v3.brand);
        expect(obj.neutral).toEqual({ preset: 'slate' });
        expect(obj._lock_version).toBe(0);
        // light/dark 不入库（占位 null 是运行期返回类型的一部分，落库结构不含）
        expect('light' in obj).toBe(false);
        expect('dark' in obj).toBe(false);
        expect('v3Schema' in obj).toBe(false);
    });
});

describe('migrateV2ToV3', () => {
    it('v2 手工微调值降级路径：原始 light/dark 保留在 legacy 字段，避免丢现网配置', () => {
        const v2Light = { '--primary': { h: 240, s: 1, l: 0.64 } };
        const v2Dark = { '--primary': { h: 220, s: 0.85, l: 0.65 } };
        const v2 = {
            light: v2Light,
            dark: v2Dark,
            bg: 'logo',
        };
        const migrated = migrateV2ToV3(v2);
        // v3 schema 字段占位（brand 待 3B.5 BrandPicker 让用户选 / 或 3B.3 派生算法兜底）
        expect(migrated.version).toBe(3);
        expect(migrated.bg).toBe('logo');
        // legacy 保留 v2 原始值，派生覆盖前 UI 可回读
        expect(migrated.legacy).toEqual({ light: v2Light, dark: v2Dark });
        // brand 默认占位（未派生）——具体值见实现，测试只锁字段存在与类型
        expect(typeof migrated.brand.light).toBe('string');
        expect(typeof migrated.brand.dark).toBe('string');
        expect(typeof migrated.brand.darkMode).toBe('boolean');
        expect(migrated.neutral.preset).toBe('slate');
    });

    it('migrateV2ToV3 产出可被 serializeV3 序列化（结构自洽）', () => {
        const v2 = {
            light: { '--primary': { h: 240, s: 1, l: 0.64 } },
            dark: { '--primary': { h: 220, s: 0.85, l: 0.65 } },
            bg: 'gradient',
        };
        const migrated = migrateV2ToV3(v2);
        // 把 migrated 包成 v3 运行期结构（light/dark 占位 null）后能 serializeV3
        const json = serializeV3({
            v3Schema: true,
            brand: migrated.brand,
            neutral: migrated.neutral,
            bg: migrated.bg,
            _lock_version: 0,
            light: null,
            dark: null,
        });
        const obj = JSON.parse(json);
        expect(obj.version).toBe(3);
        expect(obj.bg).toBe('gradient');
    });

    it('migrateV2ToV3 带 warning 标记：派生覆盖前提示避免丢现网配置', () => {
        const v2 = {
            light: { '--primary': { h: 240, s: 1, l: 0.64 } },
            dark: { '--primary': { h: 220, s: 0.85, l: 0.65 } },
            bg: 'logo',
        };
        const migrated = migrateV2ToV3(v2);
        // warning 字段提示调用方（3B.5 UI）「有 v2 微调值未派生覆盖」
        expect(migrated.warning).toContain('v2');
    });

    it('migrateV2ToV3 占位 brand 由 colorUtils 从 DEFAULT primary 精确换算（非硬编码）', () => {
        const v2 = {
            light: { '--primary': { h: 240, s: 1, l: 0.64 } },
            dark: { '--primary': { h: 220, s: 0.85, l: 0.65 } },
            bg: 'logo',
        };
        const migrated = migrateV2ToV3(v2);
        // DEFAULT primary 是 0-1 制，colorUtils.hslToRgb 用 0-100 制，s/l ×100。
        // 断言 migrate 占位与 colorUtils 直接换算一致——若 migrate 退回硬编码错值则不通过。
        const expLight = (() => {
            const { r, g, b } = hslToRgb(240, 1 * 100, 0.64 * 100);
            return rgbToHex(r, g, b);
        })();
        const expDark = (() => {
            const { r, g, b } = hslToRgb(220, 0.85 * 100, 0.65 * 100);
            return rgbToHex(r, g, b);
        })();
        expect(migrated.brand.light).toBe(expLight);
        expect(migrated.brand.dark).toBe(expDark);
    });
});

describe('v3 与 normLegacy 解耦（v3 不走 normLegacy）', () => {
    it('v3 brand 是 hex 字符串，不经 normLegacy（normLegacy 只处理 CompTheme）', () => {
        const raw = JSON.stringify({
            version: 3,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: false },
            neutral: { preset: 'slate' },
            bg: 'logo',
            _lock_version: 1,
        });
        const result = parseWebConfig(raw);
        expect(result.v3Schema).toBe(true);
        expect(result.brand!.light).toBe('#3b82f6');
    });
});

/**
 * v3 snapshot 段（plan §2.5 补 v3 快照）—— 锁定 parseWebConfig v3 完整产出
 * 与 serializeV3 落库 JSON 精确格式。改动 v3 数据结构时 snapshot 会失败，
 * 强制开发者审视是否破坏落库兼容（后端按 dict 校验，字段名/结构变动需同步后端）。
 */
describe('v3 snapshot', () => {
    it('parseWebConfig v3 完整产出快照（light/dark 派生填充，体积大仅断言关键字段）', () => {
        const raw = JSON.stringify({
            version: 3,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: true },
            neutral: { preset: 'slate' },
            bg: 'gradient',
            _lock_version: 42,
        });
        const result = parseWebConfig(raw);
        // 派生后 light/dark 是大对象（44 个 hsl 值），快照过宽难审。
        // 关键契约：顶层结构 + 派生填充非 null + 22 令牌完整（数量）。
        const lightKeys = Object.keys(result.light!);
        const darkKeys = Object.keys(result.dark!);
        expect({
            v3Schema: result.v3Schema,
            brand: result.brand,
            neutral: result.neutral,
            bg: result.bg,
            _lock_version: result._lock_version,
            lightTokenCount: lightKeys.length,
            darkTokenCount: darkKeys.length,
            lightHasPrimary: !!result.light!['--primary'],
            darkHasPrimary: !!result.dark!['--primary'],
        }).toMatchInlineSnapshot(`
          {
            "_lock_version": 42,
            "bg": "gradient",
            "brand": {
              "dark": "#60a5fa",
              "darkMode": true,
              "light": "#3b82f6",
            },
            "darkHasPrimary": true,
            "darkTokenCount": 22,
            "lightHasPrimary": true,
            "lightTokenCount": 22,
            "neutral": {
              "preset": "slate",
            },
            "v3Schema": true,
          }
        `);
    });

    it('serializeV3 落库 JSON 快照（不含运行期占位字段）', () => {
        const json = serializeV3({
            v3Schema: true,
            brand: { light: '#3b82f6', dark: '#60a5fa', darkMode: false },
            neutral: { preset: 'slate' },
            bg: 'logo',
            _lock_version: 7,
            light: null,
            dark: null,
        });
        expect(json).toMatchInlineSnapshot(
          `"{"version":3,"brand":{"light":"#3b82f6","dark":"#60a5fa","darkMode":false},"neutral":{"preset":"slate"},"bg":"logo","_lock_version":7}"`,
        );
    });
});
