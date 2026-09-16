import { istParts } from "@/lib/istTime";
import { getSunTimes } from "@/lib/sunTimes";
import { queryOverpass } from "@/lib/overpass";
import { CACHE_TTL_MS } from "@/lib/cacheConfig";

interface LatLng {
  latitude: number;
  longitude: number;
}

// Rounds to ~100m grid so two near-identical midpoints (e.g. slightly different GPS precision
// for "the same place") build the same Overpass query string and hit the same cache entry.
function roundCoord(n: number) {
  return Math.round(n * 1000) / 1000;
}

// Rounds a timestamp down to the current cache-TTL window so two calls within the same window
// can't land on opposite sides of an hour/sunset boundary and silently get a different
// rush-hour/after-dark reading for what's effectively the same moment.
function bucketedDate(date: Date) {
  return new Date(Math.floor(date.getTime() / CACHE_TTL_MS) * CACHE_TTL_MS);
}

/**
 * Counts mapped street lights within `radiusMeters` of the midpoint of a route.
 * Free OSM data — no API key required. Used as a real, live proxy for lit-street density,
 * since Google Earth Engine night-light imagery requires a GCP service account with Earth
 * Engine access (a manual approval process) that isn't wired up in this environment yet.
 */
export async function fetchStreetLightDensity(point: LatLng, radiusMeters = 400) {
  const query = `
    [out:json][timeout:15];
    node["highway"="street_lamp"](around:${radiusMeters},${roundCoord(point.latitude)},${roundCoord(point.longitude)});
    out count;
  `;

  const data = await queryOverpass(query);
  if (!data) return { count: 0, available: false };
  const count = Number((data.elements?.[0] as { tags?: { total?: string } } | undefined)?.tags?.total ?? 0);
  return { count, available: true };
}

/**
 * Foot-traffic / commercial-activity density via free OSM Overpass data: counts mapped
 * shops, restaurants/cafes, and other public amenities nearby as a proxy for how populated
 * an area typically is (a Google Places Nearby Search substitute that needs no API key).
 */
export async function fetchFootTrafficScore(point: LatLng, radiusMeters = 400) {
  const lat = roundCoord(point.latitude);
  const lng = roundCoord(point.longitude);
  const query = `
    [out:json][timeout:15];
    (
      node["shop"](around:${radiusMeters},${lat},${lng});
      node["amenity"~"restaurant|cafe|fast_food|marketplace|pharmacy|bank|atm"](around:${radiusMeters},${lat},${lng});
    );
    out count;
  `;

  const data = await queryOverpass(query);
  if (!data) return { score: null, available: false as const };
  const placeCount = Number((data.elements?.[0] as { tags?: { total?: string } } | undefined)?.tags?.total ?? 0);
  // Same reasoning as the street-light floor below: OSM's shop/amenity tagging is genuinely
  // sparse for a lot of real, populated Indian residential streets, so "0 mapped" is
  // inconclusive, not "confirmed deserted." A hard floor of 0 here was fine when this signal
  // was only ever averaged 50/50 with lighting — now that daytime scoring weights foot traffic
  // up to 70%, an unmapped-but-genuinely-normal street would otherwise get dragged down hard.
  const score = Math.min(100, Math.round(30 + placeCount * 10));
  return { score, available: true as const };
}

/**
 * Rush/delay score without a live-traffic feed: a time-of-day heuristic. OSRM's free public
 * routing server returns typical-traffic distance/duration only, not live congestion, so this
 * stands in for a real congestion-ratio score until a paid traffic API is configured.
 */
export function computeHeuristicRushScore(date = new Date()) {
  const { hour, isWeekend } = istParts(bucketedDate(date));
  if (isWeekend) return 80;
  const isPeak = (hour >= 8 && hour < 11) || (hour >= 17 && hour < 22);
  return isPeak ? 40 : 85;
}

/**
 * Real astronomical sunset for Delhi NCR, not a fixed 19:00 cutoff — Delhi's actual sunset
 * ranges from ~17:25 IST in late December to ~19:20 IST in late June, so a fixed threshold was
 * routinely wrong by an hour or more depending on the season.
 */
export function isAfterSunset(date = new Date()) {
  const bucketed = bucketedDate(date);
  const { preciseHour } = istParts(bucketed);
  const { sunriseHour, sunsetHour } = getSunTimes(bucketed);
  return preciseHour >= sunsetHour || preciseHour < sunriseHour;
}

export interface SafetyInputs {
  streetLightCount: number;
  streetLightDataAvailable: boolean;
  footTrafficScore: number | null;
  afterSunset: boolean;
}

/**
 * Combines available live signals into a 0-100 safety score. Missing signals are simply excluded
 * from the weighted average. Weighting shifts with time of day: lighting matters far more once
 * it's actually dark, while during daylight a lively, populated stretch is the better signal and
 * an OSM lamp count (which is only ever relevant after dark anyway) is de-emphasized.
 */
export function computeSafetyScore({ streetLightCount, streetLightDataAvailable, footTrafficScore, afterSunset }: SafetyInputs) {
  // OSM's highway=street_lamp tagging is very incomplete for Indian cities — most real,
  // genuinely-lit streets simply have zero individually-mapped lamp nodes. Treating "0 found"
  // as "confirmed unlit" (the old `count * 10`, floor 0) was systematically dragging nearly
  // every route into a false "high risk" reading. A 0 count is inconclusive, not a red flag —
  // the floor here reflects that uncertainty instead of asserting darkness.
  const lightScore = streetLightDataAvailable ? Math.min(100, 35 + streetLightCount * 15) : null;

  if (lightScore === null && footTrafficScore === null) return 50; // neutral fallback, no live data
  if (lightScore === null) return footTrafficScore as number;
  if (footTrafficScore === null) return lightScore;

  const lightWeight = afterSunset ? 0.65 : 0.3;
  return Math.round(lightScore * lightWeight + footTrafficScore * (1 - lightWeight));
}

export function computeFinalScore(safetyScore: number, rushScore: number, mode: "balanced" | "safest" | "fastest" | "cheapest", afterSunset: boolean) {
  if (mode === "safest") return safetyScore;
  if (mode === "fastest") return rushScore;
  if (mode === "cheapest") return rushScore; // cheapest sorting is applied on fare, not this score
  const safetyWeight = afterSunset ? 0.7 : 0.45;
  const rushWeight = 1 - safetyWeight;
  return Math.round(safetyScore * safetyWeight + rushScore * rushWeight);
}
