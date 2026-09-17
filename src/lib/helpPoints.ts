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

export type AmenityType =
  | "washroom"
  | "hospital"
  | "police"
  | "restaurant"
  | "safe_zone"
  | "fuel"
  | "atm"
  | "metro_station"
  | "bus_stop";

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
 * Perpendicular distance (meters) from a point to the nearest segment of a multi-point path —
 * generalizes distanceToSegmentMeters from a single origin→destination line to any real polyline
 * (a road route's actual turns, or a walk→station→station→walk transit path), so "near the
 * route" means near the real path, not near an as-the-crow-flies line between the endpoints.
 */
function distanceToPathMeters(point: LatLng, path: LatLng[]) {
  if (path.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegmentMeters(point, path[i], path[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// "restaurant" and "safe_zone" used to be one combined category (pharmacy+restaurant+cafe+mall
// in a single query) — split apart because bundling them meant restaurants/cafes disappeared
// whenever the heavier combined query (more tags to match, denser results in commercial areas)
// timed out, even though a plain hospital/police-sized query would have succeeded fine.
// `locationClause` is Overpass's "around a point" or "within a bounding box" filter — the tag
// matching is identical either way, only where to look differs.
// A "query group" is one Overpass request that may resolve to more than one AmenityType — e.g.
// fuel stations and ATMs are cheap, similarly-tagged node queries, so they're fetched together
// as one request and split back into their real types afterward by inspecting each result's own
// tags. This keeps the total number of sequential Overpass calls down (see fetchAmenitiesAlongPath
// for why sequential, not parallel, is load-bearing here) while still surfacing every category
// distinctly on the map.
interface AmenityQueryGroup {
  types: AmenityType[];
  clause: (locationClause: string) => string;
  resolveType: (tags: Record<string, string>) => AmenityType | null;
}

const AMENITY_QUERY_GROUPS: Record<string, AmenityQueryGroup> = {
  washroom: {
    types: ["washroom"],
    clause: (loc) => `node["amenity"="toilets"]${loc};`,
    resolveType: () => "washroom",
  },
  hospital: {
    types: ["hospital"],
    clause: (loc) => `node["amenity"="hospital"]${loc};`,
    resolveType: () => "hospital",
  },
  police: {
    types: ["police"],
    clause: (loc) => `node["amenity"="police"]${loc};`,
    resolveType: () => "police",
  },
  restaurant: {
    types: ["restaurant"],
    clause: (loc) => `node["amenity"~"restaurant|cafe|fast_food"]${loc};`,
    resolveType: () => "restaurant",
  },
  safe_zone: {
    types: ["safe_zone"],
    clause: (loc) => `node["amenity"="pharmacy"]${loc};\n    node["shop"="mall"]${loc};`,
    resolveType: () => "safe_zone",
  },
  fuel_atm: {
    types: ["fuel", "atm"],
    clause: (loc) => `node["amenity"~"fuel|atm"]${loc};`,
    resolveType: (tags) => (tags.amenity === "fuel" ? "fuel" : tags.amenity === "atm" ? "atm" : null),
  },
  transit_stop: {
    types: ["metro_station", "bus_stop"],
    clause: (loc) => `node["railway"="station"]["station"="subway"]${loc};\n    node["highway"="bus_stop"]${loc};`,
    resolveType: (tags) => (tags.railway === "station" ? "metro_station" : tags.highway === "bus_stop" ? "bus_stop" : null),
  },
};

// Overpass bbox order is (south,west,north,east) — easy to get backwards, hence the named clause.
function overpassBboxFilterFor(group: AmenityQueryGroup, bounds: ViewportBounds): string {
  return group.clause(`(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`);
}

const EARTH_RADIUS_M = 6371000;
function metersToLatDegrees(m: number) {
  return (m / EARTH_RADIUS_M) * (180 / Math.PI);
}
function metersToLngDegrees(m: number, atLatDeg: number) {
  return (m / (EARTH_RADIUS_M * Math.cos((atLatDeg * Math.PI) / 180))) * (180 / Math.PI);
}

/**
 * A tight bounding box around a path's own extent, padded by `bufferMeters` — NOT a circle sized
 * to the whole path length. That was the actual bug behind amenities failing to show on longer
 * routes: a circle wide enough to reach a route's endpoints from its midpoint has area that grows
 * with the SQUARE of route length, which made Overpass queries slow enough to reliably time out.
 * A bbox around the path's real footprint scales LINEARLY with length instead — far less area to
 * search for the same eventual radius-of-the-route result, since the perpendicular-distance
 * filter still trims to the real corridor either way.
 */
function pathBoundingBox(path: LatLng[], bufferMeters: number): ViewportBounds {
  const lats = path.map((p) => p.latitude);
  const lngs = path.map((p) => p.longitude);
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const latPad = metersToLatDegrees(bufferMeters);
  const lngPad = metersToLngDegrees(bufferMeters, midLat);
  return {
    north: Math.max(...lats) + latPad,
    south: Math.min(...lats) - latPad,
    east: Math.max(...lngs) + lngPad,
    west: Math.min(...lngs) - lngPad,
  };
}

function defaultNameFor(type: AmenityType): string {
  if (type === "washroom") return "Public Washroom";
  if (type === "hospital") return "Hospital";
  if (type === "police") return "Police Station";
  if (type === "restaurant") return "Restaurant / Cafe";
  if (type === "fuel") return "Petrol Pump";
  if (type === "atm") return "ATM";
  if (type === "metro_station") return "Metro Station";
  if (type === "bus_stop") return "Bus Stop";
  return "Pharmacy / Mall";
}

async function fetchAmenityGroup(
  group: AmenityQueryGroup,
  bounds: ViewportBounds,
  path: LatLng[],
  bufferMeters: number
): Promise<RouteAmenity[]> {
  // One lightweight query per group — combining every category into one request (plus a high
  // result cap) reliably timed out (504) under load on Overpass's shared public server; several
  // small queries succeed far more often, same lesson as the other Overpass calls in this app
  // (see fetchStreetLightDensity/fetchFootTrafficScore in scoring.ts). A smaller result cap (was
  // 60) also means less for Overpass to compute/transfer and less for us to parse — the map only
  // ever shows a handful of nearby markers per type anyway.
  const query = `
    [out:json][timeout:12];
    (${overpassBboxFilterFor(group, bounds)});
    out body 35;
  `;

  const data = await queryOverpass(query);
  if (!data) return [];

  return (data.elements as { tags?: Record<string, string>; lat: number; lon: number }[])
    .map((el): RouteAmenity | null => {
      const tags = el.tags ?? {};
      const type = group.resolveType(tags);
      if (!type) return null;
      const point = { latitude: el.lat, longitude: el.lon };
      return {
        name: tags.name ?? defaultNameFor(type),
        type,
        latitude: el.lat,
        longitude: el.lon,
        distanceFromRouteMeters: Math.round(distanceToPathMeters(point, path)),
      };
    })
    .filter((a): a is RouteAmenity => a !== null && a.distanceFromRouteMeters <= bufferMeters);
}

// Raw OpenStreetMap data sometimes has two separate nodes for the same real-world place — an old
// entry never merged with a newer one, or two contributors independently mapping the same police
// post/hospital entrance a few meters apart. Overpass returns both as distinct, valid nodes, so
// without this the map would show two pins essentially stacked on top of each other for what a
// user sees as one place. Collapses same-type points within 40m of each other down to one.
function dedupeNearby(amenities: RouteAmenity[], thresholdMeters = 40): RouteAmenity[] {
  const kept: RouteAmenity[] = [];
  for (const amenity of amenities) {
    const isDuplicate = kept.some((k) => k.type === amenity.type && haversineMeters(amenity, k) < thresholdMeters);
    if (!isDuplicate) kept.push(amenity);
  }
  return kept;
}

const DEFAULT_AMENITY_TYPES: AmenityType[] = ["washroom", "hospital", "police", "restaurant", "safe_zone"];

/**
 * Amenities near a real path — the actual road-route polyline, or a walk→station→station→walk
 * transit path — rather than just an origin/destination pair. Falls back to a straight
 * origin→destination line when only two points are given (e.g. no live road geometry was
 * available), same as before.
 */
export async function fetchAmenitiesAlongPath(path: LatLng[], bufferMeters = 1000, onlyTypes?: AmenityType[]): Promise<RouteAmenity[]> {
  if (path.length < 2) return [];
  const bounds = pathBoundingBox(path, bufferMeters);

  const wantedTypes = onlyTypes ?? DEFAULT_AMENITY_TYPES;
  // Each query group may serve more than one requested type (see AMENITY_QUERY_GROUPS) — only
  // run a group once even if the caller asked for both of its types.
  const groups = Object.values(AMENITY_QUERY_GROUPS).filter((g) => g.types.some((t) => wantedTypes.includes(t)));

  // Fully sequential — this was briefly changed to 2-at-a-time to cut latency, but real-world
  // testing showed that pairing two queries in parallel made them *both* unreliable (one
  // request finished fine while the paired one silently came back empty, then the pattern
  // flipped on the next search) rather than saving much real time — Overpass's shared public
  // server's safe concurrency margin is apparently thinner than "2" in practice. For a safety
  // app, an amenity category randomly vanishing is worse than the extra second or two this costs.
  const results: RouteAmenity[][] = [];
  for (const group of groups) {
    results.push(await fetchAmenityGroup(group, bounds, path, bufferMeters));
  }

  const merged = results.flat().filter((a) => wantedTypes.includes(a.type));
  return dedupeNearby(merged).slice(0, 150);
}

/** Convenience wrapper for the common two-point (origin, destination) case. */
export async function fetchRouteAmenities(
  origin: LatLng,
  destination: LatLng,
  bufferMeters = 1000,
  onlyTypes?: AmenityType[]
): Promise<RouteAmenity[]> {
  return fetchAmenitiesAlongPath([origin, destination], bufferMeters, onlyTypes);
}
