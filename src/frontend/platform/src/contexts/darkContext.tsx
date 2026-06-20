import { createContext, useEffect, useState } from "react";
import { setMode } from "@/services/theme/themeRuntime";

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
    // 双 style 常驻方案（themeRuntime + bootstrap 一致）：
    //   - light/dark style 各自常驻 DOM，切模式只 toggle html 的 .dark class（setMode 内部 classList.toggle），
    //     不重写 style —— 消除旧单 #theme-vars 整体替换的 A4（切模式丢注入）/C2（切回丢色）。
    //   - bootstrap（index.html inline）已改写双 id（#theme-vars-light / #theme-vars-dark），
    //     与运行时 themeRuntime.applyLight/applyDark 写同一两节点；老单 #theme-vars 与 __injectThemeVars 已清除。
    setMode(dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
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
