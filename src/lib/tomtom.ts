interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LiveTraffic {
  /** Real, live-traffic-aware travel time for this exact route right now. */
  travelTimeSeconds: number;
  /** What the same route would take with no traffic at all — the free-flow baseline. */
  noTrafficTravelTimeSeconds: number;
  /** travelTimeSeconds - noTrafficTravelTimeSeconds — how much longer this trip is taking right
   * now than a completely clear road, from ALL current congestion (not just incidents like
   * accidents/closures — TomTom's own `trafficDelayInSeconds` only counts the latter, which
   * tested as misleadingly "0, roads flowing freely" on a route whose duration was still a real
   * 22% slower than free-flow from ordinary daily traffic). This is the number that actually
   * matches the congestion ratio used for duration estimates below. */
  delaySeconds: number;
  /** travelTimeSeconds / noTrafficTravelTimeSeconds — a real congestion ratio for this route
   * right now (e.g. 1.29 = 29% slower than free-flow), used in place of the old fixed "1.35x
   * during peak hours" guess. */
  congestionRatio: number;
}

/**
 * Live-traffic-aware road travel time from TomTom's Routing API, for a specific origin→destination
 * right now — a real replacement for the time-of-day rush-hour guess in lib/scoring.ts. Returns
 * null on any failure (missing key, network error, non-OK response) so callers fall back to the
 * existing heuristic rather than breaking route planning over an optional traffic enhancement.
 */
export async function fetchLiveTraffic(origin: LatLng, destination: LatLng): Promise<LiveTraffic | null> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      key: apiKey,
      traffic: "true",
      computeTravelTimeFor: "all",
    });
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}/json?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json();
    const summary = data?.routes?.[0]?.summary;
    if (!summary || typeof summary.travelTimeInSeconds !== "number" || typeof summary.noTrafficTravelTimeInSeconds !== "number") {
      return null;
    }
    if (summary.noTrafficTravelTimeInSeconds <= 0) return null;

    return {
      travelTimeSeconds: summary.travelTimeInSeconds,
      noTrafficTravelTimeSeconds: summary.noTrafficTravelTimeInSeconds,
      delaySeconds: Math.max(0, summary.travelTimeInSeconds - summary.noTrafficTravelTimeInSeconds),
      congestionRatio: summary.travelTimeInSeconds / summary.noTrafficTravelTimeInSeconds,
    };
  } catch {
    return null;
  }
}
