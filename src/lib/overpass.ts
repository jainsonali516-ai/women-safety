import { getCached, setCached } from "./overpassCache";

// Shared Overpass query helper with a retry against a second free public mirror. Every safety
// signal in this app (street-light density, foot-traffic, route amenities, nearby help points)
// depends on Overpass's free, shared, rate-limited public server — testing earlier in this
// project found it can intermittently 429/504/time out under load, which previously meant a
// single failed request silently came back as "no results found" for whatever it was querying,
// with no distinction from "genuinely nothing nearby." That's what caused amenities to visibly
// flicker between searches (e.g. police+washroom showing once, only hospital the next time) —
// each category is its own independent query, so a transient failure on any one of them dropped
// just that category for that search. Retrying once, against a different instance, fixes most
// of these transient failures without doubling load on whichever server just struggled.
//
// Results (including a failed `null`) are also cached for a few minutes (see overpassCache.ts) —
// without that, two otherwise-identical calls a minute apart could get different answers purely
// from this server's own flakiness, not from anything actually changing on the ground.
const OVERPASS_MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const OVERPASS_HEADERS = {
  "Content-Type": "text/plain",
  "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)",
  Accept: "application/json",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the parsed Overpass JSON, or null if every attempt failed.
 * A genuinely successful response is usually 1-3s; `timeoutMs` per attempt is generous headroom
 * without letting one stuck attempt (potentially doubled by the mirror retry, and again per
 * amenity type since these run sequentially — see fetchRouteAmenities) drag a whole search out
 * too far. `retryMirror: false` skips the second mirror entirely — worth it for a feature where
 * failing fast matters more than squeezing out one more transient-failure recovery, like the
 * free-exploration map browsing (unlike the safety-score-relevant calls, which keep the retry).
 */
export async function queryOverpass(query: string, timeoutMs = 10000, retryMirror = true): Promise<{ elements: unknown[] } | null> {
  const cacheKey = `${retryMirror}:${query}`;
  const cached = getCached<{ elements: unknown[] } | null>(cacheKey);
  if (cached !== undefined) return cached;

  const mirrors = retryMirror ? OVERPASS_MIRRORS : OVERPASS_MIRRORS.slice(0, 1);
  for (let attempt = 0; attempt < mirrors.length; attempt++) {
    try {
      const res = await fetch(mirrors[attempt], {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body: query,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const data = await res.json();
        setCached(cacheKey, data);
        return data;
      }
      console.error(`[overpass] ${mirrors[attempt]} -> HTTP ${res.status}`);
    } catch (err) {
      console.error(`[overpass] ${mirrors[attempt]} -> ${err instanceof Error ? err.message : err}`);
    }
    if (attempt < mirrors.length - 1) await delay(500);
  }
  setCached(cacheKey, null);
  return null;
}
