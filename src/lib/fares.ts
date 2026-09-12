/** Approximates DMRC's real distance-slab fare card (₹10–₹60 standard, up to ₹64 on Airport Express). */
export function metroFareForDistance(km: number) {
  if (km <= 2) return 10;
  if (km <= 5) return 20;
  if (km <= 12) return 30;
  if (km <= 21) return 40;
  if (km <= 32) return 50;
  return 60;
}

/**
 * DTC/Cluster bus fare. Women ride free under Delhi's Pink Pass scheme (`concession: true`,
 * the default) — `concession: false` shows the standard fare a non-concession rider would pay.
 */
export function busFareForDistance(km: number, concession = true) {
  if (concession) return 0;
  if (km <= 4) return 5;
  if (km <= 8) return 10;
  if (km <= 12) return 15;
  if (km <= 20) return 20;
  return 25;
}

/** Shared e-rickshaw feeder fare — a flat ₹10-20 depending on distance, only realistic for short feeder trips. */
export function eRickshawFareForDistance(km: number) {
  return km <= 1.5 ? 10 : 20;
}
