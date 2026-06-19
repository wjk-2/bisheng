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
    // 双 style 常驻方案（themeRuntime）：light/dark style 各自常驻 DOM，
    // 切模式只 toggle html 的 .dark class（setMode 内部 classList.toggle），
    // 不重写 style —— 消除旧单 #theme-vars 整体替换的 A4（切模式丢注入）/C2（切回丢色）。
    //
    // bootstrap 现状（index.html inline，src/frontend/platform/index.html）：
    //   - 写单 `#theme-vars`（按当前 mode 用 :root 或 .dark 选择器整体重写），
    //     并挂 `window.__injectThemeVars` 供运行时更新。
    //   - 注意：与 themeRuntime 的 `#theme-vars-light`/`#theme-vars-dark`（双 style）是不同 DOM 节点，
    //     不是同一节点二次写。两者并行存在（三 style 并存），靠 source order 功能正常。
    //   - 旧 __injectThemeVars 调用已从 darkContext 移除：运行时 theme/index.tsx 的 applyTheme
    //     走 themeRuntime.applyLight/applyDark（写 light/dark 双 style）。
    //   - 阶段3 改造：统一 index.html bootstrap 也写 light/dark 双 id，消除老 `#theme-vars` 残留。
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
