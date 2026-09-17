export interface TransitAlert {
  headline: string;
  description: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  mode: "metro" | "bus" | "general";
}

const NEWSDATA_URL = "https://newsdata.io/api/1/latest";
// News doesn't change minute to minute, and this conserves the free-tier's daily request quota —
// same reasoning as every other TTL cache in this app (see lib/cacheConfig.ts).
const CACHE_TTL_MS = 20 * 60 * 1000;
// An article only counts as describing a *current* disruption if it's this recent — without this,
// a well-indexed old strike/protest story could surface as if it were happening today.
const RECENCY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

interface NewsdataArticle {
  title: string;
  description?: string | null;
  link: string;
  pubDate: string;
  source_name?: string;
}

let cached: { value: TransitAlert | null; expiresAt: number } | null = null;

function detectMode(text: string): TransitAlert["mode"] {
  const lower = text.toLowerCase();
  const hasMetro = /\bmetro\b|\bdmrc\b/.test(lower);
  const hasBus = /\bbus\b|\bdtc\b/.test(lower);
  if (hasBus && !hasMetro) return "bus";
  if (hasMetro && !hasBus) return "metro";
  return "general";
}

/**
 * Checks for a genuinely current (last 3 days) Delhi NCR transit disruption — a strike, rally, or
 * road closure — via a live news search (newsdata.io). Returns null (not a guess, not a stale
 * placeholder) whenever NEWS_API_KEY isn't configured, the request fails, or nothing recent
 * enough is found. This is a live news search, not an official DMRC/DTC feed or a curated events
 * calendar — the UI attributes it as such and links back to the source article.
 */
export async function checkTransitDisruption(): Promise<TransitAlert | null> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return null;

  try {
    // qInTitle (not q) restricts matches to the headline itself, not the full article body —
    // this is what keeps off-topic hits out (an article that merely mentions "metro" or "DTC" in
    // passing, e.g. a business/real-estate piece, won't match unless the disruption is IN the
    // headline). The AND of a transit term with a disruption term (strike/protest/block/shutdown)
    // is what brings protests and road blocks into scope without opening the query up to
    // unrelated Delhi strikes/protests (verified: "Delhi strike OR Delhi protest" alone pulled in
    // diplomatic incidents and court cases with zero transit relevance).
    const params = new URLSearchParams({
      apikey: apiKey,
      qInTitle: '(DTC OR "Delhi metro" OR "Delhi bus") AND (strike OR protest OR block OR shutdown)',
      country: "in",
      language: "en",
    });
    const res = await fetch(`${NEWSDATA_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      cached = { value: null, expiresAt: Date.now() + CACHE_TTL_MS };
      return null;
    }

    const data = (await res.json()) as { results?: NewsdataArticle[] };
    const now = Date.now();
    const recent = (data.results ?? []).find((article) => {
      const published = new Date(`${article.pubDate.replace(" ", "T")}Z`).getTime();
      return !Number.isNaN(published) && now - published <= RECENCY_WINDOW_MS;
    });

    const result: TransitAlert | null = recent
      ? {
          headline: recent.title,
          description: recent.description ?? "",
          url: recent.link,
          sourceName: recent.source_name ?? "News",
          publishedAt: recent.pubDate,
          mode: detectMode(`${recent.title} ${recent.description ?? ""}`),
        }
      : null;

    cached = { value: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch {
    cached = { value: null, expiresAt: Date.now() + CACHE_TTL_MS };
    return null;
  }
}
