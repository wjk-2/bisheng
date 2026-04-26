import { useSetRecoilState } from 'recoil';
import React, { createContext, useState, useEffect } from 'react';
import { getInitialTheme, applyFontSize } from '~/utils';
import store from '~/store';
import { getWebConfigApi } from '../api/apps';

type ProviderValue = {
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
};

const defaultContextValue: ProviderValue = {
  theme: getInitialTheme(),
  setTheme: () => {
    return;
  },
};

export const isDark = (theme: string): boolean => {
  return theme === 'dark';
};

export const ThemeContext = createContext<ProviderValue>(defaultContextValue);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const setFontSize = useSetRecoilState(store.fontSize);

  const applyThemeVars = (comp: Record<string, { h: number; s: number; l: number }>) => {
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
  };

  const rawSetTheme = (rawTheme: string) => {
    const root = window.document.documentElement;
    const darkMode = isDark(rawTheme);
    root.classList.remove(darkMode ? 'light' : 'dark');
    root.classList.add(darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', rawTheme);
    const ts = (window as any).ThemeStyle;
    if (ts && typeof ts === 'object') {
      const newMode = rawTheme === 'dark' ? 'dark' : 'light';
      const comp = ts[newMode] ?? {};
      if (Object.keys(comp).length > 0) {
        applyThemeVars(comp);
      } else {
        // 没有对应模式的自定义数据，清空 theme-vars 让 CSS .dark {} 规则生效
        const style = document.getElementById('theme-vars');
        if (style) style.innerHTML = ':root{}';
      }
    }
  };

  useEffect(() => {
    getWebConfigApi().then((parsed) => {
      if (!parsed) return;
      const currentMode = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
      let comp: Record<string, { h: number; s: number; l: number }> = {};
      if (parsed.light) {
        // v2 格式：按当前模式选择
        comp = (currentMode === 'dark' ? parsed.dark : parsed.light) ?? {};
      } else if (parsed.comp && currentMode === 'light') {
        // v1 格式：只有 light 数据，暗色模式下不注入，让 .dark {} 规则生效
        comp = parsed.comp;
      }
      if (Object.keys(comp).length > 0) {
        applyThemeVars(comp);
      }
      (window as any).ThemeStyle = parsed.light
        ? { light: parsed.light, dark: parsed.dark ?? {}, bg: parsed.bg ?? '' }
        : { light: parsed.comp ?? {}, dark: {}, bg: parsed.bg ?? '' };
    });
  }, []);

  useEffect(() => {
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize == null) {
      setFontSize('text-base');
      applyFontSize('text-base');
      localStorage.setItem('fontSize', 'text-base');
      return;
    }
    applyFontSize(JSON.parse(fontSize));
    // Reason: This effect should only run once, and `setFontSize` is a stable function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rawSetTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};
