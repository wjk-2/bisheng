/**
 * 学术品牌色预设 —— 3B.5 步骤 1.3 预设数据层。
 *
 * 定位：8 个面向高校的学术品牌色预设，供 ThemePage 预设选择器使用。
 * 每个预设含 light/dark 两套品牌色 hex（dark 为 light 在暗背景下的适配版：
 * 通常略提亮降饱和，保证暗模式下可识别且不刺眼）+ darkMode 偏好标志。
 *
 * darkMode 仅记录偏好：本步骤不切全局 mode，是否进入深色由上层 setMode 决定。
 * labelKey 是 i18n 键，文案在步骤 5 国际化补齐。
 *
 * light/dark 值均通过 isValidHex 校验（合法 #rrggbb）。
 */

/** 单个品牌的取值集合。 */
export interface BrandValue {
    /** 浅色模式品牌色（#rrggbb）。 */
    light: string;
    /** 深色模式品牌色（#rrggbb），light 在暗背景下的适配版。 */
    dark: string;
    /** 是否偏好深色模式（仅记录，本步骤不切全局 mode）。 */
    darkMode: boolean;
}

/** 预设条目。 */
export interface Preset {
    /** 唯一标识，如 'academicBlue'。 */
    id: string;
    /** i18n 键，如 'theme.preset.academicBlue'，文案步骤 5 补齐。 */
    labelKey: string;
    /** 品牌色取值。 */
    brand: BrandValue;
}

/**
 * 8 个学术品牌色预设。
 *
 * dark 适配原则：在 light 的 HSL 基础上，L 提到约 62-68（暗背景提亮保证可识别），
 * S 降到约 60-75（降饱和避免刺眼）。灰色类（经典墨）特殊处理。
 */
export const PRESETS: Preset[] = [
    {
        id: 'academicBlue',
        labelKey: 'theme.preset.academicBlue',
        brand: { light: '#2563EB', dark: '#60A5FA', darkMode: false },
    },
    {
        id: 'normalGreen',
        labelKey: 'theme.preset.normalGreen',
        brand: { light: '#16A34A', dark: '#4ADE80', darkMode: false },
    },
    {
        id: 'techPurple',
        labelKey: 'theme.preset.techPurple',
        brand: { light: '#7C3AED', dark: '#A78BFA', darkMode: false },
    },
    {
        id: 'medicalRed',
        labelKey: 'theme.preset.medicalRed',
        brand: { light: '#DC2626', dark: '#F87171', darkMode: false },
    },
    {
        id: 'artsOrange',
        labelKey: 'theme.preset.artsOrange',
        brand: { light: '#EA580C', dark: '#FB923C', darkMode: false },
    },
    {
        id: 'artPink',
        labelKey: 'theme.preset.artPink',
        brand: { light: '#DB2777', dark: '#F472B6', darkMode: false },
    },
    {
        id: 'comprehensiveCyan',
        labelKey: 'theme.preset.comprehensiveCyan',
        brand: { light: '#0891B2', dark: '#22D3EE', darkMode: false },
    },
    {
        id: 'classicInk',
        labelKey: 'theme.preset.classicInk',
        brand: { light: '#1F2937', dark: '#94A3B8', darkMode: false },
    },
];
