"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A service worker caching static chunks is actively harmful in dev: Turbopack's dev
      // chunk filenames aren't content-hashed the way production ones are, so a cache-first
      // strategy can keep serving JavaScript from *before* a code change indefinitely — which
      // is exactly what happened here (a chunk referencing next-themes stayed cached after that
      // dependency was removed, breaking the app until the SW was unregistered). Proactively
      // unregister here too, so anyone who already picked up the old dev-registered SW self-heals.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline caching is a progressive enhancement — app still works without it */
    });
  }, []);
  return null;
}
