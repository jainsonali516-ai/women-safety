import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import {
  computeFinalScore,
  computeHeuristicRushScore,
  computeSafetyScore,
  fetchFootTrafficScore,
  fetchStreetLightDensity,
  isAfterSunset,
} from "@/lib/scoring";
import { fetchDrivingRoute } from "@/lib/routing";
import { buildOlaLinks, buildUberLinks } from "@/lib/rideDeepLinks";
import { busFareForDistance, eRickshawFareForDistance, metroFareForDistance } from "@/lib/fares";
import { classifyRiskTier, explainCost, explainSafety, explainSpeed } from "@/lib/riskTier";
import { findNearestStation, planMetroJourney } from "@/lib/gtfs/journeyPlanner";
import { metroLineColor } from "@/lib/metroLineColors";

const ALL_MODES = ["metro", "bus", "e_rickshaw", "auto", "cab_uber", "cab_ola"] as const;

const bodySchema = z.object({
  // Full Nominatim addresses (e.g. "Kashmiri Gate, Lothiyan Road, Kashmere Gate, Sadar Bazaar, ...")
  // routinely exceed 120 chars, so allow generous headroom rather than rejecting real places.
  origin: coordinateSchema.extend({ label: z.string().trim().max(300).optional() }),
  destination: coordinateSchema.extend({ label: z.string().trim().max(300).optional() }),
  sort: z.enum(["balanced", "safest", "fastest", "cheapest"]).default("balanced"),
  modes: z.array(z.enum(ALL_MODES)).min(1).optional(),
  concession: z.boolean().default(true),
});

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function midpoint(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { origin, destination, sort, modes, concession } = parsed.data;
  const allowedModes = new Set(modes ?? ALL_MODES);
  const straightLineKm = haversineKm(origin, destination);
  const mid = midpoint(origin, destination);
  const afterSunset = isAfterSunset();
  const isPeakHour = computeHeuristicRushScore() < 70;

  const [lights, footTraffic, driving] = await Promise.all([
    fetchStreetLightDensity(mid),
    fetchFootTrafficScore(mid),
    fetchDrivingRoute(origin, destination),
  ]);

  // Real DMRC line/interchange info and an accurate scheduled duration, from the bundled GTFS
  // feed (see lib/gtfs/) — local data, no network call, so unlike the Overpass-based amenities
  // elsewhere in this file this never needs to be rate-limited or run sequentially to stay
  // reliable. Only worth computing when Metro will actually be an option at all (same 1.2km
  // "not realistically a metro trip" threshold used below for whether to show it).
  const wantsMetroDetails = allowedModes.has("metro") && straightLineKm >= 1.2;
  let metroLineInfo: string | undefined;
  let metroLineColors: string[] | undefined;
  let metroGtfsDurationMin: number | undefined;
  if (wantsMetroDetails) {
    try {
      const originStation = findNearestStation(origin);
      const destStation = findNearestStation(destination);
      if (originStation && destStation && originStation.stop.id !== destStation.stop.id) {
        const plan = planMetroJourney(originStation.stop.id, destStation.stop.id);
        if (plan) {
          const lineNames = [plan.legs[0].lineName, ...plan.interchanges.map((i) => i.toLine)];
          metroLineInfo =
            plan.interchanges.length === 0
              ? `Direct via ${lineNames[0]} Line`
              : `${lineNames.join(" → ")} Line (${plan.interchanges.length} interchange${plan.interchanges.length > 1 ? "s" : ""})`;
          metroLineColors = lineNames.map(metroLineColor);
          if (plan.totalTravelMinutes !== null) {
            const originWalkMin = Math.max(1, Math.round(originStation.walkMeters / 80));
            const destWalkMin = Math.max(1, Math.round(destStation.walkMeters / 80));
            metroGtfsDurationMin = plan.totalTravelMinutes + originWalkMin + destWalkMin + plan.interchanges.length * 4;
          }
        }
      }
    } catch {
      // GTFS data failed to load — fall back to the distance-based estimate below, same "skipped,
      // never faked" behavior as every other optional enhancement in this file.
    }
  }

  const safetyScore = computeSafetyScore({
    streetLightCount: lights.count,
    streetLightDataAvailable: lights.available,
    footTrafficScore: footTraffic.score,
    afterSunset,
  });

  const safetyExplanationBase = {
    streetLightCount: lights.count,
    streetLightDataAvailable: lights.available,
    footTrafficScore: footTraffic.score,
    afterSunset,
  };

  // Bus/auto have no staffed platform and no single identifiable, pre-verified driver the way
  // Metro (staffed stations) and app cabs (a named, tracked driver) do — an honest penalty,
  // not just the absence of a bonus, and steeper after sunset when that gap matters most.
  const unmonitoredModePenalty = afterSunset ? 15 : 8;

  const rushScore = computeHeuristicRushScore();

  // Surface roads (bus/auto/e-rickshaw/cab) genuinely slow down in weekday peak traffic — OSRM's
  // free public router returns a "typical," not live-traffic, duration, so this heuristic
  // multiplier is the only peak-hour effect currently applied to road-based ETAs.
  const roadPeakMultiplier = isPeakHour ? 1.35 : 1;

  const cabDistanceKm = driving ? driving.distanceMeters / 1000 : straightLineKm * 1.3;
  const cabDurationMin = (driving ? driving.durationSeconds / 60 : (cabDistanceKm / 22) * 60) * roadPeakMultiplier;

  // Real transit corridors don't run in a straight line between two points — using raw crow-flies
  // distance here was understating actual travel distance (and so, duration) for any trip that
  // isn't already near-aligned start-to-end, sometimes badly. cabDistanceKm is already the best
  // real-world distance this app computes (live OSRM road routing when available, a circuity-
  // factored fallback otherwise) — reusing it for the other modes' duration math is a meaningfully
  // better proxy for actual distance travelled than crow-flies, even though none of these modes
  // literally follow roads.
  //
  // Delhi Metro/DTC don't expose a public live-routing GTFS feed, so real per-station routing
  // isn't wired up — these are distance-based estimates at each mode's average incl.-stops speed.
  // Metro adds an explicit average headway wait (trains run every ~4-6 min) plus typical station
  // access/egress time, rather than one unexplained flat padding constant. Unlike road transport,
  // Metro trip time isn't meaningfully affected by road traffic (if anything, trains run *more*
  // frequently at peak), so no peak multiplier applies to it.
  const METRO_AVG_HEADWAY_MIN = 5;
  const METRO_STATION_ACCESS_MIN = 4;
  // Prefer the real GTFS-computed duration (actual stations, actual scheduled travel time) when
  // it was available above — the distance-based estimate is only a fallback for when the GTFS
  // feed couldn't resolve a connection, not the default source of truth. Without this, this
  // headline number and the "View Details" panel's real total could show two different answers
  // for the same trip.
  const metroDurationMin = metroGtfsDurationMin ?? Math.round((cabDistanceKm / 33) * 60 + METRO_AVG_HEADWAY_MIN + METRO_STATION_ACCESS_MIN);
  const busDurationMin = Math.round(((cabDistanceKm / 18) * 60 + 5) * roadPeakMultiplier);
  const eRickshawDurationMin = Math.round((cabDistanceKm / 12) * 60 * roadPeakMultiplier);
  const autoDurationMin = Math.round((cabDistanceKm / 20) * 60 * roadPeakMultiplier);

  const metroFare = metroFareForDistance(straightLineKm);
  const busFare = busFareForDistance(straightLineKm, concession);
  const eRickshawFare = eRickshawFareForDistance(straightLineKm);
  const autoFare = Math.round(30 + straightLineKm * 11);
  const cabFareEstimate = Math.round(50 + cabDistanceKm * 14);

  const uberLinks = buildUberLinks(
    { ...origin, label: origin.label },
    { ...destination, label: destination.label }
  );
  const olaLinks = buildOlaLinks(
    { ...origin, label: origin.label },
    { ...destination, label: destination.label }
  );

  const rawOptions = [
    // Metro stations are realistically spaced ~1+ km apart — under that, origin and destination
    // are effectively at the same station, and nobody walks into a station, boards, and gets off
    // one stop later for a trip this short. Showing it anyway was a real "no one would actually
    // do this" case, not an honest option.
    ...(straightLineKm >= 1.2
      ? [
          {
            mode: "metro",
            label: "Delhi Metro",
            duration_min: metroDurationMin,
            fare_inr: metroFare,
            safety_score: Math.min(100, safetyScore + 15), // stations/platforms are staffed & monitored
            rush_score: 85,
            mode_bonus: 15,
            line_info: metroLineInfo,
            line_colors: metroLineColors,
          },
        ]
      : []),
    // Same logic for a bus: nobody waits at a stop for a bus to cover a few-hundred-metre walk.
    ...(straightLineKm >= 0.8
      ? [
          {
            mode: "bus",
            label: concession ? "DTC / Cluster Bus (free for women — Pink Pass)" : "DTC / Cluster Bus",
            duration_min: busDurationMin,
            fare_inr: busFare,
            safety_score: Math.max(0, safetyScore - unmonitoredModePenalty),
            rush_score: 55,
            mode_bonus: -unmonitoredModePenalty,
          },
        ]
      : []),
    // E-Rickshaws are realistically short feeder trips (to/from a metro station or bus stop),
    // not a substitute for the whole journey once distance grows beyond a couple of km.
    ...(straightLineKm <= 3
      ? [
          {
            mode: "e_rickshaw",
            label: "E-Rickshaw (feeder)",
            duration_min: eRickshawDurationMin,
            fare_inr: eRickshawFare,
            safety_score: safetyScore,
            rush_score: 70,
            mode_bonus: 0,
          },
        ]
      : []),
    {
      mode: "auto",
      label: "Auto-Rickshaw",
      duration_min: autoDurationMin,
      fare_inr: autoFare,
      safety_score: Math.max(0, safetyScore - unmonitoredModePenalty),
      rush_score: rushScore,
      mode_bonus: -unmonitoredModePenalty,
    },
    {
      mode: "cab_uber",
      label: "Uber",
      duration_min: Math.round(cabDurationMin),
      fare_inr: cabFareEstimate,
      safety_score: Math.min(100, safetyScore + 10),
      rush_score: rushScore,
      mode_bonus: 10,
      deep_link: uberLinks.app,
      web_link: uberLinks.web,
    },
    {
      mode: "cab_ola",
      label: "Ola",
      duration_min: Math.round(cabDurationMin),
      fare_inr: Math.round(cabFareEstimate * 0.95),
      safety_score: Math.min(100, safetyScore + 10),
      rush_score: rushScore,
      mode_bonus: 10,
      deep_link: olaLinks.app,
      web_link: olaLinks.web,
    },
  ].filter((opt) => allowedModes.has(opt.mode as (typeof ALL_MODES)[number]));

  const options = rawOptions.map((opt) => {
    const riskTier = classifyRiskTier(opt.safety_score);
    const legDistanceKm = opt.mode.startsWith("cab") ? cabDistanceKm : straightLineKm;
    return {
      mode: opt.mode,
      label: opt.label,
      duration_min: opt.duration_min,
      fare_inr: opt.fare_inr,
      safety_score: opt.safety_score,
      rush_score: opt.rush_score,
      final_score: computeFinalScore(opt.safety_score, opt.rush_score, sort, afterSunset),
      risk_tier: riskTier.tier,
      risk_label: riskTier.label,
      risk_alert: riskTier.alert,
      deep_link: "deep_link" in opt ? opt.deep_link : undefined,
      web_link: "web_link" in opt ? opt.web_link : undefined,
      line_info: "line_info" in opt ? opt.line_info : undefined,
      line_colors: "line_colors" in opt ? opt.line_colors : undefined,
      why: {
        safety: explainSafety({ ...safetyExplanationBase, modeBonus: opt.mode_bonus, modeLabel: opt.label }),
        cost: explainCost(opt.label, opt.fare_inr, legDistanceKm, opt.mode === "bus" ? concession : undefined),
        speed: explainSpeed(opt.label, opt.duration_min, Boolean(driving), isPeakHour),
      },
    };
  });

  const sorted = [...options].sort((a, b) => {
    if (sort === "cheapest") return a.fare_inr - b.fare_inr;
    if (sort === "fastest") return a.duration_min - b.duration_min;
    if (sort === "safest") return b.safety_score - a.safety_score;
    return b.final_score - a.final_score;
  });

  return NextResponse.json({
    straight_line_km: Math.round(straightLineKm * 10) / 10,
    // Real road-snapped path (actual street turns/flyovers/roundabouts, from the same OSRM call
    // already used for cab/bus/auto duration) — null when live routing was unavailable, in which
    // case the map falls back to a straight line and says so rather than pretending otherwise.
    route_polyline: driving?.polyline ?? null,
    signals: {
      street_light_count_near_midpoint: lights.count,
      street_light_data_available: lights.available,
      foot_traffic_score: footTraffic.score,
      foot_traffic_data_available: footTraffic.available,
      live_routing_available: Boolean(driving),
      after_sunset: afterSunset,
    },
    sort,
    options: sorted,
  });
}
