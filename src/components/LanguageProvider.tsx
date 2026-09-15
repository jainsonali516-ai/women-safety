"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type LanguageCode = "en" | "hi-IN" | "bn-IN" | "ta-IN" | "te-IN" | "mr-IN" | "gu-IN" | "kn-IN" | "ml-IN" | "pa-IN";

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "mr-IN", label: "मराठी" },
  { code: "gu-IN", label: "ગુજરાતી" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "മലയാളം" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
];

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "herlane-language";

/** Always renders "en" on the server and on first client render (avoids a hydration mismatch,
 * same pattern as ThemeProvider) — the stored language, if any, is applied right after mount. A
 * flash of English before it swaps to the saved language is an acceptable tradeoff here (unlike
 * light/dark, which gets a pre-hydration script to avoid a visible flash entirely). */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync with the saved preference on mount
        setLanguageState(stored);
      }
    } catch {
      /* localStorage unavailable — just stays on English */
    }
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* localStorage unavailable — selection just won't persist across visits */
    }
  }, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
