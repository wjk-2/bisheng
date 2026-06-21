/**
 * DerivedPreview —— 3B.5 步骤 2.1 派生结果只读展示组件。
 *
 * 职责：只读展示派生出的 22 令牌 × light/dark 色板 + 标注固定语义色
 * （destructive/warning 不随品牌色变）+ 业务固定状态色（status-*）。
 *
 * 纯展示层：props down，无 onChange/callback（派生是上层 deriveTheme 产物，
 * 组件不重新派生）。CSS 变量值展示用 hslToRgb/rgbToHex 把 CompTheme {h,s,l} 转 hex，
 * 与 colorUtils 同源（避免引入 chroma-js 第三方）。
 *
 * i18n：所有文案走 useTranslation，文案步骤 5 补齐；key 缺失时显示 key 本身（i18next
 * 默认行为），可接受。
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CompTheme } from '@shared/theme/themeConfig';
import { hslToRgb, rgbToHex } from '@shared/theme/colorUtils';

export interface DerivedPreviewProps {
    /** 浅色派生结果（22 令牌 HSL，0-1 制）。 */
    light: CompTheme;
    /** 深色派生结果。 */
    dark: CompTheme;
}

/**
 * 业务固定的状态色（不随主题变，来自 tailwind.config safelist）。
 * hex 为 var(--status-*) 的兜底常量值，供色块背景展示。
 */
const STATUS_COLORS: Array<{ key: string; hex: string }> = [
    { key: 'status-blue', hex: '#3b82f6' },
    { key: 'status-green', hex: '#22c55e' },
    { key: 'status-red', hex: '#ef4444' },
    { key: 'status-yellow', hex: '#eab308' },
];

/** CompTheme 单令牌 HSL（0-1 制）→ hex 字符串。 */
function compTokenToHex(comp: CompTheme, token: string): string {
    const v = comp[token];
    if (!v) return '';
    const { r, g, b } = hslToRgb(v.h, v.s * 100, v.l * 100);
    return rgbToHex(r, g, b);
}

/**
 * 单个色块：令牌名 + hex + 背景填色。
 * 文字色据背景明度自动选黑/白，避免深色背景上看不见字。
 */
const Swatch: React.FC<{ token: string; hex: string }> = ({ token, hex }) => {
    // 简单明度判断：用 hex 的相对亮度决定文字黑白（无需引 chroma-js）。
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const textColor = lum > 0.5 ? '#000000' : '#ffffff';
    return (
        <div
            data-testid={`swatch-${token}`}
            className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs"
            style={{ backgroundColor: hex, color: textColor }}
        >
            <span className="font-mono">{token}</span>
            <span className="font-mono opacity-90">{hex}</span>
        </div>
    );
};

/**
 * 单套色板（light 或 dark）：遍历 CompTheme 的 22 令牌，每令牌一个色块。
 */
const Palette: React.FC<{ mode: 'light' | 'dark'; comp: CompTheme }> = ({ mode, comp }) => {
    const { t } = useTranslation();
    return (
        <div data-testid={`derived-${mode}`} className="flex flex-col gap-2">
            <div className="text-sm font-medium">
                {mode === 'light' ? t('theme.derived.light') : t('theme.derived.dark')}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {Object.keys(comp).map((token) => {
                    const hex = compTokenToHex(comp, token);
                    if (!hex) return null;
                    return <Swatch key={token} token={token} hex={hex} />;
                })}
            </div>
        </div>
    );
};

/**
 * 固定语义色分区：destructive / warning（派生主题中值固定）+ status-*（业务色）。
 * 标注说明这些色不随品牌色变化。
 */
const SemanticFixed: React.FC<{ light: CompTheme; dark: CompTheme }> = ({ light, dark }) => {
    const { t } = useTranslation();
    const fixed: Array<{ token: string; lightHex: string; darkHex: string }> = [
        {
            token: '--destructive',
            lightHex: compTokenToHex(light, '--destructive'),
            darkHex: compTokenToHex(dark, '--destructive'),
        },
        {
            token: '--warning',
            lightHex: compTokenToHex(light, '--warning'),
            darkHex: compTokenToHex(dark, '--warning'),
        },
        // status-* 不在 CompTheme（业务 var），展示固定兜底 hex（light=dark 同值）。
        ...STATUS_COLORS.map((s) => ({ token: s.key, lightHex: s.hex, darkHex: s.hex })),
    ];
    return (
        <div data-testid="semantic-fixed" className="flex flex-col gap-2">
            <div className="text-sm font-medium">{t('theme.semantic.fixed')}</div>
            <div className="text-xs text-muted-foreground">{t('theme.semantic.fixedDesc')}</div>
            <div className="grid grid-cols-1 gap-2">
                {fixed.map((f) => (
                    <div
                        key={f.token}
                        className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
                    >
                        <span className="font-mono">{f.token}</span>
                        <span className="flex items-center gap-2">
                            <span
                                data-testid={`swatch-${f.token}-light`}
                                className="inline-block h-4 w-8 rounded"
                                style={{ backgroundColor: f.lightHex }}
                                title={`light: ${f.lightHex}`}
                            />
                            <span
                                data-testid={`swatch-${f.token}-dark`}
                                className="inline-block h-4 w-8 rounded"
                                style={{ backgroundColor: f.darkHex }}
                                title={`dark: ${f.darkHex}`}
                            />
                        </span>
                      </div>
                ))}
            </div>
        </div>
    );
};

const DerivedPreview: React.FC<DerivedPreviewProps> = ({ light, dark }) => {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-6">
                <Palette mode="light" comp={light} />
                <Palette mode="dark" comp={dark} />
            </div>
            <SemanticFixed light={light} dark={dark} />
        </div>
    );
};

export default DerivedPreview;
