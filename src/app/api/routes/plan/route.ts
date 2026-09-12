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
} from "@/lib/scoring";
import { fetchDrivingRoute } from "@/lib/routing";
import { buildOlaLinks, buildUberLinks } from "@/lib/rideDeepLinks";
import { metroFareForDistance } from "@/lib/fares";

const bodySchema = z.object({
  origin: coordinateSchema.extend({ label: z.string().trim().max(120).optional() }),
  destination: coordinateSchema.extend({ label: z.string().trim().max(120).optional() }),
  sort: z.enum(["balanced", "safest", "fastest", "cheapest"]).default("balanced"),
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

  const { origin, destination, sort } = parsed.data;
  const straightLineKm = haversineKm(origin, destination);
  const mid = midpoint(origin, destination);

  const [lights, footTraffic, driving] = await Promise.all([
    fetchStreetLightDensity(mid),
    fetchFootTrafficScore(mid),
    fetchDrivingRoute(origin, destination),
  ]);

  const safetyScore = computeSafetyScore({
    streetLightCount: lights.count,
    streetLightDataAvailable: lights.available,
    footTrafficScore: footTraffic.score,
  });

  const cabDistanceKm = driving ? driving.distanceMeters / 1000 : straightLineKm * 1.3;
  const cabDurationMin = driving ? driving.durationSeconds / 60 : (cabDistanceKm / 22) * 60;
  const rushScore = computeHeuristicRushScore();

  // Metro/DTC bus legs are distance-based estimates (avg incl.-stops speeds) — Delhi Metro/DTC
  // don't expose a public live-routing GTFS feed, so real per-station routing isn't wired up yet.
  const metroDurationMin = Math.round((straightLineKm / 33) * 60 + 8); // +8 min avg station access/interchange
  const busDurationMin = Math.round((straightLineKm / 18) * 60 + 5);
  const autoDurationMin = Math.round((straightLineKm / 20) * 60);

  const metroFare = metroFareForDistance(straightLineKm);
  const busFare = straightLineKm <= 0 ? 0 : 0; // Pink Pass: DTC/Cluster bus rides are free for women in Delhi
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

  const options = [
    {
      mode: "metro",
      label: "Delhi Metro",
      duration_min: metroDurationMin,
      fare_inr: metroFare,
      safety_score: Math.min(100, safetyScore + 15), // stations/platforms are staffed & monitored
      rush_score: 85,
    },
    {
      mode: "bus",
      label: "DTC / Cluster Bus (free for women — Pink Pass)",
      duration_min: busDurationMin,
      fare_inr: busFare,
      safety_score: safetyScore,
      rush_score: 55,
    },
    {
      mode: "auto",
      label: "Auto-Rickshaw",
      duration_min: autoDurationMin,
      fare_inr: autoFare,
      safety_score: safetyScore,
      rush_score: rushScore,
    },
    {
      mode: "cab_uber",
      label: "Uber",
      duration_min: Math.round(cabDurationMin),
      fare_inr: cabFareEstimate,
      safety_score: Math.min(100, safetyScore + 10),
      rush_score: rushScore,
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
      deep_link: olaLinks.app,
      web_link: olaLinks.web,
    },
  ].map((opt) => ({ ...opt, final_score: computeFinalScore(opt.safety_score, opt.rush_score, sort) }));

  const sorted = [...options].sort((a, b) => {
    if (sort === "cheapest") return a.fare_inr - b.fare_inr;
    if (sort === "fastest") return a.duration_min - b.duration_min;
    if (sort === "safest") return b.safety_score - a.safety_score;
    return b.final_score - a.final_score;
  });

  return NextResponse.json({
    straight_line_km: Math.round(straightLineKm * 10) / 10,
    signals: {
      street_light_count_near_midpoint: lights.count,
      street_light_data_available: lights.available,
      foot_traffic_score: footTraffic.score,
      foot_traffic_data_available: footTraffic.available,
      live_routing_available: Boolean(driving),
    },
    sort,
    options: sorted,
  });
}
