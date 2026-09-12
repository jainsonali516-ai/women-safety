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
