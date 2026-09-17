import fs from "node:fs";
import path from "node:path";
import type { GtfsData, GtfsStop, GtfsRoute, GtfsTrip, GtfsStopTime, GtfsCalendar } from "./types";

const GTFS_DIR = path.join(process.cwd(), "data", "gtfs", "dmrc");

/** Minimal RFC4180-ish CSV line parser — handles quoted fields with embedded commas, which
 * GTFS's spec allows even though this particular DMRC export doesn't currently use them. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function readCsv(fileName: string): Record<string, string>[] {
  const filePath = path.join(GTFS_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function timeToSeconds(hms: string): number {
  // GTFS times can exceed 24:00:00 for trips past midnight — that's intentional, not a bug.
  const [h, m, s] = hms.split(":").map((n) => parseInt(n, 10));
  return h * 3600 + m * 60 + s;
}

// route_long_name looks like "YELLOW_Huda City Centre to Qutab Minar" — the line name is DMRC's
// own data, not a guess or a derived color code.
function lineNameFromLongName(longName: string): string {
  return longName.split("_")[0]?.trim().toUpperCase() ?? "UNKNOWN";
}

let cached: GtfsData | null = null;
let loadError: Error | null = null;

/**
 * Loads and indexes the real DMRC GTFS static feed (see data/gtfs/dmrc/ and the accompanying
 * note on where it came from). Parsed once per server process and cached in memory — the same
 * pattern as overpassCache.ts, just for a static bundled dataset instead of a live API.
 * Throws (caught by the caller) rather than silently returning empty data on a read/parse
 * failure — callers must treat that as "temporarily unavailable," never as "no Metro service"
 * (see metroJourney.ts state A vs state B).
 */
export function loadGtfs(): GtfsData {
  if (cached) return cached;
  if (loadError) throw loadError;

  try {
    const stops = new Map<string, GtfsStop>();
    for (const r of readCsv("stops.txt")) {
      stops.set(r.stop_id, { id: r.stop_id, name: r.stop_name, lat: parseFloat(r.stop_lat), lon: parseFloat(r.stop_lon) });
    }

    const routes = new Map<string, GtfsRoute>();
    for (const r of readCsv("routes.txt")) {
      routes.set(r.route_id, {
        id: r.route_id,
        shortName: r.route_short_name,
        longName: r.route_long_name,
        lineName: lineNameFromLongName(r.route_long_name),
      });
    }

    const trips = new Map<string, GtfsTrip>();
    const tripIdsByRoute = new Map<string, string[]>();
    for (const r of readCsv("trips.txt")) {
      trips.set(r.trip_id, { id: r.trip_id, routeId: r.route_id, serviceId: r.service_id });
      const list = tripIdsByRoute.get(r.route_id) ?? [];
      list.push(r.trip_id);
      tripIdsByRoute.set(r.route_id, list);
    }

    const stopTimesByTrip = new Map<string, GtfsStopTime[]>();
    for (const r of readCsv("stop_times.txt")) {
      const distTraveled = parseFloat(r.shape_dist_traveled);
      const entry: GtfsStopTime = {
        tripId: r.trip_id,
        stopId: r.stop_id,
        sequence: parseInt(r.stop_sequence, 10),
        arrivalSec: timeToSeconds(r.arrival_time),
        departureSec: timeToSeconds(r.departure_time),
        distTraveledMeters: Number.isFinite(distTraveled) ? distTraveled : null,
      };
      const list = stopTimesByTrip.get(r.trip_id) ?? [];
      list.push(entry);
      stopTimesByTrip.set(r.trip_id, list);
    }
    for (const list of stopTimesByTrip.values()) list.sort((a, b) => a.sequence - b.sequence);

    const calendar = new Map<string, GtfsCalendar>();
    for (const r of readCsv("calendar.txt")) {
      calendar.set(r.service_id, {
        serviceId: r.service_id,
        days: [r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday].map((v) => v === "1") as GtfsCalendar["days"],
      });
    }

    const stopsOnLine = new Map<string, Set<string>>();
    const routeIdsForLine = new Map<string, string[]>();
    for (const route of routes.values()) {
      const routeList = routeIdsForLine.get(route.lineName) ?? [];
      routeList.push(route.id);
      routeIdsForLine.set(route.lineName, routeList);

      const stopSet = stopsOnLine.get(route.lineName) ?? new Set<string>();
      for (const tripId of tripIdsByRoute.get(route.id) ?? []) {
        for (const st of stopTimesByTrip.get(tripId) ?? []) stopSet.add(st.stopId);
      }
      stopsOnLine.set(route.lineName, stopSet);
    }

    cached = {
      stops,
      routes,
      trips,
      stopTimesByTrip,
      tripIdsByRoute,
      calendar,
      lineNames: Array.from(routeIdsForLine.keys()),
      stopsOnLine,
      routeIdsForLine,
    };
    return cached;
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err));
    throw loadError;
  }
}
