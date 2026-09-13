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

export function getSunTimes(date: Date): { sunriseHour: number; sunsetHour: number } {
  // Read the calendar date in IST (not the server's local date) — a UTC server could otherwise
  // compute sunrise/sunset for the wrong day near midnight IST.
  const istDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "YYYY-MM-DD"
  const [year, month, day] = istDateParts.split("-").map(Number);

  return {
    sunriseHour: computeEventHour(year, month, day, true),
    sunsetHour: computeEventHour(year, month, day, false),
  };
}
