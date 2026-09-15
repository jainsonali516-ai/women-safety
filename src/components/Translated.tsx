"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

// In-memory cache (this is the source of truth for translated text; component state below only
// exists to trigger a re-render once a batch resolves and adds new entries here) plus a
// localStorage mirror, so a string translated once doesn't need to hit /api/translate again on a
// later visit or page reload — only genuinely new text ever gets sent.
const cache = new Map<string, string>();
const inFlight = new Set<string>();
const pendingByLanguage = new Map<string, Set<string>>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

const STORAGE_KEY = "herlane-translations";

function cacheKey(text: string, lang: string) {
  return `${lang}::${text}`;
}

function loadPersistedCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(stored)) cache.set(key, value);
  } catch {
    /* corrupt or unavailable storage — start with an empty cache */
  }
}
loadPersistedCache();

function persistCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    /* storage full/unavailable — the cache just won't survive a reload */
  }
}

function notifyAll() {
  listeners.forEach((listener) => listener());
}

/**
 * Every useTranslated()/<T> call that asks for a not-yet-cached string within the same ~30ms
 * window is folded into one /api/translate request instead of each firing its own — a page can
 * have dozens of distinct strings, and translating them one HTTP round trip at a time (instead of
 * a single request carrying all of them) is what made switching languages feel slow.
 */
function scheduleFlush(language: string) {
  if (flushTimers.has(language)) return;
  const timer = setTimeout(() => {
    flushTimers.delete(language);
    flush(language);
  }, 30);
  flushTimers.set(language, timer);
}

async function flush(language: string) {
  const pending = pendingByLanguage.get(language);
  pendingByLanguage.delete(language);
  if (!pending || pending.size === 0) return;

  const texts = Array.from(pending);
  texts.forEach((t) => inFlight.add(cacheKey(t, language)));

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, targetLanguageCode: language }),
    });
    if (res.ok) {
      const data = await res.json();
      const translatedTexts: string[] = data.translatedTexts ?? [];
      texts.forEach((t, i) => {
        if (translatedTexts[i]) cache.set(cacheKey(t, language), translatedTexts[i]);
      });
      persistCache();
    }
  } catch {
    /* translation failed — the original text stays showing, which is a fine fallback */
  } finally {
    texts.forEach((t) => inFlight.delete(cacheKey(t, language)));
    notifyAll();
  }
}

/**
 * Returns `text` translated into the currently-selected language, going through Sarvam AI via
 * /api/translate (batched with any other strings requested around the same time). Renders the
 * original English immediately (and while a translation is in flight) rather than blocking or
 * showing a loading state.
 */
export function useTranslated(text: string): string {
  const { language } = useLanguage();
  const [, bumpTick] = useState(0);

  useEffect(() => {
    const listener = () => bumpTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (language === "en" || !text.trim()) return;
    const key = cacheKey(text, language);
    if (cache.has(key) || inFlight.has(key)) return;

    if (!pendingByLanguage.has(language)) pendingByLanguage.set(language, new Set());
    pendingByLanguage.get(language)!.add(text);
    scheduleFlush(language);
  }, [text, language]);

  if (language === "en" || !text.trim()) return text;
  return cache.get(cacheKey(text, language)) ?? text;
}

/** JSX convenience wrapper around useTranslated, for wrapping plain string children inline
 * instead of pulling the hook into every component that needs one or two translated strings.
 * `source`, when given, is what actually gets sent for translation instead of `children` — for
 * short UI labels that are genuinely ambiguous out of context to a generic MT model (e.g. "About"
 * alone can come back as "approximately" rather than a page name), passing a fuller, unambiguous
 * phrase to translate while still displaying the short label in English fixes the mistranslation
 * without changing what English users see. */
export function T({ children, source }: { children: string; source?: string }) {
  const { language } = useLanguage();
  const translated = useTranslated(source ?? children);
  return language === "en" ? children : translated;
}
