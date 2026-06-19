/**
 * themeConfig —— 主题配置的纯函数层（单一真相源）。
 *
 * 历史上 parseWebConfig 逻辑散落在 4 处副本（SystemPage/theme/index.tsx、
 * index.html、client ThemeContext、client apps.ts），本模块抽出统一实现，
 * 后续 task4 将逐处收敛到此。本模块只负责数据层解析与归一，不触碰 DOM。
 *
 * 制式约定：CompTheme 中 h 为 0-360，s/l 为 0-1 制（与现有 applyThemeComp
 * 的 `s * 100 + '%'` 拼接约定一致）。normLegacy 负责把遗留 0-100 制数据
 * 归一到 0-1 制。
 */

/**
 * 平台主题支持的 CSS 变量 key 白名单（类型安全用）。
 *
 * 与 DEFAULT_LIGHT_THEME / DEFAULT_DARK_THEME 的键集合、theme/index.tsx 的 themeKeys
 * （i18n 映射）三处保持一致。新增主题变量时三处同步。
 *
 * 共 21 键（任务1 已补 ring / warning / warning-foreground，删除了非颜色的 --radius）。
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
 * 完整的已知主题：21 个 ThemeVarKey 全部齐备。用于 DEFAULT_LIGHT_THEME /
 * DEFAULT_DARK_THEME 这类「平台内置、键集合确定」的常量，编译期锁定键完整性。
 */
export type ThemeComp = Record<ThemeVarKey, { h: number; s: number; l: number }>;

/** 解析后的完整主题：light/dark 两套组件色 + 背景类型。 */
export type ThemeValue = { light: CompTheme; dark: CompTheme; bg: string };

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
 * 解析 web 端主题配置字符串为 ThemeValue。v1/v2/空/损坏 全兼容，永不抛错。
 *
 * - 空 / null / undefined → 默认主题
 * - 损坏 JSON → 默认主题（catch 兜底，不抛）
 * - v2（有 light 字段）：{ light, dark, bg }，light/dark 经 normLegacy 归一，
 *   缺失则兜底 DEFAULT（DEFAULT 本身已是 0-1 制，normLegacy 为幂等 passthrough）
 * - v1（有 comp 字段）：旧格式迁移，comp → light，dark 兜底 DEFAULT_DARK
 *
 * v3（品牌色驱动，由单一主色生成全量 HSL）是阶段3 的事，本任务不实现。
 * TODO(阶段3): 在此增加 v3 分支（parsed.brand 驱动生成 light/dark）。
 */
export function parseWebConfig(raw: string): ThemeValue {
    if (!raw) {
        return { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    }
    try {
        const parsed = JSON.parse(raw);
        // v2：{ light: CompTheme, dark: CompTheme, bg: string }
        if (parsed && parsed.light) {
            return {
                light: normLegacy(parsed.light || DEFAULT_LIGHT_THEME),
                dark: normLegacy(parsed.dark || DEFAULT_DARK_THEME),
                bg: parsed.bg || '',
            };
        }
        // v1：{ comp: CompTheme, bg: string } → 向后兼容迁移
        if (parsed && parsed.comp) {
            return {
                light: normLegacy(parsed.comp),
                dark: DEFAULT_DARK_THEME,
                bg: parsed.bg || '',
            };
        }
        return { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    } catch {
        return { light: DEFAULT_LIGHT_THEME, dark: DEFAULT_DARK_THEME, bg: '' };
    }
}
