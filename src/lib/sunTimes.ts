// Real astronomical sunrise/sunset for Delhi NCR (28.6139° N, 77.2090° E), computed locally with
// the standard NOAA/Wikipedia sunrise equation — no network call, no API key, and no dependency
// on a third-party time service that can rate-limit or go down. This replaces a fixed 19:00-06:00
// "after sunset" window, which was off by well over an hour depending on the season (Delhi's real
// sunset ranges from ~17:25 in late December to ~19:20 in late June).
const DELHI_LAT = 28.6139;
const DELHI_LNG = 77.209;
const IST_OFFSET_HOURS = 5.5;
const ZENITH_DEG = 90.833; // official sunrise/sunset zenith, includes atmospheric refraction

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}
function dayOfYear(year: number, month: number, day: number) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

/** Returns { sunriseHour, sunsetHour } as decimal IST hours (e.g. 18.75 = 18:45) for the given
 * calendar date. `isRising` picks the sunrise (true) or sunset (false) branch of the equation. */
function computeEventHour(year: number, month: number, day: number, isRising: boolean): number {
  const N = dayOfYear(year, month, day);
  const lngHour = DELHI_LNG / 15;
  const t = N + ((isRising ? 6 : 18) - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(toRad(M)) + 0.02 * Math.sin(toRad(2 * M)) + 282.634;
  L = ((L % 360) + 360) % 360;

  let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
  RA = ((RA % 360) + 360) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA = RA / 15;

  const sinDec = 0.39782 * Math.sin(toRad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(toRad(ZENITH_DEG)) - sinDec * Math.sin(toRad(DELHI_LAT))) /
    (cosDec * Math.cos(toRad(DELHI_LAT)));

  let H = isRising ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
  H = H / 15;

  const T = H + RA - 0.06571 * t - 6.622;
  let UT = T - lngHour;
  UT = ((UT % 24) + 24) % 24;

  return ((UT + IST_OFFSET_HOURS) % 24 + 24) % 24;
}

function istDateString(date: Date): string {
  // Read the calendar date in IST (not the server's local date) — a UTC server could otherwise
  // compute sunrise/sunset for the wrong day near midnight IST.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "YYYY-MM-DD"
}

export function getSunTimes(date: Date): { sunriseHour: number; sunsetHour: number } {
  const [year, month, day] = istDateString(date).split("-").map(Number);
  return {
    sunriseHour: computeEventHour(year, month, day, true),
    sunsetHour: computeEventHour(year, month, day, false),
  };
}

interface SunTimesCacheEntry {
  value: { sunriseHour: number; sunsetHour: number };
  expiresAt: number;
}

// Sunrise/sunset for a given date is fixed once computed, so caching per IST-date (not per
// request) avoids re-hitting the live API for every route search on the same day.
const LIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const liveCache = new Map<string, SunTimesCacheEntry>();

/**
 * Real-time sunrise/sunset for Delhi from the public sunrise-sunset.org API — no key required.
 * Falls back to the local NOAA-equation calculation above (getSunTimes) whenever the API is
 * slow, down, or returns something unexpected, so a third-party outage can never break the
 * app's day/night safety logic. The fallback isn't a guess — it's the same real astronomical
 * formula, just computed locally instead of fetched.
 */
export async function fetchLiveSunTimes(date = new Date()): Promise<{ sunriseHour: number; sunsetHour: number }> {
  const dateKey = istDateString(date);
  const cached = liveCache.get(dateKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  try {
    const params = new URLSearchParams({ lat: "28.6139", lng: "77.2090", date: dateKey, formatted: "0" });
    const res = await fetch(`https://api.sunrise-sunset.org/json?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`sunrise-sunset.org HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.sunrise || !data.results?.sunset) {
      throw new Error("sunrise-sunset.org returned an unexpected payload");
    }

    // The API returns real UTC instants (ISO8601, since formatted=0) — convert to IST decimal
    // hours the same way the rest of the app reads "what hour is it in Delhi right now".
    const toIstDecimalHour = (isoUtc: string) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(new Date(isoUtc));
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
      const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
      return hour + minute / 60;
    };

    const value = {
      sunriseHour: toIstDecimalHour(data.results.sunrise),
      sunsetHour: toIstDecimalHour(data.results.sunset),
    };
    liveCache.set(dateKey, { value, expiresAt: Date.now() + LIVE_CACHE_TTL_MS });
    return value;
  } catch {
    // Never let a third-party API outage break sunset-dependent safety scoring — fall back to
    // the real local astronomical computation instead of guessing or using a stale value.
    return getSunTimes(date);
  }
}
