import { createContext, useEffect, useState } from "react";

type darkContextType = {
  dark: boolean;
  setDark: (newState: boolean) => void;
};

const initialValue = {
  dark: false,
  setDark: () => { },
};

export const darkContext = createContext<darkContextType>(initialValue);

export function DarkProvider({ children }) {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      // 一次性迁移：旧 key "isDark" → 新 key "theme"
      if (localStorage.getItem('theme') === null) {
        const legacy = localStorage.getItem('isDark');
        if (legacy !== null) {
          localStorage.setItem('theme', legacy === 'true' ? 'dark' : 'light');
          localStorage.removeItem('isDark');
        }
      }
      return localStorage.getItem('theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    // 重注入对应套的 CSS 变量
    if (window.ThemeStyle && window.__injectThemeVars) {
      const comp = window.ThemeStyle[dark ? 'dark' : 'light'] || {};
      if (Object.keys(comp).length > 0) {
        window.__injectThemeVars(comp);
      } else {
        // 没有对应模式的自定义数据，清空 theme-vars 让 CSS 默认规则生效
        const style = document.getElementById('theme-vars');
        if (style) style.innerHTML = ':root{}';
      }
    }
  }, [dark]);
  return (
    <darkContext.Provider
      value={{
        dark,
        setDark,
      }}
    >
      {children}
    </darkContext.Provider>
  );
}
