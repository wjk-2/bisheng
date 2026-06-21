/**
 * BrandPicker —— 3B.5 步骤 3.1 品牌色输入组件。
 *
 * 职责：light + dark 两套品牌色输入（type=color 可视化取色 + type=text 精确 HEX）
 * + darkMode 偏好开关（仅记录，不切全局 mode —— 已定决策）。
 *
 * M3 闭环（输入校验，调用方职责）：text 输入用 classifyHex 三态判定——
 *   - valid：合法 #rrggbb，纳入 onChange
 *   - pending：合法 hex 字符但未满 6 位（输入中），不调 onChange，UI 黄色提示
 *   - invalid：含非法字符，不调 onChange，UI 红色提示
 * **onChange 仅在 light + dark 同时 valid 时上抛**（themeApply.previewTheme/commitTheme
 * 对非法 hex 抛 Error，本组件挡在前面保证只上抛合法值，非法中间态不触达派生）。
 *
 * 纯展示层：props down / callback up，本地 state 仅保存输入字符串（允许中间态），
 * 不调 themeApply/persistence（那是 orchestrator 职责）。
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/bs-ui/switch';
import { isValidHex } from '@shared/theme/colorUtils';
import type { BrandValue } from './presets';

export interface BrandPickerProps {
    value: BrandValue;
    /** 仅在 light + dark 同时合法时调用，上抛完整合法 BrandValue。 */
    onChange: (next: BrandValue) => void;
}

type HexState = 'valid' | 'pending' | 'invalid';

/**
 * HEX 输入三态判定。
 *   valid：isValidHex 通过（合法 6 位 #rrggbb）
 *   pending：去 # 后全是 hex 字符但不足 6 位（输入中间态，如 '#123'）
 *   invalid：含非 hex 字符或超长（如 '#GGG' / '#1234567'）
 */
function classifyHex(s: string): HexState {
    if (isValidHex(s)) return 'valid';
    const body = s.startsWith('#') ? s.slice(1) : s;
    if (/^[0-9a-fA-F]*$/.test(body) && body.length < 6) return 'pending';
    return 'invalid';
}

/** color input 的 value 必须合法 hex，非法时兜底（仅展示用，不影响 text 真实输入）。 */
function safeColor(s: string): string {
    return isValidHex(s) ? (s.startsWith('#') ? s : `#${s}`) : '#000000';
}

/** 单套（light 或 dark）品牌色输入：color + text + 三态提示。 */
const ColorField: React.FC<{
    label: string;
    idPrefix: string; // 'brand-light' | 'brand-dark'
    value: string;
    state: HexState;
    onColorChange: (v: string) => void;
    onTextChange: (v: string) => void;
    invalidHint: string;
    pendingHint: string;
}> = ({ label, idPrefix, value, state, onColorChange, onTextChange, invalidHint, pendingHint }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{label}</span>
        <div className="flex items-center gap-2">
            <input
                type="color"
                data-testid={`${idPrefix}-color`}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                value={safeColor(value)}
                onChange={(e) => onColorChange(e.target.value)}
            />
            <input
                type="text"
                data-testid={`${idPrefix}-text`}
                className="h-8 w-28 rounded border border-border bg-background px-2 font-mono text-xs"
                value={value}
                spellCheck={false}
                onChange={(e) => onTextChange(e.target.value)}
            />
        </div>
        {state === 'invalid' && (
            <span data-testid={`${idPrefix}-invalid`} className="text-xs text-destructive">
                {invalidHint}
            </span>
        )}
        {state === 'pending' && (
            <span data-testid={`${idPrefix}-pending`} className="text-xs text-warning">
                {pendingHint}
            </span>
        )}
    </div>
);

const BrandPicker: React.FC<BrandPickerProps> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const [lightStr, setLightStr] = useState(value.light);
    const [darkStr, setDarkStr] = useState(value.dark);
    const [darkMode, setDarkMode] = useState(value.darkMode);

    const lightState = classifyHex(lightStr);
    const darkState = classifyHex(darkStr);

    /** 仅当 light + dark 都合法时上抛。 */
    const emit = (nextLight: string, nextDark: string, nextDarkMode: boolean): void => {
        if (classifyHex(nextLight) === 'valid' && classifyHex(nextDark) === 'valid') {
            onChange({ light: nextLight, dark: nextDark, darkMode: nextDarkMode });
        }
    };

    const handleLight = (v: string): void => {
        setLightStr(v);
        emit(v, darkStr, darkMode);
    };
    const handleDark = (v: string): void => {
        setDarkStr(v);
        emit(lightStr, v, darkMode);
    };
    const handleDarkMode = (checked: boolean): void => {
        setDarkMode(checked);
        emit(lightStr, darkStr, checked);
    };

    const invalidHint = t('theme.brand.invalidHex');
    const pendingHint = t('theme.brand.pendingHex');

    return (
        <div className="flex flex-col gap-4">
            <ColorField
                label={t('theme.brand.light')}
                idPrefix="brand-light"
                value={lightStr}
                state={lightState}
                onColorChange={handleLight}
                onTextChange={handleLight}
                invalidHint={invalidHint}
                pendingHint={pendingHint}
            />
            <ColorField
                label={t('theme.brand.dark')}
                idPrefix="brand-dark"
                value={darkStr}
                state={darkState}
                onColorChange={handleDark}
                onTextChange={handleDark}
                invalidHint={invalidHint}
                pendingHint={pendingHint}
            />
            <div className="flex items-center gap-2">
                <Switch
                    data-testid="brand-darkmode-switch"
                    checked={darkMode}
                    onCheckedChange={handleDarkMode}
                />
                <span className="text-xs">{t('theme.brand.darkMode')}</span>
            </div>
        </div>
    );
};

export default BrandPicker;
