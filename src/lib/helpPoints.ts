import { queryOverpass } from "@/lib/overpass";

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface HelpPoint {
  name: string;
  type: "hospital" | "police" | "metro";
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface RouteAmenity {
  name: string;
  type: "washroom" | "hospital" | "police" | "safe_zone";
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
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
 * Nearest hospitals, police stations, and metro stations around a point, via the free OSM
 * Overpass API (no key). Used to seed the offline emergency cache with real "safe haven"
 * locations rather than fabricated ones.
 */
export async function fetchNearbyHelpPoints(point: LatLng, radiusMeters = 2000): Promise<HelpPoint[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:${radiusMeters},${point.latitude},${point.longitude});
      node["amenity"="police"](around:${radiusMeters},${point.latitude},${point.longitude});
      node["railway"="station"](around:${radiusMeters},${point.latitude},${point.longitude});
    );
    out body 20;
  `;

  const data = await queryOverpass(query);
  if (!data) return [];

  const points: HelpPoint[] = (data.elements as { tags?: Record<string, string>; lat: number; lon: number }[])
    .map((el) => {
      const tags = el.tags ?? {};
      const type: HelpPoint["type"] = tags.amenity === "hospital" ? "hospital" : tags.amenity === "police" ? "police" : "metro";
      return {
        name: tags.name ?? (type === "hospital" ? "Hospital" : type === "police" ? "Police Station" : "Metro Station"),
        type,
        latitude: el.lat,
        longitude: el.lon,
        distanceMeters: Math.round(haversineMeters(point, { latitude: el.lat, longitude: el.lon })),
      };
    })
    .sort((a: HelpPoint, b: HelpPoint) => a.distanceMeters - b.distanceMeters);

  // At most one of each type where possible, capped at 3, so the list isn't all hospitals.
  const byType = new Map<string, HelpPoint>();
  for (const p of points) {
    if (!byType.has(p.type)) byType.set(p.type, p);
    if (byType.size === 3) break;
  }
  return Array.from(byType.values());
}

/** Approximate perpendicular distance (meters) from a point to the straight-line segment a→b. */
function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng) {
  // Small-scale equirectangular projection is accurate enough at city scale.
  const lat0 = (a.latitude * Math.PI) / 180;
  const toXY = (p: LatLng) => ({
    x: ((p.longitude - a.longitude) * Math.PI) / 180 * Math.cos(lat0) * 6371000,
    y: ((p.latitude - a.latitude) * Math.PI) / 180 * 6371000,
  });
  const A = toXY(a);
  const B = toXY(b);
  const P = toXY(point);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSq));
  const closest = { x: A.x + t * dx, y: A.y + t * dy };
  return Math.sqrt((P.x - closest.x) ** 2 + (P.y - closest.y) ** 2);
}

/**
 * Public washrooms, hospitals, and police stations within `bufferMeters` of the straight-line
 * path between origin and destination — used to plot color-coded safety amenity markers on the
 * map. Approximates "along the route" via perpendicular distance to the straight segment, since
 * the app doesn't load full turn-by-turn route geometry into the map (see SafetyMapContainer).
 */
// "safe_zone" covers pharmacies, malls, and restaurants/cafes — busy, well-lit places along a
// route rather than a designated emergency-response point like a hospital or police station.
// Needs an OR of several OSM tags, so it's a query-fragment builder rather than one flat tag.
function overpassFilterFor(type: RouteAmenity["type"], searchRadius: number, mid: LatLng): string {
  const around = `(around:${searchRadius},${mid.latitude},${mid.longitude})`;
  if (type === "washroom") return `node["amenity"="toilets"]${around};`;
  if (type === "hospital") return `node["amenity"="hospital"]${around};`;
  if (type === "police") return `node["amenity"="police"]${around};`;
  return `
    node["amenity"~"pharmacy|restaurant|cafe"]${around};
    node["shop"="mall"]${around};
  `;
}

function defaultNameFor(type: RouteAmenity["type"]): string {
  if (type === "washroom") return "Public Washroom";
  if (type === "hospital") return "Hospital";
  if (type === "police") return "Police Station";
  return "Nearby Safe Zone";
}

async function fetchAmenitiesOfType(
  type: RouteAmenity["type"],
  mid: LatLng,
  searchRadius: number,
  origin: LatLng,
  destination: LatLng,
  bufferMeters: number
): Promise<RouteAmenity[]> {
  // One lightweight query per amenity type — combining all types (plus a high result cap) into
  // a single query reliably timed out (504) under load on Overpass's shared public server;
  // several small queries succeed far more often, same lesson as the other Overpass calls in
  // this app (see fetchStreetLightDensity/fetchFootTrafficScore in scoring.ts). A smaller result
  // cap (was 60) also means less for Overpass to compute/transfer and less for us to parse —
  // the map only ever shows a handful of nearby markers per type anyway.
  const query = `
    [out:json][timeout:12];
    (${overpassFilterFor(type, searchRadius, mid)});
    out body 35;
  `;

  const data = await queryOverpass(query);
  if (!data) return [];

  return (data.elements as { tags?: Record<string, string>; lat: number; lon: number }[])
    .map((el): RouteAmenity => {
      const tags = el.tags ?? {};
      const point = { latitude: el.lat, longitude: el.lon };
      return {
        name: tags.name ?? defaultNameFor(type),
        type,
        latitude: el.lat,
        longitude: el.lon,
        distanceFromRouteMeters: Math.round(distanceToSegmentMeters(point, origin, destination)),
      };
    })
    .filter((a) => a.distanceFromRouteMeters <= bufferMeters);
}

export async function fetchRouteAmenities(
  origin: LatLng,
  destination: LatLng,
  bufferMeters = 1000,
  onlyTypes?: RouteAmenity["type"][]
): Promise<RouteAmenity[]> {
  const mid = { latitude: (origin.latitude + destination.latitude) / 2, longitude: (origin.longitude + destination.longitude) / 2 };
  const searchRadius = haversineMeters(origin, destination) / 2 + bufferMeters;

  // 2-at-a-time, not fully serial and not all 4 at once: Overpass's public instance enforces a
  // small concurrent-slot limit per client (commonly 2) — firing all 4 together reliably breaks
  // whichever lands third or later, but running fully one-by-one was a direct cause of amenities
  // visibly lagging behind the rest of the search results. Two batches of 2 in parallel roughly
  // halves the wait while staying inside that known-safe concurrency limit. `onlyTypes` lets a
  // caller request a subset — used to fetch the fast hospital/police/washroom queries separately
  // from the much slower shop-dense "safe_zone" query, so the client can show the fast group
  // immediately instead of waiting on the slowest one.
  const types = (onlyTypes ?? (["washroom", "hospital", "police", "safe_zone"] as const)) as RouteAmenity["type"][];
  const results: RouteAmenity[][] = [];
  for (let i = 0; i < types.length; i += 2) {
    const batch = types.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map((type) => fetchAmenitiesOfType(type, mid, searchRadius, origin, destination, bufferMeters))
    );
    results.push(...batchResults);
  }

  return results.flat().slice(0, 150);
}
