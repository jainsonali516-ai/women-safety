export type RiskTier = "high" | "mid_high" | "mid_low" | "safe";

// Single source of truth for tier color, shared by the route cards and the map's route glow so
// a "Mid-High Risk" badge and a route line always mean the same color everywhere in the app.
export const RISK_TIER_COLOR: Record<RiskTier, string> = {
  high: "#ef4444",
  mid_high: "#f97316",
  mid_low: "#eab308",
  safe: "#22c55e",
};

export interface RiskTierInfo {
  tier: RiskTier;
  label: string;
  alert: string;
}

/**
 * Converts the 0-100 safety score into one of 4 explicit tiers instead of a raw number —
 * easier to act on at a glance than "62/100". Bands: 70-100 Safe, 50-69 Moderately Safe,
 * 30-49 Moderately Risky, below 30 High Risk.
 */
export function classifyRiskTier(safetyScore: number): RiskTierInfo {
  if (safetyScore < 30) {
    return { tier: "high", label: "HIGH RISK", alert: "🚨 High Risk — not recommended, especially after dark" };
  }
  if (safetyScore < 50) {
    return { tier: "mid_high", label: "Moderately Risky", alert: "⚠️ Exercise caution after hours" };
  }
  if (safetyScore < 70) {
    return { tier: "mid_low", label: "Moderately Safe", alert: "Moderately safe corridor" };
  }
  return { tier: "safe", label: "Safe to Go", alert: "✓ High safety index — recommended" };
}

interface SafetyExplanationInputs {
  streetLightCount: number;
  streetLightDataAvailable: boolean;
  footTrafficScore: number | null;
  afterSunset: boolean;
  modeBonus: number; // e.g. +15 for metro (staffed stations), +10 for cabs (single known driver)
  modeLabel: string;
}

export function explainSafety(inputs: SafetyExplanationInputs): string {
  const parts: string[] = [];

  // Street lighting is only a relevant safety factor once it's actually dark — mentioning "low
  // lighting" as a reason on a route searched at 9 AM reads as nonsensical, even though the
  // underlying signal is still (lightly) weighted into the score for the after-dark case where
  // this same route might be searched again later.
  if (inputs.afterSunset && inputs.streetLightDataAvailable) {
    parts.push(
      inputs.streetLightCount >= 8
        ? "well-lit streets along the route (dense mapped street-lighting)"
        : inputs.streetLightCount > 0
          ? "only partial street lighting mapped along the route"
          : "little to no mapped street lighting along this stretch"
    );
  }

  if (typeof inputs.footTrafficScore === "number") {
    parts.push(
      inputs.footTrafficScore >= 60
        ? "high foot traffic and commercial activity nearby"
        : inputs.footTrafficScore >= 25
          ? "moderate foot traffic nearby"
          : "few shops or pedestrians nearby — a fairly isolated stretch"
    );
  }

  if (inputs.modeBonus > 0) {
    parts.push(`${inputs.modeLabel} adds a safety margin (staffed/monitored, or a single identifiable driver)`);
  } else if (inputs.modeBonus < 0) {
    parts.push(`${inputs.modeLabel} has no staffed platform and no single pre-verified driver, so a penalty is applied${inputs.afterSunset ? " — more heavily after sunset" : ""}`);
  }

  if (parts.length === 0) return "Live safety signals weren't available for this route — score defaults to neutral.";

  const sunsetNote = inputs.afterSunset
    ? "It's after sunset, so lighting and foot traffic are weighted more heavily. "
    : "";
  return `${sunsetNote}Based on ${parts.join(", ")}.`;
}

export function explainCost(modeLabel: string, fareInr: number, distanceKm: number, concession?: boolean): string {
  if (fareInr === 0) {
    return `${modeLabel} is free — Delhi's Pink Pass scheme covers DTC/Cluster bus fares for women.`;
  }
  if (concession === false) {
    return `${modeLabel} standard fare for ~${distanceKm.toFixed(1)} km. Turn on the Pink Saheli toggle for the free women's concession fare.`;
  }
  return `${modeLabel} fare for ~${distanceKm.toFixed(1)} km, ₹${fareInr} total.`;
}

export function explainSpeed(modeLabel: string, durationMin: number, liveRoutingAvailable: boolean, isPeakHour: boolean): string {
  const trafficNote = isPeakHour
    ? "current time falls in a typical weekday traffic peak, which slows surface transport"
    : "outside peak hours, so surface roads are comparatively clear";
  const dataNote = liveRoutingAvailable
    ? "using real road-distance routing"
    : "estimated from straight-line distance (live routing was unavailable)";
  return `${modeLabel} takes about ${durationMin} min, ${dataNote}; ${trafficNote}.`;
}
