import { useSetRecoilState } from 'recoil';
import React, { createContext, useState, useEffect } from 'react';
import { getInitialTheme, applyFontSize } from '~/utils';
import store from '~/store';
import { getWebConfigApi } from '../api/apps';
import { applyLight, applyDark, setMode } from '@shared/theme/themeRuntime';

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

  const rawSetTheme = (rawTheme: string) => {
    localStorage.setItem('theme', rawTheme);
    setMode(isDark(rawTheme) ? 'dark' : 'light');
  };

  useEffect(() => {
    getWebConfigApi().then((parsed) => {
      if (!parsed) return;
      applyLight(parsed.light);
      applyDark(parsed.dark);
    });
  }, []);

  // C3：跨 tab 同步。他 tab 改 localStorage.theme 时本 tab 跟随。
  // 仅当 newValue 有效（'light'/'dark'）才跟随；他 tab 删除 theme（newValue=null）时本 tab 保持当前，不强制切浅色。
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) setTheme(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
