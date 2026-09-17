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

// Words that make a sentence read as a genuinely eye-catching fact — superlatives, records,
// landmarks, heritage, craftsmanship, culture — rather than a dry dictionary-style definition.
// This only re-ranks REAL sentences already in the article; it never adds or invents wording.
const INTERESTING_KEYWORDS = [
  "famous", "renowned", "iconic", "unique", "largest", "smallest", "biggest", "oldest", "newest",
  "first", "only", "tallest", "longest", "widest", "record", "unesco", "world heritage",
  "heritage", "legend", "legendary", "myth", "mythical", "named after", "built by", "built in",
  "constructed", "designed by", "architect", "century", "dynasty", "empire", "emperor", "king",
  "architecture", "architectural", "style", "houses", "home to", "one of the", "originally",
  "believed to", "according to", "monument", "landmark", "temple", "fort", "palace", "garden",
  "tomb", "mosque", "shrine", "sculpture", "artwork", "museum", "gallery", "biodiversity",
  "species", "wildlife", "cuisine", "festival", "tradition", "cultural", "sacred", "pilgrimage",
  "carving", "carved", "marble", "sandstone", "dome", "minaret", "tower", "spans", "stretches",
  "attracts", "visitors", "tourists", "known for", "notable for", "credited with", "inspired",
];

// A sentence opening this way ("X is a neighbourhood/locality/...") is the dry, dictionary-style
// definition Wikipedia leads almost every article with — real and accurate, but not what makes a
// "Did You Know?" card interesting on its own unless it also earns points above.
const DRY_OPENER_RE = /^[^.!?]{0,80}\b(is|was)\s+(a|an|the)\s+(neighbourhood|neighborhood|locality|area|region|colony|market|road|street|village|town|city|suburb|zone|sector)\b/i;

function wordCount(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function scoreInterestingness(sentence: string): number {
  const lower = sentence.toLowerCase();
  let score = INTERESTING_KEYWORDS.reduce((sum, word) => sum + (lower.includes(word) ? 3 : 0), 0);
  if (/\d/.test(sentence)) score += 1; // a concrete year/size/count reads as more specific
  if (DRY_OPENER_RE.test(sentence) && score === 0) score -= 2;
  // A card fact reads best at roughly 20-35 words — long enough to say something real, short
  // enough to fit in 1-2 lines. Sentences outside that range are still eligible, just ranked
  // lower, so a great fact isn't discarded purely for length.
  const words = wordCount(sentence);
  if (words >= 12 && words <= 35) score += 2;
  else if (words < 6 || words > 55) score -= 2;
  return score;
}

// `explaintext` extracts beyond the lead section include MediaWiki's own "== Heading ==" section
// markers as plain text (e.g. "...southwestern.\n\n\n== Architecture ==\nThe tower includes...")
// — stripped out here so a heading never gets glued onto the end of a real sentence or shows up
// as visible "== ... ==" text in the card.
function stripSectionHeadings(text: string): string {
  return text.replace(/={2,}\s*[^=\n]+\s*={2,}/g, " ").replace(/\s+/g, " ").trim();
}

// Splits on sentence-ending punctuation followed by whitespace + a capital letter — good enough
// for Wikipedia's plain-text extracts, which don't have the abbreviation edge cases that make
// general sentence splitting hard (no "e.g." / "Dr." style content in a typical opening summary).
function splitSentences(text: string): string[] {
  return stripSectionHeadings(text).split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

const MAX_FACT_LENGTH = 220;

function clampLength(sentence: string): string | null {
  if (sentence.length <= MAX_FACT_LENGTH) return sentence;
  // A real sentence, just long — trim at the last full word within the limit rather than
  // inventing a shorter version of it.
  const truncated = sentence.slice(0, MAX_FACT_LENGTH).replace(/\s+\S*$/, "");
  return truncated.length > 40 ? `${truncated}…` : null;
}

/** Picks the most eye-catching real sentence from the article's opening section — scored for
 * superlatives/landmarks/culture/history rather than just taking whichever comes first, which
 * was usually the dry "X is a Y located in Z" definitional lead sentence. */
function pickCleanSentence(extract: string): string | null {
  const sentences = splitSentences(extract).slice(0, 25);
  const candidates = sentences.filter((s) => !isNegative(s));
  if (candidates.length === 0) return null;

  const scored = candidates.map((sentence) => ({ sentence, score: scoreInterestingness(sentence) }));
  scored.sort((a, b) => b.score - a.score);
  return clampLength(scored[0].sentence);
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

/** The REST summary endpoint's extract is usually just the first 1-2 sentences — too little to
 * pick a genuinely interesting one from. This pulls real article content beyond just the lead
 * paragraph (up to MediaWiki's 10-sentence cap for the `extracts` prop) via the classic API
 * instead, giving pickCleanSentence real candidates — including facts that only show up a few
 * sentences into the article — to choose between. Falls back to null (caller uses the REST
 * summary's shorter extract instead) if this second call fails — never blocks the feature on it. */
async function fetchDeeperExtract(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      exsentences: "10",
      explaintext: "true",
      titles: title,
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as { extract?: string } | undefined;
    return page?.extract || null;
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
      const deeperExtract = await fetchDeeperExtract(summary.title);
      const fact = pickCleanSentence(deeperExtract || summary.extract);
      const sourceUrl = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`;
      if (fact) result = { fact, title: summary.title, sourceUrl };
    }
  } catch {
    result = null;
  }

  cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
