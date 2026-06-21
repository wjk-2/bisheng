/**
 * PresetThemes —— 3B.5 步骤 3.2 预设品牌色网格。
 *
 * 职责：展示 8 个学术品牌色预设（presets.ts），点击上抛对应 brand。
 * current 与某 preset 三字段（light/dark/darkMode）全等时高亮该项。
 *
 * 纯展示层：props down / callback up，无本地 state。
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRESETS, type BrandValue } from './presets';

export interface PresetThemesProps {
    /** 当前品牌色，用于高亮匹配的 preset。 */
    current: BrandValue;
    onSelect: (brand: BrandValue) => void;
}

/** 两个 BrandValue 三字段是否全等。 */
function brandEquals(a: BrandValue, b: BrandValue): boolean {
    return (
        a.light.toLowerCase() === b.light.toLowerCase() &&
        a.dark.toLowerCase() === b.dark.toLowerCase() &&
        a.darkMode === b.darkMode
    );
}

const PresetThemes: React.FC<PresetThemesProps> = ({ current, onSelect }) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-4 gap-3">
            {PRESETS.map((preset) => {
                const active = brandEquals(current, preset.brand);
                return (
                    <button
                        key={preset.id}
                        type="button"
                        data-testid={`preset-${preset.id}`}
                        data-active={active ? 'true' : 'false'}
                        onClick={() => onSelect(preset.brand)}
                        className={`flex flex-col items-center gap-1 rounded border p-2 transition-colors ${
                            active ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <span
                            data-testid={`preset-swatch-${preset.id}`}
                            className="h-8 w-full rounded"
                            style={{ backgroundColor: preset.brand.light }}
                        />
                        <span className="text-xs">{t(preset.labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default PresetThemes;
