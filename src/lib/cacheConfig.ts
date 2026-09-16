// Shared TTL for the app's live-data caches (Overpass queries, OSRM routing, time-of-day
// bucketing). 5 minutes: safety signals like lighting/foot-traffic don't meaningfully change
// minute-to-minute in reality, so this trades negligible staleness for the determinism users
// expect from re-running the same search.
export const CACHE_TTL_MS = 5 * 60 * 1000;
