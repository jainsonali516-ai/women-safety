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

/** Foot-traffic / commercial-activity density via Google Places Nearby Search. Requires GOOGLE_PLACES_API_KEY. */
export async function fetchFootTrafficScore(point: LatLng, radiusMeters = 400) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { score: null, available: false as const };

  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${point.latitude},${point.longitude}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    const json = await res.json();
    const placeCount = Array.isArray(json?.results) ? json.results.length : 0;
    // Normalize: 20+ nearby places ≈ fully busy commercial area.
    const score = Math.min(100, Math.round((placeCount / 20) * 100));
    return { score, available: true as const };
  } catch {
    return { score: null, available: false as const };
  }
}

export function isAfterSunset(date = new Date()) {
  const hour = date.getHours();
  return hour >= 19 || hour < 6;
}

export interface SafetyInputs {
  streetLightCount: number;
  streetLightDataAvailable: boolean;
  footTrafficScore: number | null;
}

/** Combines available live signals into a 0-100 safety score. Missing signals are simply excluded from the average. */
export function computeSafetyScore({ streetLightCount, streetLightDataAvailable, footTrafficScore }: SafetyInputs) {
  const lightScore = streetLightDataAvailable ? Math.min(100, streetLightCount * 10) : null; // 10 lamps within 400m ≈ fully lit
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
