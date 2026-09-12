interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Real driving distance/duration via OSRM's free public demo routing server — no API key.
 * Note: this is typical-traffic routing, not live congestion-aware traffic (OSRM's public
 * demo server doesn't offer that). Rush-hour scoring falls back to a time-of-day heuristic
 * instead of a live delay ratio — see src/lib/peakHours.ts.
 */
export async function fetchDrivingRoute(origin: LatLng, destination: LatLng) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    return {
      distanceMeters: route.distance as number,
      durationSeconds: route.duration as number,
    };
  } catch {
    return null;
  }
}
