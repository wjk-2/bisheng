import { Button } from "@/components/bs-ui/button";
import { saveThemeApi } from "@/controllers/API";
import { RefreshCw } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import Example from "./Example";
import HSLitem from "./HSLitem";
import { RadioGroup, RadioGroupItem } from "@/components/bs-ui/radio";
import { Label } from "@/components/bs-ui/label";
import { useTranslation } from "react-i18next";

type CompTheme = Record<string, { h: number; s: number; l: number }>;
type ThemeValue = { light: CompTheme; dark: CompTheme; bg: string };

declare global {
    interface Window {
        ThemeStyle: ThemeValue;
        __injectThemeVars?: (comp: CompTheme) => void;
    }
}

// Default theme configuration
const defaultLightTheme: CompTheme = {
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
    '--black-button': { h: 0, s: 0, l: 0.07 },
};

const defaultDarkTheme: CompTheme = {
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
    '--black-button': { h: 0, s: 0, l: 0.07 },
};

function parseWebConfig(raw: string): ThemeValue {
    if (!raw) return { light: defaultLightTheme, dark: defaultDarkTheme, bg: '' };
    try {
        const parsed = JSON.parse(raw);
        if (parsed.light) {
            // v2 格式：{ light: CompTheme, dark: CompTheme, bg: string }
            return {
                light: parsed.light || defaultLightTheme,
                dark: parsed.dark || defaultDarkTheme,
                bg: parsed.bg || '',
            };
        }
        if (parsed.comp) {
            // v1 旧格式：{ comp: CompTheme, bg: string } → 向后兼容迁移
            return {
                light: parsed.comp,
                dark: defaultDarkTheme,
                bg: parsed.bg || '',
            };
        }
        return { light: defaultLightTheme, dark: defaultDarkTheme, bg: '' };
    } catch {
        return { light: defaultLightTheme, dark: defaultDarkTheme, bg: '' };
    }
}

function applyThemeComp(comp: CompTheme) {
    let rules = '';
    for (const key of Object.keys(comp)) {
        const hsl = comp[key];
        rules += key + ':' + hsl.h + ' ' + (hsl.s * 100) + '% ' + (hsl.l * 100) + '%;';
    }
    let style = document.getElementById('theme-vars') as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style') as HTMLStyleElement;
        style.id = 'theme-vars';
        document.head.appendChild(style);
    }
    style.innerHTML = ':root{' + rules + '}';
}

// Theme key mappings for internationalization
const themeKeys = {
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
    "--radius": "theme.radius",
    "--warning": "theme.warning",
    "--warning-foreground": "theme.warningForeground",
    '--black-button': 'theme.blackButton',
};

export default function Theme() {
    const [theme, setTheme] = useState(() => {
        const mode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        const saved = window.ThemeStyle?.[mode];
        if (saved && Object.keys(saved).length > 0) return saved;
        return mode === 'dark' ? { ...defaultDarkTheme } : { ...defaultLightTheme };
    });
    const [bg, setBg] = useState(window.ThemeStyle.bg || 'logo')
    const { t } = useTranslation()

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedSaveTheme = useCallback((value: string) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveThemeApi(value);
        }, 300);
    }, []);
    const applyTheme = (newTheme: CompTheme) => {
        const mode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        applyThemeComp(newTheme);
        setTheme(newTheme);
        window.ThemeStyle = { ...window.ThemeStyle, [mode]: newTheme };
        saveThemeApi(JSON.stringify({ light: window.ThemeStyle.light, dark: window.ThemeStyle.dark, bg: window.ThemeStyle.bg }));
    };

    const handleHSLChange = (name: string, hsl: { h: number; s: number; l: number }) => {
        const newTheme = { ...theme, [name]: hsl };
        const mode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
        setTheme(newTheme);
        applyThemeComp(newTheme);
        window.ThemeStyle = { ...window.ThemeStyle, [mode]: newTheme };
        debouncedSaveTheme(JSON.stringify({ light: window.ThemeStyle.light, dark: window.ThemeStyle.dark, bg: window.ThemeStyle.bg }));
    };


    return <div className="flex justify-center border-t bg-accent">
        <div className="w-96 py-4 pr-8 border-r ">
            <p className="flex justify-between items-center mb-4">
                <span className="text-lg">{t('theme.colorConfig')}</span>
                <Button className="right" variant="link" onClick={e => applyTheme({ ...defaultLightTheme })}><RefreshCw className="mr-1 size-4" />{t('theme.restoreDefault')}</Button>
            </p>
            <div className="grid grid-cols-2 gap-2 gap-x-8 my-8">
                {
                    Object.keys(theme).map(key => {
                        return <HSLitem key={key} label={t(themeKeys[key])} name={key} value={theme[key]} onChange={handleHSLChange} />
                    })
                }
            </div>
            <p className="flex justify-between items-center mb-4">
                <span className="text-lg">{t('theme.workflowBackgroundConfig')}</span>
            </p>
            <RadioGroup value={bg} onValueChange={(val) => {
                window.ThemeStyle = { ...window.ThemeStyle, bg: val };
                saveThemeApi(JSON.stringify({ light: window.ThemeStyle.light, dark: window.ThemeStyle.dark, bg: val }));
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
