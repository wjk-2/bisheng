import { Button } from "@/components/bs-ui/button";
import { RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Example from "./Example";
import HSLitem from "./HSLitem";
import { RadioGroup, RadioGroupItem } from "@/components/bs-ui/radio";
import { Label } from "@/components/bs-ui/label";
import { useTranslation } from "react-i18next";
import {
    DEFAULT_LIGHT_THEME,
    DEFAULT_DARK_THEME,
    type CompTheme,
    type ThemeValue,
    type ThemeVarKey,
} from "@/services/theme/themeConfig";
import { applyLight, applyDark } from "@/services/theme/themeRuntime";
import {
    saveThemeDebounced,
    getCurrentVersion,
    cancelPendingSave,
} from "@/services/theme/themePersistence";

declare global {
    interface Window {
        ThemeStyle: ThemeValue;
        __injectThemeVars?: (comp: CompTheme) => void;
    }
}

/**
 * themeKeys：CSS 变量 key → i18n 文案 key 的映射，用于 HSLitem 标签国际化。
 * 用 ThemeVarKey 索引锁死键集合与 DEFAULT_LIGHT_THEME 一致（新增变量时编译期提醒同步）。
 */
const themeKeys: Record<ThemeVarKey, string> = {
    "--primary": "theme.primary",
    "--primary-foreground": "theme.primaryForeground",
    "--background": "theme.background",
    "--foreground": "theme.foreground",
    "--muted": "theme.muted",
    "--muted-foreground": "theme.mutedForeground",
    "--card": "theme.card",
    "--card-foreground": "theme.cardForeground",
    "--popover": "theme.popover",
    "--popover-foreground": "theme.popoverForeground",
    "--border": "theme.border",
    "--input": "theme.input",
    "--secondary": "theme.secondary",
    "--secondary-foreground": "theme.secondaryForeground",
    "--accent": "theme.accent",
    "--accent-foreground": "theme.accentForeground",
    "--destructive": "theme.destructive",
    "--destructive-foreground": "theme.destructiveForeground",
    "--ring": "theme.ring",
    "--warning": "theme.warning",
    "--warning-foreground": "theme.warningForeground",
    '--black-button': 'theme.blackButton',
};

/** 序列化当前 window.ThemeStyle 为后端存储格式（{light, dark, bg}）。 */
function serializeThemeStyle(): string {
    const ts = window.ThemeStyle;
    return JSON.stringify({ light: ts.light, dark: ts.dark, bg: ts.bg });
}

export default function Theme() {
    const [theme, setTheme] = useState(() => {
        const mode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        const saved = window.ThemeStyle?.[mode];
        if (saved && Object.keys(saved).length > 0) return saved;
        return mode === 'dark' ? { ...DEFAULT_DARK_THEME } : { ...DEFAULT_LIGHT_THEME };
    });
    const [bg, setBg] = useState(window.ThemeStyle?.bg || 'logo')
    const { t } = useTranslation()

    /**
     * C7 乐观锁 version 缓存。
     *
     * 挂载时拉取一次当前 version；每次 saveThemeDebounced 带上此 version；
     * 冲突时由 onConflict 回调刷新到最新（下次 save 用新 version 重试）。
     * 用 useRef 而非 useState：version 变化不需要触发重渲染，避免无谓 render。
     */
    const versionRef = useRef<number>(0);
    useEffect(() => {
        // 挂载时拉取当前 version，供后续 saveThemeDebounced 乐观锁比对
        getCurrentVersion().then(v => { versionRef.current = v; });
        return () => {
            // 卸载时取消挂起的 debounce save，防旧请求后到覆盖（替代原 C4 clearTimeout）
            cancelPendingSave();
        };
    }, []);

    /**
     * 把 newTheme 写入当前 mode 的 DOM 与 window.ThemeStyle，并触发 debounced save。
     *
     * 收敛后注入走 themeRuntime.applyLight / applyDark（双 style 常驻，按当前 mode
     * 只更新对应那套；另一 mode style 不动，避免单 #theme-vars 整体替换的 A4/C2 缺陷）。
     * 持久化走 themePersistence.saveThemeDebounced（内置 300ms debounce + 10032 冲突
     * toast + onConflict 回调刷新 version）。
     */
    const applyThemeChange = (newTheme: CompTheme, options: { debounce: boolean }) => {
        const mode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        // 双 style 注入：只写当前 mode 的那套，另一套保持不动（双 style 常驻方案）
        if (mode === 'dark') {
            applyDark(newTheme);
        } else {
            applyLight(newTheme);
        }
        setTheme(newTheme);
        window.ThemeStyle = { ...window.ThemeStyle, [mode]: newTheme };
        const value = serializeThemeStyle();
        if (options.debounce) {
            // HSL 调色：debounce 合并连续输入，带 version 乐观锁
            saveThemeDebounced(value, versionRef.current, (latest) => {
                versionRef.current = latest;
            });
        } else {
            // 恢复默认 / bg 切换：立即落库前先取消挂起的 debounce，防旧请求后到覆盖
            // （原 C4 clearTimeout 语义，由 themePersistence.cancelPendingSave 替代）
            cancelPendingSave();
            saveThemeDebounced(value, versionRef.current, (latest) => {
                versionRef.current = latest;
            });
        }
    };

    const applyTheme = (newTheme: CompTheme) => {
        applyThemeChange(newTheme, { debounce: false });
    };

    const handleHSLChange = (name: string, hsl: { h: number; s: number; l: number }) => {
        const newTheme = { ...theme, [name]: hsl };
        applyThemeChange(newTheme, { debounce: true });
    };


    return <div className="flex justify-center border-t bg-accent">
        <div className="w-96 py-4 pr-8 border-r ">
            <p className="flex justify-between items-center mb-4">
                <span className="text-lg">{t('theme.colorConfig')}</span>
                <Button className="right" variant="link" onClick={e => applyTheme({ ...(localStorage.getItem('theme') === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME) })}><RefreshCw className="mr-1 size-4" />{t('theme.restoreDefault')}</Button>
            </p>
            <div className="grid grid-cols-2 gap-2 gap-x-8 my-8">
                {
                    Object.keys(theme).map(key => {
                        return <HSLitem key={key} label={t(themeKeys[key as ThemeVarKey])} name={key} value={theme[key]} onChange={handleHSLChange} />
                    })
                }
            </div>
            <p className="flex justify-between items-center mb-4">
                <span className="text-lg">{t('theme.workflowBackgroundConfig')}</span>
            </p>
            <RadioGroup value={bg} onValueChange={(val) => {
                window.ThemeStyle = { ...window.ThemeStyle, bg: val };
                // bg 切换：立即落库（取消挂起 debounce 后直接 save）
                cancelPendingSave();
                saveThemeDebounced(serializeThemeStyle(), versionRef.current, (latest) => {
                    versionRef.current = latest;
                });
                setBg(val)
            }}
                className="flex space-x-2 h-[20px] mt-4 mb-6">
                <div>
                    <Label className="flex justify-center">
                        <RadioGroupItem className="mr-2" value="logo" />{t('theme.eagentLogo')}
                    </Label>
                </div>
                <div>
                    <Label className="flex justify-center">
                        <RadioGroupItem className="mr-2" value="gradient" />{t('theme.themeColorGradientEffect')}
                    </Label>
                </div>
            </RadioGroup>
        </div>
        <div className="px-4 py-4 bg-card">
            <p className="text-xl mb-4">{t('theme.componentPreview')}</p>
            <div>
                {/* Component list */}
                <Example />
            </div>
        </div>
    </div>
};
