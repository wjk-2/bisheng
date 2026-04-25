import { useSetRecoilState } from 'recoil';
import React, { createContext, useState, useEffect } from 'react';
import { getInitialTheme, applyFontSize } from '~/utils';
import store from '~/store';

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
    const root = window.document.documentElement;
    const darkMode = isDark(rawTheme);
    root.classList.remove(darkMode ? 'light' : 'dark');
    root.classList.add(darkMode ? 'dark' : 'light');
    localStorage.setItem('color-theme', rawTheme);
  };

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
