"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

const ThemeContext = createContext<{ theme: Theme; choose(theme: Theme): void } | null>(null);

function readPreference(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch { return null; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const preference = useRef<Theme | null>(null);
  const path = usePathname();

  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      preference.current = readPreference();
      const next = preference.current ?? (system.matches ? "dark" : "light");
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    const onSystemChange = () => {
      if (preference.current) return;
      const next = system.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync();
    };
    sync();
    system.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      system.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!document.querySelector("[data-os]")) return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = theme === "dark" ? "#17181c" : "#ede4d3";
      meta.removeAttribute("media");
    }
  }, [theme, path]);

  const choose = useCallback((next: Theme) => {
    preference.current = next;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Keep the choice for this visit when storage is blocked. */ }
  }, []);

  return <ThemeContext.Provider value={{ theme, choose }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme controls need ThemeProvider.");
  return context;
}
