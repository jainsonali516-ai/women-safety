import { loadGtfs } from "./load";
import type { GtfsData, GtfsStop } from "./types";

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface NearestStationResult {
  stop: GtfsStop;
  walkMeters: number;
}

function haversineMeters(a: LatLng, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180;
  const dLng = ((b.lon - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Nearest real DMRC station to a point, from the bundled GTFS stops.txt — no Overpass/network
 * dependency, so this works even when OSM's live services are down. Null only if radiusMeters
 * genuinely has nothing in it (real "not near a station"), which callers must not confuse with
 * a data-loading failure (see planMetroJourney's state A/B distinction). */
export function findNearestStation(point: LatLng, radiusMeters = 2000): NearestStationResult | null {
  const gtfs = loadGtfs();
  let best: NearestStationResult | null = null;
  for (const stop of gtfs.stops.values()) {
    const d = haversineMeters(point, stop);
    if (d <= radiusMeters && (!best || d < best.walkMeters)) best = { stop, walkMeters: Math.round(d) };
  }
  return best;
}

interface RouteStopSequence {
  routeId: string;
  lineName: string;
  stopOrder: Map<string, { sequence: number; arrivalSec: number; departureSec: number }>;
}

/** The single most complete trip on a route (most stops) stands in for "the route's real station
 * list" — DMRC's GTFS has many near-duplicate trips per route (different times of day), and they
 * share the same stopping pattern for the route's main run. */
function representativeSequenceForRoute(gtfs: GtfsData, routeId: string): RouteStopSequence | null {
  const tripIds = gtfs.tripIdsByRoute.get(routeId) ?? [];
  let bestTripId: string | null = null;
  let bestLen = 0;
  for (const tripId of tripIds) {
    const len = gtfs.stopTimesByTrip.get(tripId)?.length ?? 0;
    if (len > bestLen) {
      bestLen = len;
      bestTripId = tripId;
    }
  }
  if (!bestTripId) return null;
  const stopTimes = gtfs.stopTimesByTrip.get(bestTripId)!;
  const stopOrder = new Map<string, { sequence: number; arrivalSec: number; departureSec: number }>();
  for (const st of stopTimes) stopOrder.set(st.stopId, { sequence: st.sequence, arrivalSec: st.arrivalSec, departureSec: st.departureSec });
  const route = gtfs.routes.get(routeId)!;
  return { routeId, lineName: route.lineName, stopOrder };
}

export interface JourneyLeg {
  lineName: string;
  boardStopName: string;
  alightStopName: string;
  stationCount: number;
  travelMinutes: number | null;
}

export interface MetroJourneyPlan {
  originStation: { name: string; walkMeters: number };
  destStation: { name: string; walkMeters: number };
  legs: JourneyLeg[];
  interchanges: { stationName: string; fromLine: string; toLine: string }[];
  totalTravelMinutes: number | null;
  scheduleNote: string;
}

/** A leg on a single line between two of that line's stops, using one of the line's route_ids
 * whose representative trip actually covers both stops in the correct (forward) direction. Null
 * when the line's data doesn't have a single trip spanning that exact pair (rare — usually only
 * for short-turning route_id variants) — the caller then can't state an exact duration for that
 * leg and must say so rather than guessing. */
function buildLeg(gtfs: GtfsData, lineName: string, fromStopId: string, toStopId: string): JourneyLeg | null {
  const routeIds = gtfs.routeIdsForLine.get(lineName) ?? [];
  for (const routeId of routeIds) {
    const seq = representativeSequenceForRoute(gtfs, routeId);
    if (!seq) continue;
    const from = seq.stopOrder.get(fromStopId);
    const to = seq.stopOrder.get(toStopId);
    if (!from || !to || from.sequence >= to.sequence) continue;
    return {
      lineName,
      boardStopName: gtfs.stops.get(fromStopId)?.name ?? fromStopId,
      alightStopName: gtfs.stops.get(toStopId)?.name ?? toStopId,
      stationCount: to.sequence - from.sequence,
      travelMinutes: Math.round((to.arrivalSec - from.departureSec) / 60),
    };
  }
  // Both stops ARE on this line (that's why buildLeg was called), just not covered by one
  // real trip's exact span in this feed — still real, just can't time it precisely.
  return {
    lineName,
    boardStopName: gtfs.stops.get(fromStopId)?.name ?? fromStopId,
    alightStopName: gtfs.stops.get(toStopId)?.name ?? toStopId,
    stationCount: 0,
    travelMinutes: null,
  };
}

/** BFS over lines as graph nodes (edges = a shared station between two lines), up to 2
 * interchanges — covers direct journeys and the common 1-2 transfer cases without needing a full
 * OpenTripPlanner-style itinerary engine. Returns the station-sequence of lines to ride, or null
 * if no path is found within that hop limit. */
function findLinePath(gtfs: GtfsData, originLines: string[], destLines: string[]): string[] | null {
  const directShared = originLines.find((l) => destLines.includes(l));
  if (directShared) return [directShared];

  const maxHops = 3; // supports up to 2 interchanges
  let frontier: { line: string; path: string[] }[] = originLines.map((l) => ({ line: l, path: [l] }));
  const visited = new Set(originLines);

  for (let hop = 1; hop < maxHops; hop++) {
    const next: { line: string; path: string[] }[] = [];
    for (const { line, path } of frontier) {
      const stopsA = gtfs.stopsOnLine.get(line);
      if (!stopsA) continue;
      for (const candidateLine of gtfs.lineNames) {
        if (visited.has(candidateLine)) continue;
        const stopsB = gtfs.stopsOnLine.get(candidateLine);
        if (!stopsB) continue;
        const shares = [...stopsA].some((s) => stopsB.has(s));
        if (!shares) continue;
        const newPath = [...path, candidateLine];
        if (destLines.includes(candidateLine)) return newPath;
        visited.add(candidateLine);
        next.push({ line: candidateLine, path: newPath });
      }
    }
    frontier = next;
  }
  return null;
}

function findInterchangeStop(gtfs: GtfsData, lineA: string, lineB: string): string | null {
  const stopsA = gtfs.stopsOnLine.get(lineA);
  const stopsB = gtfs.stopsOnLine.get(lineB);
  if (!stopsA || !stopsB) return null;
  for (const s of stopsA) if (stopsB.has(s)) return s;
  return null;
}

/**
 * Real DMRC journey plan between two stations, using only the bundled GTFS data — never a
 * fabricated route. Returns null when the two stations genuinely share no connecting line within
 * the hop limit (a real "not connected in this data" answer, distinct from a data-loading
 * failure, which callers must handle separately — see the API route for the state A/B split).
 */
export function planMetroJourney(originStopId: string, destStopId: string): Omit<MetroJourneyPlan, "originStation" | "destStation"> | null {
  const gtfs = loadGtfs();
  const originLines = [...gtfs.lineNames].filter((l) => gtfs.stopsOnLine.get(l)?.has(originStopId));
  const destLines = [...gtfs.lineNames].filter((l) => gtfs.stopsOnLine.get(l)?.has(destStopId));
  if (originLines.length === 0 || destLines.length === 0) return null;

  const linePath = findLinePath(gtfs, originLines, destLines);
  if (!linePath) return null;

  const legs: JourneyLeg[] = [];
  const interchanges: MetroJourneyPlan["interchanges"] = [];
  let boardStop = originStopId;

  for (let i = 0; i < linePath.length; i++) {
    const line = linePath[i];
    const isLast = i === linePath.length - 1;
    const alightStop = isLast ? destStopId : findInterchangeStop(gtfs, line, linePath[i + 1]);
    if (!alightStop) return null; // shouldn't happen given findLinePath already verified a share

    const leg = buildLeg(gtfs, line, boardStop, alightStop);
    if (!leg) return null;
    legs.push(leg);

    if (!isLast) {
      interchanges.push({ stationName: leg.alightStopName, fromLine: line, toLine: linePath[i + 1] });
    }
    boardStop = alightStop;
  }

  const anyUnknown = legs.some((l) => l.travelMinutes === null);
  const totalTravelMinutes = anyUnknown ? null : legs.reduce((sum, l) => sum + (l.travelMinutes ?? 0), 0);

  return {
    legs,
    interchanges,
    totalTravelMinutes,
    scheduleNote: "Scheduled Metro information (static DMRC timetable, not a live feed)",
  };
}
