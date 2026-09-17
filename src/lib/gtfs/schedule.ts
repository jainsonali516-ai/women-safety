import { loadGtfs } from "./load";
import type { GtfsData } from "./types";

/** service_ids that run on a given date's day-of-week, per calendar.txt's weekly pattern.
 * Deliberately ignores calendar.txt's start_date/end_date bounds — this DMRC export's date range
 * has already lapsed (last updated Aug 2023), but the *weekly* weekday/Saturday/Sunday service
 * pattern is what's actually being relied on here, not the exact date window, and Metro's weekly
 * pattern doesn't change often. Labelled as "scheduled" (not live) everywhere this is surfaced. */
function activeServiceIds(gtfs: GtfsData, date: Date): string[] {
  const dayIndex = (date.getDay() + 6) % 7; // getDay(): 0=Sun..6=Sat -> convert to 0=Mon..6=Sun
  const ids: string[] = [];
  for (const cal of gtfs.calendar.values()) {
    if (cal.days[dayIndex]) ids.push(cal.serviceId);
  }
  return ids;
}

export interface DepartureWindow {
  earliestSec: number;
  latestSec: number;
  count: number;
}

/** The real range of scheduled departures from a stop, across every trip that actually stops
 * there on the given date's service pattern. Null when the feed simply has no departures from
 * this stop on this line at all (distinct from "none found because nothing was checked"). */
export function departureWindowForStop(stopId: string, lineName: string, date: Date): DepartureWindow | null {
  const gtfs = loadGtfs();
  const serviceIds = new Set(activeServiceIds(gtfs, date));
  const routeIds = new Set(gtfs.routeIdsForLine.get(lineName) ?? []);

  let earliestSec = Infinity;
  let latestSec = -Infinity;
  let count = 0;

  for (const [tripId, trip] of gtfs.trips) {
    if (!routeIds.has(trip.routeId) || !serviceIds.has(trip.serviceId)) continue;
    const stopTimes = gtfs.stopTimesByTrip.get(tripId);
    if (!stopTimes) continue;
    const st = stopTimes.find((s) => s.stopId === stopId);
    if (!st) continue;
    count++;
    if (st.departureSec < earliestSec) earliestSec = st.departureSec;
    if (st.departureSec > latestSec) latestSec = st.departureSec;
  }

  if (count === 0) return null;
  return { earliestSec, latestSec, count };
}

export function secondsSinceMidnight(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

export function formatHms(totalSec: number): string {
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
