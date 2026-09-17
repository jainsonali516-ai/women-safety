import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { findNearestStation, planMetroJourney } from "@/lib/gtfs/journeyPlanner";
import { departureWindowForStop, secondsSinceMidnight, formatHms } from "@/lib/gtfs/schedule";
import { metroFareForDistance } from "@/lib/fares";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  straightLineKm: z.number().optional(),
});

const WALK_METERS_PER_MIN = 80; // ~4.8 km/h, a realistic brisk-but-safe walking pace

/**
 * A detailed, station-by-station DMRC journey plan from the bundled real GTFS feed — never
 * Metro track geometry on the map (see MetroJourneyPanel.tsx), and never a fabricated route,
 * timing, or fare. Three distinct outcomes, deliberately not collapsed into each other (state A
 * vs B is the whole point of this endpoint):
 *   - "unavailable": the data genuinely shows no connecting service (real answer)
 *   - "unverified":  the GTFS data itself couldn't be loaded/queried (a technical failure)
 *   - a full plan:   everything below was computed from real schedule data
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { origin, destination, straightLineKm } = parsed.data;

  try {
    const originStation = findNearestStation(origin);
    const destStation = findNearestStation(destination);

    if (!originStation || !destStation) {
      return NextResponse.json({
        status: "unavailable",
        reason: "No DMRC station found within walking distance of the origin or destination in this data.",
      });
    }

    if (originStation.stop.id === destStation.stop.id) {
      return NextResponse.json({
        status: "unavailable",
        reason: "Origin and destination are near the same Metro station — Metro won't save time for this trip.",
      });
    }

    const plan = planMetroJourney(originStation.stop.id, destStation.stop.id);
    if (!plan) {
      return NextResponse.json({
        status: "unavailable",
        reason: "No scheduled Metro connection found between these stations in this data.",
      });
    }

    // Last-train-style check against the FIRST leg's real boarding stop — "can this journey be
    // started right now", the practical form of the last-train question for a trip search that
    // doesn't (yet) collect an exact planned departure time.
    const now = new Date();
    const window = departureWindowForStop(originStation.stop.id, plan.legs[0].lineName, now);
    let availability: "available" | "outside_service_hours" | "unverified" = "unverified";
    let nextDepartureNote: string | undefined;
    if (window) {
      const nowSec = secondsSinceMidnight(now);
      availability = nowSec >= window.earliestSec && nowSec <= window.latestSec ? "available" : "outside_service_hours";
      nextDepartureNote = `Scheduled service ${formatHms(window.earliestSec)}–${formatHms(window.latestSec)}`;
    }

    if (availability === "outside_service_hours") {
      return NextResponse.json({
        status: "unavailable",
        reason: "Metro service is not scheduled to be running for this station at this time.",
        detail: nextDepartureNote,
      });
    }

    const originWalkMin = Math.max(1, Math.round(originStation.walkMeters / WALK_METERS_PER_MIN));
    const destWalkMin = Math.max(1, Math.round(destStation.walkMeters / WALK_METERS_PER_MIN));
    const TRANSFER_MINUTES = 4; // a typical labelled interchange-walk estimate, not GTFS-verified
    const transferTotal = plan.interchanges.length * TRANSFER_MINUTES;
    const totalMinutes =
      plan.totalTravelMinutes === null ? null : plan.totalTravelMinutes + originWalkMin + destWalkMin + transferTotal;

    return NextResponse.json({
      status: "ok",
      origin: { name: originStation.stop.name, walkMinutes: originWalkMin, walkMeters: originStation.walkMeters },
      destination: { name: destStation.stop.name, walkMinutes: destWalkMin, walkMeters: destStation.walkMeters },
      legs: plan.legs,
      interchanges: plan.interchanges,
      transferMinutesEach: TRANSFER_MINUTES,
      totalMinutes,
      scheduleNote: plan.scheduleNote,
      availabilityVerified: availability === "available",
      serviceWindowNote: nextDepartureNote,
      // Same distance-slab approximation already shown on the route card (see lib/fares.ts) —
      // this GTFS feed has no fare_attributes/fare_rules data, so it's labelled as an estimate
      // rather than presented as a GTFS-verified fare.
      estimatedFareInr: typeof straightLineKm === "number" ? metroFareForDistance(straightLineKm) : null,
    });
  } catch {
    // The GTFS feed failed to load/parse — a technical failure, never to be read by the UI as
    // "Metro doesn't run here."
    return NextResponse.json({
      status: "unverified",
      reason: "Transit routing data could not be loaded.",
    });
  }
}
