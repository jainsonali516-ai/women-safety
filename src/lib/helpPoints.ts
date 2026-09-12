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
  type: "washroom" | "hospital" | "police";
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

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)",
        Accept: "application/json",
      },
      body: query,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const points: HelpPoint[] = (data.elements ?? [])
      .map((el: { tags?: Record<string, string>; lat: number; lon: number }) => {
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
  } catch {
    return [];
  }
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
const AMENITY_OVERPASS_TAG: Record<RouteAmenity["type"], string> = {
  washroom: "toilets",
  hospital: "hospital",
  police: "police",
};

async function fetchAmenitiesOfType(
  type: RouteAmenity["type"],
  mid: LatLng,
  searchRadius: number,
  origin: LatLng,
  destination: LatLng,
  bufferMeters: number
): Promise<RouteAmenity[]> {
  // One lightweight query per amenity type — combining all 3 types (plus a high result cap)
  // into a single query reliably timed out (504) under load on Overpass's shared public server;
  // three small parallel queries succeed far more often, same lesson as the other Overpass
  // calls in this app (see fetchStreetLightDensity/fetchFootTrafficScore in scoring.ts).
  const query = `
    [out:json][timeout:12];
    node["amenity"="${AMENITY_OVERPASS_TAG[type]}"](around:${searchRadius},${mid.latitude},${mid.longitude});
    out body 60;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)",
        Accept: "application/json",
      },
      body: query,
      signal: AbortSignal.timeout(13000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.elements ?? [])
      .map((el: { tags?: Record<string, string>; lat: number; lon: number }): RouteAmenity => {
        const tags = el.tags ?? {};
        const point = { latitude: el.lat, longitude: el.lon };
        return {
          name: tags.name ?? (type === "washroom" ? "Public Washroom" : type === "hospital" ? "Hospital" : "Police Station"),
          type,
          latitude: el.lat,
          longitude: el.lon,
          distanceFromRouteMeters: Math.round(distanceToSegmentMeters(point, origin, destination)),
        };
      })
      .filter((a: RouteAmenity) => a.distanceFromRouteMeters <= bufferMeters);
  } catch {
    return [];
  }
}

export async function fetchRouteAmenities(origin: LatLng, destination: LatLng, bufferMeters = 1000): Promise<RouteAmenity[]> {
  const mid = { latitude: (origin.latitude + destination.latitude) / 2, longitude: (origin.longitude + destination.longitude) / 2 };
  const searchRadius = haversineMeters(origin, destination) / 2 + bufferMeters;

  // Sequential, not Promise.all: Overpass's public instance enforces a small concurrent-slot
  // limit per client (commonly 2), so firing all 3 amenity-type queries at once reliably breaks
  // whichever one lands third.
  const results: RouteAmenity[][] = [];
  for (const type of ["washroom", "hospital", "police"] as const) {
    results.push(await fetchAmenitiesOfType(type, mid, searchRadius, origin, destination, bufferMeters));
  }

  return results.flat().slice(0, 150);
}
