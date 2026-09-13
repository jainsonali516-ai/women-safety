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

export type AmenityType = "washroom" | "hospital" | "police" | "safe_zone";

export interface AmenityPoint {
  name: string;
  type: AmenityType;
  latitude: number;
  longitude: number;
}

export interface RouteAmenity extends AmenityPoint {
  distanceFromRouteMeters: number;
}

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
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
// `locationClause` is Overpass's "around a point" or "within a bounding box" filter — the tag
// matching is identical either way, only where to look differs.
function amenityQueryFor(type: AmenityType, locationClause: string): string {
  if (type === "washroom") return `node["amenity"="toilets"]${locationClause};`;
  if (type === "hospital") return `node["amenity"="hospital"]${locationClause};`;
  if (type === "police") return `node["amenity"="police"]${locationClause};`;
  return `
    node["amenity"~"pharmacy|restaurant|cafe"]${locationClause};
    node["shop"="mall"]${locationClause};
  `;
}

// Overpass bbox order is (south,west,north,east) — easy to get backwards, hence the named clause.
function overpassBboxFilterFor(type: AmenityType, bounds: ViewportBounds): string {
  return amenityQueryFor(type, `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`);
}

const EARTH_RADIUS_M = 6371000;
function metersToLatDegrees(m: number) {
  return (m / EARTH_RADIUS_M) * (180 / Math.PI);
}
function metersToLngDegrees(m: number, atLatDeg: number) {
  return (m / (EARTH_RADIUS_M * Math.cos((atLatDeg * Math.PI) / 180))) * (180 / Math.PI);
}

/**
 * A tight bounding box around the route's own extent, padded by `bufferMeters` — NOT a circle
 * around the midpoint sized to the whole route length. That was the actual bug behind amenities
 * failing to show on longer routes: a circle wide enough to reach a route's endpoints from its
 * midpoint has area that grows with the SQUARE of route length (an 18km-radius circle for a
 * 35km route is ~1075 km², almost all of it nowhere near the actual path), which made Overpass
 * queries slow enough to reliably time out. A bbox around the route's real footprint scales
 * LINEARLY with route length instead (a 35km x ~2km corridor is ~70 km²) — over 15x less area
 * for Overpass to search, for the exact same eventual radius-1km-of-the-route result, since the
 * perpendicular-distance filter below still trims to the real corridor either way.
 */
function routeBoundingBox(origin: LatLng, destination: LatLng, bufferMeters: number): ViewportBounds {
  const midLat = (origin.latitude + destination.latitude) / 2;
  const latPad = metersToLatDegrees(bufferMeters);
  const lngPad = metersToLngDegrees(bufferMeters, midLat);
  return {
    north: Math.max(origin.latitude, destination.latitude) + latPad,
    south: Math.min(origin.latitude, destination.latitude) - latPad,
    east: Math.max(origin.longitude, destination.longitude) + lngPad,
    west: Math.min(origin.longitude, destination.longitude) - lngPad,
  };
}

function defaultNameFor(type: AmenityType): string {
  if (type === "washroom") return "Public Washroom";
  if (type === "hospital") return "Hospital";
  if (type === "police") return "Police Station";
  return "Nearby Safe Zone";
}

async function fetchAmenitiesOfType(
  type: AmenityType,
  bounds: ViewportBounds,
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
    (${overpassBboxFilterFor(type, bounds)});
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
  onlyTypes?: AmenityType[]
): Promise<RouteAmenity[]> {
  const bounds = routeBoundingBox(origin, destination, bufferMeters);

  // Fully sequential — this was briefly changed to 2-at-a-time to cut latency, but real-world
  // testing showed that pairing two queries in parallel made them *both* unreliable (one
  // request finished fine while the paired one silently came back empty, then the pattern
  // flipped on the next search) rather than saving much real time — Overpass's shared public
  // server's safe concurrency margin is apparently thinner than "2" in practice. For a safety
  // app, an amenity category randomly vanishing is worse than the extra second or two this
  // costs. `onlyTypes` lets a caller request a subset — used to fetch the fast hospital/police/
  // washroom queries as one client request, separate from the much slower shop-dense
  // "safe_zone" query, so that group can appear on the map without waiting on the slowest one.
  const types = (onlyTypes ?? (["washroom", "hospital", "police", "safe_zone"] as const)) as AmenityType[];
  const results: RouteAmenity[][] = [];
  for (const type of types) {
    results.push(await fetchAmenitiesOfType(type, bounds, origin, destination, bufferMeters));
  }

  return results.flat().slice(0, 150);
}

// Above this span (roughly 6-7km at Delhi's latitude), a bbox query has to scan too much ground
// to stay fast, and a fully-zoomed-out map would return an unusably dense pile of pins anyway —
// better to ask the user to zoom in than to make Overpass (and the map) do that much work.
const MAX_VIEWPORT_SPAN_DEGREES = 0.06;

/**
 * Amenities anywhere inside the map's current visible bounds, for free pan/zoom exploration —
 * unlike fetchRouteAmenities, these aren't relative to a route (no distanceFromRouteMeters), just
 * "what's here." Same sequential-per-type Overpass calling pattern as fetchRouteAmenities, for
 * the same reliability reason.
 */
export async function fetchAmenitiesInViewport(
  bounds: ViewportBounds,
  types: AmenityType[]
): Promise<{ amenities: AmenityPoint[]; areaTooLarge: boolean }> {
  const spanLat = bounds.north - bounds.south;
  const spanLng = bounds.east - bounds.west;
  if (spanLat > MAX_VIEWPORT_SPAN_DEGREES || spanLng > MAX_VIEWPORT_SPAN_DEGREES) {
    return { amenities: [], areaTooLarge: true };
  }

  const results: AmenityPoint[][] = [];
  for (const type of types) {
    const query = `
      [out:json][timeout:6];
      (${overpassBboxFilterFor(type, bounds)});
      out body 60;
    `;
    // Fail fast, no mirror retry: this is free-exploration browsing, not a safety score input —
    // 3 sequential types x up to 2 mirrors x ~10s each could make toggling this on hang for
    // close to a minute in the worst case (real reports of exactly that). Missing a category
    // occasionally is an acceptable trade for this feature staying responsive.
    const data = await queryOverpass(query, 6000, false);
    if (!data) continue;

    results.push(
      (data.elements as { tags?: Record<string, string>; lat: number; lon: number }[]).map(
        (el): AmenityPoint => ({
          name: el.tags?.name ?? defaultNameFor(type),
          type,
          latitude: el.lat,
          longitude: el.lon,
        })
      )
    );
  }

  return { amenities: results.flat().slice(0, 300), areaTooLarge: false };
}
