import { istParts } from "@/lib/istTime";
import { fetchLiveSunTimes } from "@/lib/sunTimes";
import { CACHE_TTL_MS } from "@/lib/cacheConfig";

// Rounds a timestamp down to the current cache-TTL window so two calls within the same window
// can't land on opposite sides of an hour/sunset boundary and silently get a different reading
// for what's effectively the same moment — same reasoning as scoring.ts's bucketedDate.
function bucketedDate(date: Date) {
  return new Date(Math.floor(date.getTime() / CACHE_TTL_MS) * CACHE_TTL_MS);
}

export type RushTier = "none" | "standard" | "heavy" | "peak";

export interface TemporalContext {
  /** Decimal IST hour, e.g. 18.5 = 6:30 PM. */
  hour: number;
  isWeekend: boolean;
  sunriseHour: number;
  sunsetHour: number;
  isAfterSunset: boolean;
  /** The 30 minutes immediately before sunset — open/unmonitored modes lose "Safe" eligibility
   * starting here, not only once it's fully dark. */
  inPreSunsetBuffer: boolean;
  /** The 2 hours immediately after sunrise — an isolated, low-traffic window despite being
   * daylight, so heightened precautions still apply to open modes. */
  inPostSunriseBuffer: boolean;
  rushTier: RushTier;
  /** True from 11:00 PM through the early morning (before sunrise) — the late-night high-risk
   * window where only Metro (while still running) is the preferred recommendation. */
  isLateNight: boolean;
  busOperating: boolean;
  metroOperating: boolean;
}

// DTC's last buses of the day conclude around 10 PM; the first morning buses start at 6:45 AM.
const BUS_START_HOUR = 6 + 45 / 60;
const BUS_END_HOUR = 22;

// The Metro's last trains are around 11:50 PM; first trains resume at 6:00 AM.
const METRO_START_HOUR = 6;
const METRO_END_HOUR = 23 + 50 / 60;

const LATE_NIGHT_START_HOUR = 23;

export function isBusOperating(hour: number): boolean {
  return hour >= BUS_START_HOUR && hour < BUS_END_HOUR;
}

export function isMetroOperating(hour: number): boolean {
  return hour >= METRO_START_HOUR && hour < METRO_END_HOUR;
}

function classifyRushTier(hour: number): RushTier {
  if (hour >= 10 && hour < 11) return "peak";
  if (hour >= 9 && hour < 10) return "heavy";
  if (hour >= 8 && hour < 9) return "standard";
  return "none";
}

/**
 * Every time-dependent fact this app's safety logic needs, computed once per request from the
 * real IST clock and (when reachable) sunrise-sunset.org's live sunrise/sunset for Delhi —
 * see lib/sunTimes.ts for the fallback behavior if that API is unreachable.
 */
export async function getTemporalContext(date = new Date()): Promise<TemporalContext> {
  const bucketed = bucketedDate(date);
  const { preciseHour: hour, isWeekend } = istParts(bucketed);
  const { sunriseHour, sunsetHour } = await fetchLiveSunTimes(bucketed);

  const isAfterSunset = hour >= sunsetHour || hour < sunriseHour;
  const inPreSunsetBuffer = hour >= sunsetHour - 0.5 && hour < sunsetHour;
  const inPostSunriseBuffer = hour >= sunriseHour && hour < sunriseHour + 2;
  const isLateNight = hour >= LATE_NIGHT_START_HOUR || hour < sunriseHour;

  return {
    hour,
    isWeekend,
    sunriseHour,
    sunsetHour,
    isAfterSunset,
    inPreSunsetBuffer,
    inPostSunriseBuffer,
    rushTier: classifyRushTier(hour),
    isLateNight,
    busOperating: isBusOperating(hour),
    metroOperating: isMetroOperating(hour),
  };
}

/** Points subtracted from Bus/Metro safety scores during the 8-11 AM crowding windows — an
 * escalating penalty (standard < heavy < peak) reflecting how packed transit genuinely gets
 * through that hour, not a flat "rush hour" constant. */
export function rushCrowdingPenalty(rushTier: RushTier): number {
  if (rushTier === "peak") return 15;
  if (rushTier === "heavy") return 10;
  if (rushTier === "standard") return 5;
  return 0;
}

/**
 * The global score cap: any mode may only score above 80 during the 11 AM-3 PM daytime window.
 * Outside that window, 80 is a hard ceiling regardless of how good the underlying signals are.
 */
export function applyGlobalCap(score: number, hour: number): number {
  const inMiddayWindow = hour >= 11 && hour < 15;
  return inMiddayWindow ? Math.min(100, score) : Math.min(80, score);
}

/**
 * Open/unmonitored modes (Bus, Auto, E-Rickshaw) can't be classified "Safe" starting 30 minutes
 * before real sunset — capped just under the "Safe" band's floor (70) so they land in
 * "Moderately Safe" or lower regardless of how good the raw lighting/foot-traffic signals are.
 */
export function applyPreSunsetOpenModeCap(score: number): number {
  return Math.min(score, 69);
}

/**
 * After 6:30 PM, Auto and Bus must strictly read High Risk (below the 30-point floor) — an
 * explicit evening penalty on top of (not instead of) the pre-sunset "Safe" cap above, since
 * this can apply even when today's sunset is itself later than 6:30 PM.
 */
export function applyEveningOpenModePenalty(score: number, hour: number): number {
  return hour >= 18.5 ? Math.min(score, 29) : score;
}

/**
 * From 11 PM onward, every mode carries high risk EXCEPT Metro (while it's still running), which
 * stays the preferred recommendation thanks to staffed stations, CCTV, and security guards.
 */
export function applyLateNightPenalty(score: number, mode: string, isLateNight: boolean): number {
  if (!isLateNight) return score;
  if (mode === "metro") return score; // exempted — the preferred late-night recommendation
  return Math.min(score, 29);
}
