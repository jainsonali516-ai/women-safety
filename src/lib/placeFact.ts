const WIKI_HEADERS = {
  "User-Agent": "HerLaneSafetyApp/1.0 (contact: safety-app)",
  Accept: "application/json",
};

interface WikiSummary {
  title: string;
  extract: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
}

export interface PlaceFact {
  fact: string;
  title: string;
  sourceUrl: string;
}

interface CacheEntry {
  value: PlaceFact | null;
  expiresAt: number;
}

// Facts about a place don't change day to day, so a long TTL just saves repeat Wikipedia calls
// for the same destination — same reasoning as every other cache in this app, just a much longer
// window since this isn't live data.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

// Sentences containing any of these (case-insensitive, word-boundary) are skipped — the fact
// requirement is explicitly "interesting, positive, or neutral," never dark/violent/tragic.
// This is a keyword filter over REAL Wikipedia sentences, not content generation — it can only
// ever reject a sentence, never invent or alter one.
const NEGATIVE_KEYWORDS = [
  "war", "wars", "riot", "riots", "massacre", "attack", "attacked", "attacks", "terrorist",
  "terrorism", "bomb", "bombing", "bombed", "killed", "killing", "murder", "murdered", "death",
  "deaths", "died", "assassinat", "disaster", "earthquake", "flood", "flooding", "violence",
  "violent", "rape", "crime", "criminal", "unrest", "genocide", "invasion", "invaded", "siege",
  "conquest", "conquered", "captured", "execution", "executed", "slaughter", "casualties",
  "insurgen", "communal", "uprising", "revolt", "rebellion", "plague", "epidemic", "outbreak",
];

function isNegative(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return NEGATIVE_KEYWORDS.some((word) => new RegExp(`\\b${word}`, "i").test(lower));
}

// Splits on sentence-ending punctuation followed by whitespace + a capital letter — good enough
// for Wikipedia's plain-text extracts, which don't have the abbreviation edge cases that make
// general sentence splitting hard (no "e.g." / "Dr." style content in a typical opening summary).
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

const MAX_FACT_LENGTH = 220;

function pickCleanSentence(extract: string): string | null {
  const sentences = splitSentences(extract).slice(0, 6); // only the opening summary is checked
  for (const sentence of sentences) {
    if (isNegative(sentence)) continue;
    if (sentence.length <= MAX_FACT_LENGTH) return sentence;
    // A real sentence, just long — trim at the last full word within the limit rather than
    // inventing a shorter version of it.
    const truncated = sentence.slice(0, MAX_FACT_LENGTH).replace(/\s+\S*$/, "");
    return truncated.length > 40 ? `${truncated}…` : null;
  }
  return null;
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WikiSummary;
    // "disambiguation" pages have no single real subject to draw a fact from.
    if (data.type === "disambiguation" || !data.extract) return null;
    return data;
  } catch {
    return null;
  }
}

async function searchBestTitle(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      format: "json",
      origin: "*",
      srlimit: "3",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.query?.search?.[0];
    return first?.title ?? null;
  } catch {
    return null;
  }
}

/**
 * A single short, real, non-negative fact about a place from Wikipedia's own free REST API — no
 * key needed, no HTML scraping. Returns null whenever no suitable article or clean sentence was
 * found, which the caller must treat as "don't show the card," never as an error to surface.
 */
export async function fetchPlaceFact(place: string, context?: string): Promise<PlaceFact | null> {
  const cacheKey = `${place.toLowerCase()}|${(context ?? "").toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  let result: PlaceFact | null = null;
  try {
    // Try the place name directly first — cheaper than a search round-trip, and works for any
    // place with an unambiguous, exact-match Wikipedia title (most named landmarks/localities).
    let summary = await fetchSummary(place);
    if (!summary) {
      const query = context ? `${place} ${context}` : place;
      const bestTitle = await searchBestTitle(query);
      if (bestTitle) summary = await fetchSummary(bestTitle);
    }

    if (summary) {
      const fact = pickCleanSentence(summary.extract);
      const sourceUrl = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;
      if (fact) result = { fact, title: summary.title, sourceUrl };
    }
  } catch {
    result = null;
  }

  cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
