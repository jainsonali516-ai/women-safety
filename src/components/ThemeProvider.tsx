"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "tulip-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The actual initial paint is decided by the inline script in layout.tsx (a Server
  // Component, so it can render a plain <script> safely — Next.js 16 flags <script> tags
  // rendered from Client Components, which is exactly the FOUC-prevention trick next-themes
  // uses internally, and it was causing a hydration mismatch). This just mirrors whatever
  // that script already put on <html data-theme> so toggling stays in sync.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync with the inline script's pre-hydration value
      setThemeState(current);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable — theme just won't persist across visits */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
