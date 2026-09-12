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
