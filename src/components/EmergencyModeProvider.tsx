"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ActivationSource = "offline" | "battery" | "manual" | null;

interface EmergencyModeState {
  active: boolean;
  source: ActivationSource;
  batterySupported: boolean;
  toggleManual: () => void;
}

const EmergencyModeContext = createContext<EmergencyModeState | null>(null);

const LOW_BATTERY_THRESHOLD = 0.05;

// The Battery Status API (navigator.getBattery) is deprecated and removed or restricted in
// most modern browsers (Chrome desktop, Firefox, Safari) over fingerprinting concerns — it
// only reliably works in some Chromium-based mobile/Android WebView contexts. We feature-detect
// it and skip that trigger silently where it's unavailable, rather than pretending it works.
interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

export function EmergencyModeProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isLowBattery, setIsLowBattery] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [batterySupported, setBatterySupported] = useState(false);
  const batteryRef = useRef<BatteryManager | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of the real browser online state on mount
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery === "function") {
      nav.getBattery().then((battery) => {
        batteryRef.current = battery;
        setBatterySupported(true);
        const check = () => setIsLowBattery(battery.level <= LOW_BATTERY_THRESHOLD && battery.charging === false);
        check();
        battery.addEventListener("levelchange", check);
        battery.addEventListener("chargingchange", check);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const toggleManual = useCallback(() => setManualOverride((v) => !v), []);

  const active = isOffline || isLowBattery || manualOverride;
  const source: ActivationSource = manualOverride ? "manual" : isOffline ? "offline" : isLowBattery ? "battery" : null;

  return (
    <EmergencyModeContext.Provider value={{ active, source, batterySupported, toggleManual }}>
      {children}
    </EmergencyModeContext.Provider>
  );
}

export function useEmergencyMode() {
  const ctx = useContext(EmergencyModeContext);
  if (!ctx) throw new Error("useEmergencyMode must be used within EmergencyModeProvider");
  return ctx;
}

/** Single low-accuracy position fetch — the low-power replacement for continuous watchPosition. */
export function getSinglePositionLowPower(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 15000 }
    );
  });
}
