import { istParts } from "@/lib/istTime";

interface LatLng {
  latitude: number;
  longitude: number;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/**
 * Counts mapped street lights within `radiusMeters` of the midpoint of a route.
 * Free OSM data — no API key required. Used as a real, live proxy for lit-street density,
 * since Google Earth Engine night-light imagery requires a GCP service account with Earth
 * Engine access (a manual approval process) that isn't wired up in this environment yet.
 */
export async function fetchStreetLightDensity(point: LatLng, radiusMeters = 400) {
  const query = `
    [out:json][timeout:15];
    node["highway"="street_lamp"](around:${radiusMeters},${point.latitude},${point.longitude});
    out count;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)",
        Accept: "application/json",
      },
      body: query,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { count: 0, available: false };
    const json = await res.json();
    const count = Number(json?.elements?.[0]?.tags?.total ?? 0);
    return { count, available: true };
  } catch {
    return { count: 0, available: false };
  }
}

/**
 * Foot-traffic / commercial-activity density via free OSM Overpass data: counts mapped
 * shops, restaurants/cafes, and other public amenities nearby as a proxy for how populated
 * an area typically is (a Google Places Nearby Search substitute that needs no API key).
 */
export async function fetchFootTrafficScore(point: LatLng, radiusMeters = 400) {
  const query = `
    [out:json][timeout:15];
    (
      node["shop"](around:${radiusMeters},${point.latitude},${point.longitude});
      node["amenity"~"restaurant|cafe|fast_food|marketplace|pharmacy|bank|atm"](around:${radiusMeters},${point.latitude},${point.longitude});
    );
    out count;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)",
        Accept: "application/json",
      },
      body: query,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { score: null, available: false as const };
    const json = await res.json();
    const placeCount = Number(json?.elements?.[0]?.tags?.total ?? 0);
    // Normalize: 15+ nearby shops/amenities ≈ fully busy commercial area. Most residential
    // stretches genuinely have only a handful of shops within 400m, so a stricter denominator
    // (this used to be 25) made almost every non-market street register as "isolated".
    const score = Math.min(100, Math.round((placeCount / 15) * 100));
    return { score, available: true as const };
  } catch {
    return { score: null, available: false as const };
  }
}

/**
 * Rush/delay score without a live-traffic feed: a time-of-day heuristic. OSRM's free public
 * routing server returns typical-traffic distance/duration only, not live congestion, so this
 * stands in for a real congestion-ratio score until a paid traffic API is configured.
 */
export function computeHeuristicRushScore(date = new Date()) {
  const { hour, isWeekend } = istParts(date);
  if (isWeekend) return 80;
  const isPeak = (hour >= 8 && hour < 11) || (hour >= 17 && hour < 22);
  return isPeak ? 40 : 85;
}

export function isAfterSunset(date = new Date()) {
  const { hour } = istParts(date);
  return hour >= 19 || hour < 6;
}

export interface SafetyInputs {
  streetLightCount: number;
  streetLightDataAvailable: boolean;
  footTrafficScore: number | null;
}

/** Combines available live signals into a 0-100 safety score. Missing signals are simply excluded from the average. */
export function computeSafetyScore({ streetLightCount, streetLightDataAvailable, footTrafficScore }: SafetyInputs) {
  // OSM's highway=street_lamp tagging is very incomplete for Indian cities — most real,
  // genuinely-lit streets simply have zero individually-mapped lamp nodes. Treating "0 found"
  // as "confirmed unlit" (the old `count * 10`, floor 0) was systematically dragging nearly
  // every route into a false "high risk" reading. A 0 count is inconclusive, not a red flag —
  // the floor here reflects that uncertainty instead of asserting darkness.
  const lightScore = streetLightDataAvailable ? Math.min(100, 35 + streetLightCount * 15) : null;
  const signals = [lightScore, footTrafficScore].filter(
    (v): v is number => typeof v === "number"
  );
  if (signals.length === 0) return 50; // neutral fallback when no live data is available
  return Math.round(signals.reduce((a, b) => a + b, 0) / signals.length);
}

export function computeFinalScore(safetyScore: number, rushScore: number, mode: "balanced" | "safest" | "fastest" | "cheapest") {
  const afterSunset = isAfterSunset();
  if (mode === "safest") return safetyScore;
  if (mode === "fastest") return rushScore;
  if (mode === "cheapest") return rushScore; // cheapest sorting is applied on fare, not this score
  const safetyWeight = afterSunset ? 0.7 : 0.45;
  const rushWeight = 1 - safetyWeight;
  return Math.round(safetyScore * safetyWeight + rushScore * rushWeight);
}
