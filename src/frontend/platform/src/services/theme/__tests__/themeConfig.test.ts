/**
 * themeConfig 单元测试 —— 锁定 parseWebConfig / normLegacy 的契约行为。
 *
 * 制式期望：CompTheme 中 s/l 为 0-1 制（与现有 applyThemeComp 的 `s*100+'%'`
 * 拼接、DEFAULT_LIGHT_THEME 的 primary s=1 对齐）。
 */
import { describe, it, expect } from 'vitest';
import {
    parseWebConfig,
    normLegacy,
    DEFAULT_LIGHT_THEME,
    DEFAULT_DARK_THEME,
} from '../themeConfig';

describe('parseWebConfig', () => {
    it('空 / null / undefined → 默认主题（bg 为空串）', () => {
        const expected = { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
        expect(parseWebConfig('')).toEqual(expected);
        // @ts-expect-error: 显式验证 null/undefined 兜底
        expect(parseWebConfig(null)).toEqual(expected);
        // @ts-expect-error: 显式验证 null/undefined 兜底
        expect(parseWebConfig(undefined)).toEqual(expected);
    });

    it('损坏 JSON → 默认主题（不抛错）', () => {
        const result = parseWebConfig('{invalid');
        expect(result).toEqual({
            light: DEFAULT_LIGHT_THEME,
            dark: DEFAULT_DARK_THEME,
            bg: '',
        });
    });

    it('v1 {comp, bg} → comp 归一为 light，dark 兜底 DEFAULT_DARK，bg 透传', () => {
        const raw = JSON.stringify({
            comp: {
                '--primary': { h: 240, s: 100, l: 64 }, // 0-100 制，应归一
            },
            bg: 'logo',
        });
        const result = parseWebConfig(raw);
        expect(result.light['--primary']).toEqual({ h: 240, s: 1, l: 0.64 });
        expect(result.dark).toBe(DEFAULT_DARK_THEME);
        expect(result.bg).toBe('logo');
    });

    it('v2 {light, dark, bg} → 两套各自归一后返回，bg 透传', () => {
        const raw = JSON.stringify({
            light: {
                '--primary': { h: 240, s: 100, l: 64 }, // 0-100 制 → 归一
            },
            dark: {
                '--primary': { h: 220, s: 85, l: 65 }, // 0-100 制 → 归一
            },
            bg: 'gradient',
        });
        const result = parseWebConfig(raw);
        expect(result.light['--primary']).toEqual({ h: 240, s: 1, l: 0.64 });
        expect(result.dark['--primary']).toEqual({ h: 220, s: 0.85, l: 0.65 });
        expect(result.bg).toBe('gradient');
    });

    it('v2 缺 dark → dark 兜底 DEFAULT_DARK', () => {
        const raw = JSON.stringify({
            light: { '--primary': { h: 240, s: 1, l: 0.64 } },
        });
        const result = parseWebConfig(raw);
        expect(result.light['--primary']).toEqual({ h: 240, s: 1, l: 0.64 });
        // v2 缺 dark 时 parseWebConfig 走 normLegacy(parsed.dark || DEFAULT_DARK_THEME)
        // 返回的是 normLegacy 的新对象，引用不等但值相等；用深比较验证兜底内容。
        expect(result.dark).toEqual(DEFAULT_DARK_THEME);
        expect(result.bg).toBe('');
    });
});

describe('normLegacy', () => {
    it('0-1 制 passthrough：{h:240, s:1, l:0.64} 不被误判', () => {
        expect(normLegacy({ '--primary': { h: 240, s: 1, l: 0.64 } })).toEqual({
            '--primary': { h: 240, s: 1, l: 0.64 },
        });
    });

    it('0-100 制 ÷100 归一：{h:240, s:100, l:64} → {h:240, s:1, l:0.64}', () => {
        expect(normLegacy({ '--primary': { h: 240, s: 100, l: 64 } })).toEqual({
            '--primary': { h: 240, s: 1, l: 0.64 },
        });
    });

    it('边界：{h:0, s:1, l:1} s与l同时≤1 → passthrough', () => {
        expect(normLegacy({ '--x': { h: 0, s: 1, l: 1 } })).toEqual({
            '--x': { h: 0, s: 1, l: 1 },
        });
    });

    it('边界：{h:0, s:1, l:50} l=50>1 判 0-100 制 → ÷100', () => {
        expect(normLegacy({ '--x': { h: 0, s: 1, l: 50 } })).toEqual({
            '--x': { h: 0, s: 0.01, l: 0.5 },
        });
    });

    it('同一 comp 内 key 制式混用：逐 key 独立判定（a passthrough / b ÷100）', () => {
        const mixed = {
            '--a': { h: 240, s: 1, l: 0.64 },     // s≤1 且 l≤1 → 0-1 制 passthrough
            '--b': { h: 0, s: 100, l: 50 },       // s=100>1  → 0-100 制 ÷100
        };
        expect(normLegacy(mixed)).toEqual({
            '--a': { h: 240, s: 1, l: 0.64 },
            '--b': { h: 0, s: 1, l: 0.5 },
        });
    });

    it('混合制式反向（a ÷100 / b passthrough）：判定与 key 出现顺序无关', () => {
        const mixed = {
            '--b': { h: 0, s: 100, l: 50 },       // 0-100 制 → ÷100
            '--a': { h: 240, s: 1, l: 0.64 },     // 0-1 制 → passthrough
        };
        const result = normLegacy(mixed);
        expect(result['--a']).toEqual({ h: 240, s: 1, l: 0.64 });
        expect(result['--b']).toEqual({ h: 0, s: 1, l: 0.5 });
    });
});
