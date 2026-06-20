/**
 * themeConfig —— 主题配置的纯函数层（单一真相源）。
 *
 * 历史上 parseWebConfig 逻辑散落在 4 处副本（SystemPage/theme/index.tsx、
 * index.html、client ThemeContext、client apps.ts），本模块抽出统一实现，
 * 后续 task4 将逐处收敛到此。本模块只负责数据层解析与归一，不触碰 DOM。
 *
 * 支持三版 schema：
 *   - v1：{ comp, bg }（最早期，单套色板）
 *   - v2：{ light, dark, bg }（手工 22 令牌 × 2 模式）
 *   - v3：{ version:3, brand:{light,dark,darkMode}, neutral:{preset}, bg, _lock_version }
 *         品牌色驱动，brand → 21 令牌的派生算法在 3B.3 实现（colorUtils），
 *         本模块只做数据层解析/序列化/迁移，不实现派生。
 *
 * v3 乐观锁版本号独立字段 _lock_version，与 schema 版本号 version（=3）解耦：
 *   - version：schema 版本（v1/v2/v3 区分用），由数据本身决定，不参与并发控制
 *   - _lock_version：乐观锁版本（C7 多 admin 并发控制），每次写入 +1
 *   历史复用 value.version 同时承担两个语义（endpoints.py:225），3B.2 拆分为独立字段。
 *
 * 制式约定：CompTheme 中 h 为 0-360，s/l 为 0-1 制（与现有 applyThemeComp
 * 的 `s * 100 + '%'` 拼接约定一致）。normLegacy 负责把遗留 0-100 制数据
 * 归一到 0-1 制。v3 的 brand 是 hex 字符串，不经 normLegacy。
 */

import { hslToRgb, rgbToHex } from './colorUtils';

/**
 * Radix Colors slate 系列中性灰阶（官方 sRGB hex 值，静态查表）。
 *
 * 3B 阶段「输入 1 色 → 派生整套」中，中性灰阶不随品牌色变化，直接复用
 * Radix 官方 slate 系列 12 步明度梯度。light slate9（#8b8d98）与
 * dark slate9（#696e77）是中性基准灰，3B.3 派生算法以此为锚点。
 *
 * 数据来源：@radix-ui/colors 包内 slate.css / slate-dark.css 的 sRGB hex 段
 * （color(display-p3 ...) 段未采用，仅取 sRGB 兜底值以兼容旧浏览器）。
 * 仅本地查表硬编码为静态常量，不引 @radix-ui/colors 作为运行时依赖。
 */
export const NEUTRAL_SCALE_LIGHT: Record<string, string> = {
    '1': '#fcfcfd',
    '2': '#f9f9fb',
    '3': '#f0f0f3',
    '4': '#e8e8ec',
    '5': '#e0e1e6',
    '6': '#d9d9e0',
    '7': '#cdced6',
    '8': '#b9bbc6',
    '9': '#8b8d98',
    '10': '#80838d',
    '11': '#60646c',
    '12': '#1c2024',
};

export const NEUTRAL_SCALE_DARK: Record<string, string> = {
    '1': '#111113',
    '2': '#18191b',
    '3': '#212225',
    '4': '#272a2d',
    '5': '#2e3135',
    '6': '#363a3f',
    '7': '#43484e',
    '8': '#5a6169',
    '9': '#696e77',
    '10': '#777b84',
    '11': '#b0b4ba',
    '12': '#edeef0',
};

/**
 * 平台主题支持的 CSS 变量 key 白名单（类型安全用）。
 *
 * 与 DEFAULT_LIGHT_THEME / DEFAULT_DARK_THEME 的键集合、theme/index.tsx 的 themeKeys
 * （i18n 映射）三处保持一致。新增主题变量时三处同步。
 *
 * 共 22 键（任务1 已补 ring / warning / warning-foreground，删除了非颜色的 --radius，
 * 任务2 新增 --black-button）。
 */
export type ThemeVarKey =
    | '--primary'
    | '--primary-foreground'
    | '--background'
    | '--foreground'
    | '--muted'
    | '--muted-foreground'
    | '--card'
    | '--card-foreground'
    | '--popover'
    | '--popover-foreground'
    | '--border'
    | '--input'
    | '--secondary'
    | '--secondary-foreground'
    | '--accent'
    | '--accent-foreground'
    | '--destructive'
    | '--destructive-foreground'
    | '--ring'
    | '--warning'
    | '--warning-foreground'
    | '--black-button';

/**
 * 单套主题色（light 或 dark），key 为 CSS 变量名，value 为 HSL。s/l 为 0-1 制。
 *
 * 保留 `Record<string, ...>` 而非 `Record<ThemeVarKey, ...>`：parseWebConfig 需兼容
 * 后端遗留/脏数据（可能含白名单外的 key 或部分 key），强约束会让归一与兜底分支
 * 类型报错。白名单约束由 themeRuntime.formatCssRules 的 KEY_RE 在运行时过滤，
 * 由 ThemeVarKey 在类型层约束「已知完整主题」（见 ThemeComp）。
 */
export type CompTheme = Record<string, { h: number; s: number; l: number }>;

/**
 * 完整的已知主题：22 个 ThemeVarKey 全部齐备。用于 DEFAULT_LIGHT_THEME /
 * DEFAULT_DARK_THEME 这类「平台内置、键集合确定」的常量，编译期锁定键完整性。
 */
export type ThemeComp = Record<ThemeVarKey, { h: number; s: number; l: number }>;

/** 解析后的完整主题：light/dark 两套组件色 + 背景类型。
 *
 * v1/v2 数据：light/dark 为 CompTheme（22 令牌手工值），v3Schema=false。
 * v3 数据：light/dark 为 null（派生未实现，3B.3 完成派生后会填 CompTheme），
 *   brand/neutral/_lock_version 透传，v3Schema=true。
 *
 * light/dark 改为可空（CompTheme | null）：v3 在派生未完成时返回 null，
 * 调用方据 v3Schema===true && light===null 判定「需走 3B.3 派生路径」。
 * 已有 v1/v2 调用方读 light/dark 时仍拿到 CompTheme（v3Schema=false 分支必非 null）。
 */
export type ThemeValue = {
    light: CompTheme | null;
    dark: CompTheme | null;
    bg: string;
    /** v3 schema 标记：true 表示数据是 v3 结构（brand/neutral 驱动），false 表示 v1/v2/默认/损坏。 */
    v3Schema?: boolean;
    /** v3 品牌色（仅 v3Schema=true 时有值）。 */
    brand?: { light: string; dark: string; darkMode: boolean };
    /** v3 中性灰阶预设名（仅 v3Schema=true 时有值）。 */
    neutral?: { preset: string };
    /** v3 乐观锁版本号（仅 v3Schema=true 时有值；v1/v2 不含此字段）。 */
    _lock_version?: number;
};

/**
 * 默认浅色主题（0-1 制）。作为 light 的兜底与「恢复默认」单一真相源。
 * 含任务1已补的 ring / warning / warning-foreground。
 */
export const DEFAULT_LIGHT_THEME: ThemeComp = {
    '--background': { h: 0, s: 0, l: 1 },
    '--foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--muted': { h: 210, s: 0.4, l: 0.98 },
    '--muted-foreground': { h: 215.4, s: 0.163, l: 0.469 },
    '--popover': { h: 0, s: 0, l: 1 },
    '--popover-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--card': { h: 0, s: 0, l: 1 },
    '--card-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--border': { h: 220, s: 0.22, l: 0.87 },
    '--input': { h: 223, s: 0.48, l: 0.44 },
    '--primary': { h: 240, s: 1, l: 0.64 },
    '--primary-foreground': { h: 210, s: 0.4, l: 0.98 },
    '--secondary': { h: 210, s: 0.4, l: 0.961 },
    '--secondary-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--accent': { h: 210, s: 0.3, l: 0.961 },
    '--accent-foreground': { h: 222.2, s: 0.474, l: 0.112 },
    '--destructive': { h: 0, s: 1, l: 0.5 },
    '--destructive-foreground': { h: 210, s: 0.4, l: 0.98 },
    '--ring': { h: 223, s: 0.48, l: 0.44 },
    '--warning': { h: 38, s: 0.92, l: 0.50 },
    '--warning-foreground': { h: 0, s: 0, l: 1 },
    '--black-button': { h: 0, s: 0, l: 0.07 },
};

/**
 * 默认深色主题（0-1 制）。作为 dark 的兜底。
 * 含任务1已补的 ring / warning / warning-foreground。
 */
export const DEFAULT_DARK_THEME: ThemeComp = {
    '--background': { h: 0, s: 0, l: 0.07 },
    '--foreground': { h: 0, s: 0, l: 1 },
    '--card': { h: 240, s: 0.01, l: 0.13 },
    '--card-foreground': { h: 213, s: 0.31, l: 0.80 },
    '--popover': { h: 225, s: 0.05, l: 0.17 },
    '--popover-foreground': { h: 215, s: 0.202, l: 0.651 },
    '--primary': { h: 220, s: 0.85, l: 0.65 },
    '--primary-foreground': { h: 0, s: 0, l: 1 },
    '--secondary': { h: 222.2, s: 0.374, l: 0.072 },
    '--secondary-foreground': { h: 210, s: 0.4, l: 0.80 },
    '--muted': { h: 0, s: 0, l: 0.07 },
    '--muted-foreground': { h: 215.4, s: 0.163, l: 0.569 },
    '--accent': { h: 0, s: 0, l: 0.11 },
    '--accent-foreground': { h: 210, s: 0.30, l: 0.98 },
    '--destructive': { h: 0, s: 0.81, l: 0.6 },
    '--destructive-foreground': { h: 210, s: 0.4, l: 0.98 },
    '--border': { h: 225, s: 0.05, l: 0.27 },
    '--input': { h: 0, s: 0, l: 1 },
    '--ring': { h: 216, s: 0.24, l: 0.30 },
    '--warning': { h: 38, s: 0.95, l: 0.62 },
    '--warning-foreground': { h: 0, s: 0, l: 1 },
    '--black-button': { h: 0, s: 0, l: 0.07 },
};

/**
 * 遗留数据归一：把可能为 0-100 制的 s/l 归一到 0-1 制。h 恒为 0-360，不变。
 *
 * 判定规则：s 与 l 同时 ≤1 才认为是 0-1 制（此时 s/l ×100 反过来不对——
 * 注意我们目标是把 0-100 制归一到 0-1 制，所以是「判定为 0-100 制时除以 100」，
 * 判定为已经是 0-1 制时 passthrough）。
 *
 * 修正点（审查反馈）：旧实现单看 s≤1 会把 0-1 制的满饱和 s=1 误判为「需归一」，
 * 进而错误地再 ×100。新规则要求 s 与 l 同时 ≤1：
 *   - s≤1 且 l≤1 → 已是 0-1 制，passthrough
 *   - 否则（至少有一个 >1）→ 视为 0-100 制，s/l ÷100 归一到 0-1 制
 *
 * 这样新入库的 0-1 制数据（如 DEFAULT_LIGHT_THEME 的 primary s=1,l=0.64）
 * 不会被误处理；而老库 0-100 制数据（s=100,l=64）会被正确归一。
 */
export function normLegacy(comp: CompTheme): CompTheme {
    const out: CompTheme = {};
    for (const key of Object.keys(comp)) {
        const { h, s, l } = comp[key];
        if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number') {
            // 非法值原样保留，交给上层 applyThemeComp 的校验过滤；不在此静默丢弃。
            out[key] = { h, s, l };
            continue;
        }
        if (s <= 1 && l <= 1) {
            // 已是 0-1 制，passthrough
            out[key] = { h, s, l };
        } else {
            // 0-100 制，归一到 0-1 制
            out[key] = { h, s: s / 100, l: l / 100 };
        }
    }
    return out;
}

/**
 * 解析 web 端主题配置字符串为 ThemeValue。v1/v2/v3/空/损坏 全兼容，永不抛错。
 *
 * - 空 / null / undefined → 默认主题
 * - 损坏 JSON → 默认主题（catch 兜底，不抛）
 * - v3（version===3 且 brand 完整）：返回 v3 结构（v3Schema=true，brand/neutral/bg/
 *   _lock_version 透传），**light/dark 占位 null**——派生算法（brand→21 令牌）是 3B.3
 *   的事，本函数不派生。调用方据 v3Schema===true && light===null 判定「需走派生路径」。
 *   v3 缺 brand 视为损坏（version=3 但结构不完整），回退默认主题。
 * - v2（有 light 字段）：{ light, dark, bg }，light/dark 经 normLegacy 归一，
 *   缺失则兜底 DEFAULT（DEFAULT 本身已是 0-1 制，normLegacy 为幂等 passthrough）
 * - v1（有 comp 字段）：旧格式迁移，comp → light，dark 兜底 DEFAULT_DARK
 *
 * v3 不走 normLegacy：brand 是 hex 字符串（不是 CompTheme），neutral 是预设名，
 * normLegacy 只处理 CompTheme 的 HSL s/l 制式归一，与 v3 数据无关。
 */
export function parseWebConfig(raw: string): ThemeValue {
    if (!raw) {
        return { v3Schema: false, light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    }
    try {
        const parsed = JSON.parse(raw);
        // v3：{ version:3, brand:{light,dark,darkMode}, neutral:{preset}, bg, _lock_version? }
        // brand 完整性校验：缺 brand 或 brand.light/dark/darkMode 任一缺失 → 视为损坏，回退默认
        if (parsed && parsed.version === 3 && parsed.brand
            && typeof parsed.brand.light === 'string'
            && typeof parsed.brand.dark === 'string'
            && typeof parsed.brand.darkMode === 'boolean') {
            return {
                v3Schema: true,
                brand: {
                    light: parsed.brand.light,
                    dark: parsed.brand.dark,
                    darkMode: parsed.brand.darkMode,
                },
                neutral: parsed.neutral && typeof parsed.neutral.preset === 'string'
                    ? { preset: parsed.neutral.preset }
                    : { preset: 'slate' },
                bg: typeof parsed.bg === 'string' ? parsed.bg : '',
                _lock_version: typeof parsed._lock_version === 'number' ? parsed._lock_version : 0,
                // 派生未实现（3B.3）：占位 null，调用方据此走派生路径
                light: null,
                dark: null,
            };
        }
        // v2：{ light: CompTheme, dark: CompTheme, bg: string }
        if (parsed && parsed.light) {
            return {
                v3Schema: false,
                light: normLegacy(parsed.light || DEFAULT_LIGHT_THEME),
                dark: normLegacy(parsed.dark || DEFAULT_DARK_THEME),
                bg: parsed.bg || '',
            };
        }
        // v1：{ comp: CompTheme, bg: string } → 向后兼容迁移
        if (parsed && parsed.comp) {
            return {
                v3Schema: false,
                light: normLegacy(parsed.comp),
                dark: DEFAULT_DARK_THEME,
                bg: parsed.bg || '',
            };
        }
        return { v3Schema: false, light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    } catch {
        return { v3Schema: false, light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    }
}

/**
 * v3 运行期结构的可序列化输入（不含运行期占位 light/dark/v3Schema）。
 *
 * serializeV3 只产出落库结构 {version:3, brand, neutral, bg, _lock_version}，
 * 运行期占位字段（light/dark null、v3Schema true）不入库——它们是 parseWebConfig
 * 返回类型的一部分，落库结构里不应出现。
 */
export type V3Serializable = {
    brand: { light: string; dark: string; darkMode: boolean };
    neutral: { preset: string };
    bg: string;
    _lock_version: number;
};

/**
 * 序列化 v3 结构为后端存储 JSON 字符串。
 *
 * 与 parseWebConfig 对称：serializeV3(parseWebConfig(raw).v3 字段) 再 parse 回来字段一致。
 *
 * 不产出 light/dark / v3Schema 字段（这些是运行期占位/标记，不属于落库 schema）。
 * ensure_ascii 由 JSON.stringify 默认处理（hex/preset/bg 均为 ASCII，无转义问题）。
 *
 * 接缝设计（codebase-design 深模块）：本函数只关心 v3 → JSON 的单向序列化，
 * 不关心 brand 怎么来的（3B.5 BrandPicker 选 / migrateV2ToV3 兜底），单一职责。
 */
export function serializeV3(input: V3Serializable & {
    /** 运行期可多带的字段，序列化时被丢弃（类型兼容 parseWebConfig 返回值直接传入）。 */
    v3Schema?: boolean;
    light?: CompTheme | null;
    dark?: CompTheme | null;
}): string {
    return JSON.stringify({
        version: 3,
        brand: input.brand,
        neutral: input.neutral,
        bg: input.bg,
        _lock_version: input._lock_version,
    });
}

/**
 * migrate v2 → v3：v2 手工微调值降级路径。
 *
 * v2 是 {light, dark, bg}（22 令牌手工值），v3 是 brand 驱动（单一品牌色派生全量）。
 * 迁移时 v2 的手工微调值无法反推出 brand（多个令牌可能各自被微调过），
 * 故 brand 用占位默认值（DEFAULT_LIGHT_THEME.primary 的 hex 等价值），**原始 v2 值
 * 保留在 legacy 字段**——派生覆盖前 UI（3B.5）可读 legacy 提示用户「有 v2 微调值，
 * 应用派生将覆盖」，避免静默丢失现网配置。
 *
 * 占位 brand 取值（hex）：由 DEFAULT_*_THEME['--primary'] 经 colorUtils 精确换算
 * （DEFAULT primary 是 0-1 制，colorUtils.hslToRgb 用 0-100 制，s/l ×100），
 * hsl(240,100%,64%) → #4747ff、hsl(220,85%,65%) → #5a8cf2。非硬编码。
 * darkMode: false（默认 light；真实开关需 3B.5 UI 让用户确认）。
 *
 * 占位 hex 是迁移兜底（brand 默认值），不是「正确派生」——派生算法（brand→21 令牌）在 3B.3。
 *
 * @param v2  v2 结构 {light, dark, bg}，light/dark 必为 CompTheme（已 normLegacy 后）
 */
export function migrateV2ToV3(v2: { light: CompTheme; dark: CompTheme; bg: string }): {
    version: 3;
    brand: { light: string; dark: string; darkMode: boolean };
    neutral: { preset: string };
    bg: string;
    /** v2 原始手工值（派生覆盖前 UI 可回读，避免丢现网配置）。 */
    legacy: { light: CompTheme; dark: CompTheme };
    /** 迁移提示（3B.5 UI 据此弹「有 v2 微调值，派生将覆盖」）。 */
    warning: string;
} {
    // 占位 hex：DEFAULT 主题 primary 的精确 HSL→hex（colorUtils 换算，非硬编码）。
    // DEFAULT_*_THEME primary 是 0-1 制，colorUtils.hslToRgb 用 0-100 制，s/l ×100。
    const toBrandHex = (c: { h: number; s: number; l: number }): string => {
        const { r, g, b } = hslToRgb(c.h, c.s * 100, c.l * 100);
        return rgbToHex(r, g, b);
    };
    const PLACEHOLDER_BRAND_LIGHT = toBrandHex(DEFAULT_LIGHT_THEME['--primary']);
    const PLACEHOLDER_BRAND_DARK = toBrandHex(DEFAULT_DARK_THEME['--primary']);
    return {
        version: 3,
        brand: {
            light: PLACEHOLDER_BRAND_LIGHT,
            dark: PLACEHOLDER_BRAND_DARK,
            darkMode: false,
        },
        neutral: { preset: 'slate' },
        bg: v2.bg,
        legacy: { light: v2.light, dark: v2.dark },
        warning: 'v2 manual overrides preserved in legacy field; deriving v3 brand will overwrite. Confirm in UI before applying.',
    };
}
