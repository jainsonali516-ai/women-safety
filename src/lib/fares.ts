/** Approximates DMRC's real distance-slab fare card (₹10–₹60 standard, up to ₹64 on Airport Express). */
export function metroFareForDistance(km: number) {
  if (km <= 2) return 10;
  if (km <= 5) return 20;
  if (km <= 12) return 30;
  if (km <= 21) return 40;
  if (km <= 32) return 50;
  return 60;
}
