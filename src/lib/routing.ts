import { getCached, setCached } from "./overpassCache";

interface LatLng {
  latitude: number;
  longitude: number;
}

// Rounds to ~100m grid, same reasoning as scoring.ts's roundCoord — two near-identical
// coordinate pairs for "the same place" should hit the same cache entry.
function roundCoord(n: number) {
  return Math.round(n * 1000) / 1000;
}

function routeCacheKey(origin: LatLng, destination: LatLng) {
  return `route:${roundCoord(origin.latitude)},${roundCoord(origin.longitude)}->${roundCoord(destination.latitude)},${roundCoord(destination.longitude)}`;
}

/**
 * Real driving distance/duration + full road-snapped route geometry via OSRM's free public
 * demo routing server — no API key. Note: this is typical-traffic routing, not live
 * congestion-aware traffic (OSRM's public demo server doesn't offer that). Rush-hour scoring
 * falls back to a time-of-day heuristic instead of a live delay ratio — see src/lib/peakHours.ts.
 *
 * The geometry follows real street turns/flyovers/roundabouts, not a straight line between the
 * two endpoints — it's requested here (rather than a second, separate call) so the map can reuse
 * exactly the same route this function already fetches for cab/bus/auto duration estimates,
 * instead of firing a duplicate request against OSRM's shared, rate-limited public server.
 */
export async function fetchDrivingRoute(origin: LatLng, destination: LatLng) {
  const cacheKey = routeCacheKey(origin, destination);
  const cached = getCached<ReturnType<typeof buildDrivingRouteResult> | null>(cacheKey);
  if (cached !== undefined) return cached;

  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      setCached(cacheKey, null);
      return null;
    }
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      setCached(cacheKey, null);
      return null;
    }

    const result = buildDrivingRouteResult(data.routes[0]);
    setCached(cacheKey, result);
    return result;
  } catch {
    setCached(cacheKey, null);
    return null;
  }
}

function buildDrivingRouteResult(route: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }) {
  const polyline: [number, number][] = (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng]);
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    polyline,
  };
}

/** Real turn-by-turn text directions + route geometry, for caching an offline emergency route. */
export async function fetchTurnByTurnRoute(origin: LatLng, destination: LatLng) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    const steps: string[] = route.legs.flatMap((leg: { steps: { maneuver: { type: string; modifier?: string }; name: string; distance: number }[] }) =>
      leg.steps.map((s) => {
        const distance = s.distance >= 1000 ? `${(s.distance / 1000).toFixed(1)} km` : `${Math.round(s.distance)} m`;
        const road = s.name ? ` onto ${s.name}` : "";
        const action = s.maneuver.modifier ? `${s.maneuver.type} (${s.maneuver.modifier})` : s.maneuver.type;
        return `${action}${road} — ${distance}`;
      })
    );

    const polyline: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    return { steps, polyline, distanceMeters: route.distance as number, durationSeconds: route.duration as number };
  } catch {
    return null;
  }
}
