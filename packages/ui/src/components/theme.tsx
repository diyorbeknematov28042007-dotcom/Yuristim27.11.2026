import type { ThemeMode } from "@yuristim/design-tokens";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ResolvedTheme = "light" | "dark";
type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = "yuristim.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveTheme = (
  mode: ThemeMode,
  options: { systemDark: boolean; telegramTheme?: ResolvedTheme | null },
): ResolvedTheme => {
  if (mode !== "system") return mode;
  return options.telegramTheme ?? (options.systemDark ? "dark" : "light");
};

export const ThemeProvider = ({
  children,
  defaultMode = "system",
  telegramTheme = null,
}: {
  children: ReactNode;
  defaultMode?: ThemeMode;
  telegramTheme?: ResolvedTheme | null;
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultMode;
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolvedTheme = resolveTheme(mode, { systemDark, telegramTheme });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setMode = (nextMode: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    setModeState(nextMode);
  };
  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
};

export const themeBootScript = `(() => { try { const value = localStorage.getItem("${STORAGE_KEY}") || "system"; const dark = value === "dark" || (value === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; } })();`;
