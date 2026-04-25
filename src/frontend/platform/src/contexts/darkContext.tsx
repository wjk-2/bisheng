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
      return JSON.parse(window.localStorage.getItem("isDark")) ?? false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("isDark", dark.toString());
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
