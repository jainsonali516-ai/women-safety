import { queryOverpass } from "@/lib/overpass";

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TransitAnchor {
  name: string;
  latitude: number;
  longitude: number;
  walkMeters: number;
}

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * The single nearest real station/stop to a point, from live OSM data — never a guessed or
 * interpolated location. Returns null when nothing of that kind is mapped within radiusMeters,
 * which the caller must treat as "unknown," not silently substitute anything for.
 */
async function fetchNearestNode(
  point: LatLng,
  tagClause: string,
  radiusMeters: number,
  defaultName: string
): Promise<TransitAnchor | null> {
  const query = `
    [out:json][timeout:8];
    node${tagClause}(around:${radiusMeters},${point.latitude},${point.longitude});
    out body 20;
  `;
  // Short timeout, no mirror retry: this backs an on-demand "View on Map" click, not the initial
  // route-planning response — failing fast and saying "not available" beats making the user wait.
  const data = await queryOverpass(query, 6000, false);
  if (!data) return null;

  const candidates = (data.elements as { tags?: Record<string, string>; lat: number; lon: number }[]).map((el) => ({
    name: el.tags?.name ?? defaultName,
    latitude: el.lat,
    longitude: el.lon,
    walkMeters: Math.round(haversineMeters(point, { latitude: el.lat, longitude: el.lon })),
  }));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.walkMeters - b.walkMeters);
  return candidates[0];
}

export function fetchNearestBusStop(point: LatLng, radiusMeters = 800): Promise<TransitAnchor | null> {
  return fetchNearestNode(point, `["highway"="bus_stop"]`, radiusMeters, "Bus Stop");
}
