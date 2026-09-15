"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

// In-memory cache (per browser tab, not persisted) so the same string is never sent to
// /api/translate twice for the same language — every component using the same copy (e.g. a nav
// label reused across pages) shares one cached result instead of re-translating independently.
// This is the source of truth for translated text; component state below only exists to trigger
// a re-render once a fetch resolves and adds a new entry here.
const cache = new Map<string, string>();
const inFlight = new Set<string>();

function cacheKey(text: string, lang: string) {
  return `${lang}::${text}`;
}

/**
 * Returns `text` translated into the currently-selected language, going through Sarvam AI via
 * /api/translate. Renders the original English immediately (and while a translation is in
 * flight) rather than blocking or showing a loading state — a brief flash of English before the
 * translated text swaps in is preferable to the whole page waiting on a network round trip.
 */
export function useTranslated(text: string): string {
  const { language } = useLanguage();
  const [, bumpTick] = useState(0);

  useEffect(() => {
    if (language === "en" || !text.trim()) return;

    const key = cacheKey(text, language);
    if (cache.has(key) || inFlight.has(key)) return;

    inFlight.add(key);
    let cancelled = false;

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguageCode: language }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.translatedText) cache.set(key, data.translatedText);
        bumpTick((n) => n + 1); // re-render so the cache lookup below picks up the new entry
      })
      .catch(() => {
        /* translation failed — the original English stays showing, which is a fine fallback */
      })
      .finally(() => {
        inFlight.delete(key);
      });

    return () => {
      cancelled = true;
    };
  }, [text, language]);

  if (language === "en" || !text.trim()) return text;
  return cache.get(cacheKey(text, language)) ?? text;
}

/** JSX convenience wrapper around useTranslated, for wrapping plain string children inline
 * instead of pulling the hook into every component that needs one or two translated strings. */
export function T({ children }: { children: string }) {
  return <>{useTranslated(children)}</>;
}
