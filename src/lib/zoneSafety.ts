import { computeSafetyScore, fetchFootTrafficScore, fetchStreetLightDensity } from "@/lib/scoring";

interface LatLng {
  latitude: number;
  longitude: number;
}

export type ZoneStatus = "Safe" | "Moderate" | "Caution";

export interface RouteZoneSafety {
  zoneId: string;
  zoneName: string;
  safetyScore: number; // 0-100, consistent with the rest of the app
  status: ZoneStatus;
  neonColorHex: string;
  description: string;
  riskFactors: string[];
  safetyFeatures: string[];
  latitude: number;
  longitude: number;
}

const NEON_COLOR: Record<ZoneStatus, string> = {
  Safe: "#00FF9D",
  Moderate: "#FFE600",
  Caution: "#FF2E93",
};

function statusFor(score: number): ZoneStatus {
  if (score >= 75) return "Safe";
  if (score >= 50) return "Moderate";
  return "Caution";
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
}

function buildZoneCopy(
  status: ZoneStatus,
  lights: { count: number; available: boolean },
  footTraffic: { score: number | null; available: boolean }
): { description: string; riskFactors: string[]; safetyFeatures: string[] } {
  const riskFactors: string[] = [];
  const safetyFeatures: string[] = [];

  if (lights.available) {
    if (lights.count === 0) riskFactors.push("No individually-mapped street lighting found nearby (OSM data may simply be incomplete here)");
    else if (lights.count >= 6) safetyFeatures.push("Dense mapped street-lighting along this stretch");
  }

  if (footTraffic.available && typeof footTraffic.score === "number") {
    if (footTraffic.score < 20) riskFactors.push("Few shops or public amenities nearby — a relatively quiet stretch");
    else if (footTraffic.score >= 60) safetyFeatures.push("High density of shops/amenities — usually populated");
  }

  if (riskFactors.length === 0 && safetyFeatures.length === 0) {
    riskFactors.push("Live safety data was unavailable for this stretch — treat with normal caution");
  }

  const description =
    status === "Safe"
      ? "Real-time signals show good street lighting and/or foot traffic along this stretch."
      : status === "Moderate"
        ? "Mixed signals — some lighting or foot traffic present, but not consistently strong."
        : "Limited street lighting and foot traffic data for this stretch — extra caution advised, especially after dark.";

  return { description, riskFactors, safetyFeatures };
}

/**
 * Splits the route into 3 zones (first third / middle / last third) and scores each using the
 * same live OSM street-light + foot-traffic signals used for the overall route score — real
 * data, not fabricated risk factors like "CCTV nearby" that can't actually be verified from
 * free sources. Overpass calls run sequentially across zones (not all in parallel) since their
 * public server enforces a small per-client concurrent-request limit — see the note in
 * src/lib/helpPoints.ts, where hitting this limit was already a real, reproduced bug.
 */
export async function computeRouteZones(
  origin: LatLng,
  destination: LatLng,
  midpointSignals?: { lights: { count: number; available: boolean }; footTraffic: { score: number | null; available: boolean } }
): Promise<RouteZoneSafety[]> {
  const pointA = interpolate(origin, destination, 0.25);
  const pointB = interpolate(origin, destination, 0.5);
  const pointC = interpolate(origin, destination, 0.75);

  // The 2 calls *within* one zone (different query types) run in parallel — this exact pattern
  // (street-light + foot-traffic together) already runs safely elsewhere in this app. Only
  // *zone-to-zone* calls stay sequential, since 3+ simultaneous identical-type Overpass requests
  // is what actually broke things before (see src/lib/helpPoints.ts).
  async function scoreAt(point: LatLng) {
    const [lights, footTraffic] = await Promise.all([fetchStreetLightDensity(point), fetchFootTrafficScore(point)]);
    return { lights, footTraffic };
  }

  const zoneAData = await scoreAt(pointA);
  const zoneCData = await scoreAt(pointC);
  const zoneBData = midpointSignals ?? (await scoreAt(pointB));

  const zoneDefs = [
    { id: "zone-a", name: "Starting Stretch", point: pointA, data: zoneAData },
    { id: "zone-b", name: "Midpoint Stretch", point: pointB, data: zoneBData },
    { id: "zone-c", name: "Final Stretch", point: pointC, data: zoneCData },
  ];

  return zoneDefs.map(({ id, name, point, data }) => {
    const safetyScore = computeSafetyScore({
      streetLightCount: data.lights.count,
      streetLightDataAvailable: data.lights.available,
      footTrafficScore: data.footTraffic.score,
    });
    const status = statusFor(safetyScore);
    const copy = buildZoneCopy(status, data.lights, data.footTraffic);
    return {
      zoneId: id,
      zoneName: name,
      safetyScore,
      status,
      neonColorHex: NEON_COLOR[status],
      latitude: point.latitude,
      longitude: point.longitude,
      ...copy,
    };
  });
}
