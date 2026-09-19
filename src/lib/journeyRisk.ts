// The "Journey Risk Index" — how concerning an ACTIVE journey's check-in/movement situation is.
// Deliberately separate from lib/scoring.ts / lib/riskTier.ts (the route/environment "Safety
// Score" shown on route cards, based on lighting/foot-traffic/time-of-day) — those two systems
// answer different questions and are never mixed here. Naming is kept distinct on purpose:
// journeyRiskIndex / journey_risk_index everywhere, never riskScore/risk_score.

export type JourneyRiskLevel = "LOW" | "ATTENTION" | "CONCERN" | "CRITICAL";

export interface JourneyRiskResult {
  journeyRiskIndex: number; // 0-100
  riskLevel: JourneyRiskLevel;
  reasons: string[];
}

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LocationPoint extends LatLng {
  recordedAt: number; // epoch ms
}

export interface JourneyRiskInputs {
  etaAt: number; // epoch ms
  now: number; // epoch ms — passed explicitly (not Date.now() inside) so this stays a pure, testable function
  destination: LatLng | null;
  /** Most recent points first (index 0 = latest). Only the last 2-3 are actually used. */
  recentLocations: LocationPoint[];
  /** The straight-line origin→destination path, for a simple deviation check — a real per-street
   * route isn't available for a free-text/no-route-selected journey, so this is an honest
   * approximation, same spirit as the rest of this app's "never fabricate precision we don't
   * have" pattern. */
  origin: LatLng | null;
  missedCheckins: number;
  sosActive: boolean;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Perpendicular distance from a point to the straight-line segment a→b. */
function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = (a.latitude * Math.PI) / 180;
  const toXY = (p: LatLng) => ({
    x: (((p.longitude - a.longitude) * Math.PI) / 180) * Math.cos(lat0) * 6371000,
    y: (((p.latitude - a.latitude) * Math.PI) / 180) * 6371000,
  });
  const A = toXY(a);
  const B = toXY(b);
  const P = toXY(point);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSq));
  const closest = { x: A.x + t * dx, y: A.y + t * dy };
  return Math.sqrt((P.x - closest.x) ** 2 + (P.y - closest.y) ** 2);
}

const ROUTE_DEVIATION_THRESHOLD_M = 500; // below this, treat as normal GPS wobble, not a real deviation
const NEAR_DESTINATION_M = 200; // spec's 150-200m "essentially arrived" window
const STATIONARY_SPEED_M_PER_MIN = 3; // ~0.18 km/h — walking pace is ~80 m/min, so this is "not moving"
const STATIONARY_MIN_GAP_MINUTES = 10; // don't call it "no movement" from two points 30 seconds apart

export function classifyRiskLevel(journeyRiskIndex: number): JourneyRiskLevel {
  if (journeyRiskIndex >= 80) return "CRITICAL";
  if (journeyRiskIndex >= 60) return "CONCERN";
  if (journeyRiskIndex >= 30) return "ATTENTION";
  return "LOW";
}

/**
 * Computes the Journey Risk Index from real, available signals only — never a single missed
 * check-in or a connectivity drop alone (both are explicit non-signals per spec: connectivity is
 * context, not a danger signal by itself). Every point added is tied to a human-readable reason
 * so an elevated index is always explainable, never a bare number.
 */
export function computeJourneyRisk(inputs: JourneyRiskInputs): JourneyRiskResult {
  const { etaAt, now, destination, recentLocations, origin, missedCheckins, sosActive } = inputs;

  // SOS is an unconditional override — nothing else needs to agree for this to be CRITICAL.
  if (sosActive) {
    return { journeyRiskIndex: 100, riskLevel: "CRITICAL", reasons: ["SOS activated"] };
  }

  const reasons: string[] = [];
  let points = 0;

  // 1 & 2. Overdue / missed "reached home" check-in.
  const overdueMinutes = Math.max(0, (now - etaAt) / 60000);
  if (overdueMinutes > 0) {
    const overduePoints = Math.min(50, Math.round(overdueMinutes * 2));
    points += overduePoints;
    reasons.push(`Journey overdue by ${Math.round(overdueMinutes)} minute${Math.round(overdueMinutes) === 1 ? "" : "s"}`);
  }

  // 7. Repeated missed check-ins (beyond the first — one missed check-in alone shouldn't read as danger).
  if (missedCheckins > 1) {
    const repeatPoints = Math.min(20, (missedCheckins - 1) * 10);
    points += repeatPoints;
    reasons.push(`Check-in missed ${missedCheckins} times`);
  }

  // Distance to destination — computed once, used both to soften movement concern near arrival
  // and to explain a reduction when relevant.
  const latest = recentLocations[0];
  let nearDestination = false;
  if (destination && latest) {
    const distanceToDestM = haversineMeters(latest, destination);
    nearDestination = distanceToDestM <= NEAR_DESTINATION_M;
  }

  // 3. No recent movement — needs at least 2 real points spaced meaningfully apart in time;
  // never inferred from a single point or from a connectivity gap.
  if (recentLocations.length >= 2 && !nearDestination) {
    const [p0, p1] = recentLocations;
    const gapMinutes = (p0.recordedAt - p1.recordedAt) / 60000;
    if (gapMinutes >= STATIONARY_MIN_GAP_MINUTES) {
      const movedMeters = haversineMeters(p0, p1);
      const speedMPerMin = movedMeters / gapMinutes;
      if (speedMPerMin < STATIONARY_SPEED_M_PER_MIN) {
        points += 20;
        reasons.push(`No recent movement detected in the last ${Math.round(gapMinutes)} minutes`);
      }
    }
  }

  // 4. Route deviation — a real per-street route isn't available without a selected route, so
  // this compares against the straight origin→destination line as an honest approximation.
  if (origin && destination && latest && !nearDestination) {
    const deviationM = distanceToSegmentMeters(latest, origin, destination);
    if (deviationM > ROUTE_DEVIATION_THRESHOLD_M) {
      points += 15;
      reasons.push(`Route deviation detected (${Math.round(deviationM)}m from planned path)`);
    }
  }

  // 5. Proximity to destination reduces contextual concern, per spec — applied as a dampener on
  // the whole score rather than a separate subtracted signal, so it can't push the score negative
  // or hide a SOS/overdue signal disproportionately.
  if (nearDestination) {
    points = Math.round(points * 0.3);
    reasons.push("Near destination — reduced concern");
  }

  const journeyRiskIndex = Math.max(0, Math.min(100, points));
  return { journeyRiskIndex, riskLevel: classifyRiskLevel(journeyRiskIndex), reasons };
}
