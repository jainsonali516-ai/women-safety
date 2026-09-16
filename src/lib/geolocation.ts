export interface PositionResult {
  position: GeolocationPosition | null;
  errorCode: number | null;
}

function getPositionOnce(options: PositionOptions): Promise<PositionResult> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ position, errorCode: null }),
      (err) => resolve({ position: null, errorCode: err.code }),
      options
    );
  });
}

/**
 * A phone's first *high-accuracy* GPS fix (cold start) can genuinely take 15-20s, especially
 * indoors — and most laptops have no GPS chip at all, so a high-accuracy-only request there
 * either takes just as long (falling back to slow wifi-based positioning under the hood) or
 * simply can't resolve within a short timeout. Try a fast, coarse (network/cell/wifi-based) fix
 * first, and only fall back to the slower high-accuracy request if that genuinely fails —
 * originally worked out for SosTracker's "Start Tracking" (a continuous watch upgrades to a
 * precise fix within seconds afterward anyway, so the first ping doesn't need to be perfect),
 * and just as true anywhere else in the app that asks for a one-off location fix.
 */
export async function getCurrentPositionWithFallback(): Promise<PositionResult> {
  if (!("geolocation" in navigator)) return { position: null, errorCode: null };
  const fast = await getPositionOnce({ enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
  if (fast.position) return fast;
  return getPositionOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
}
