"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Plain localStorage keys, not a single JSON blob — lets any one field be read/cleared
// independently and matches the exact field names requested (journey_active, journey_start_time,
// journey_eta_timestamp) for anyone inspecting storage directly.
const KEYS = {
  active: "journey_active",
  startTime: "journey_start_time",
  eta: "journey_eta_timestamp",
  origin: "journey_origin",
  destination: "journey_destination",
} as const;

export interface JourneyTimerState {
  active: boolean;
  startTime: number | null;
  etaTimestamp: number | null;
  origin: string;
  destination: string;
  /** etaTimestamp - now, recomputed from the stored target timestamp every tick — never a
   * counted-down-in-memory value, so it can't drift or freeze while the tab is backgrounded. */
  remainingMs: number;
  isExpired: boolean;
}

const INACTIVE: JourneyTimerState = {
  active: false,
  startTime: null,
  etaTimestamp: null,
  origin: "",
  destination: "",
  remainingMs: 0,
  isExpired: false,
};

function readState(): JourneyTimerState {
  if (typeof window === "undefined") return INACTIVE;
  try {
    if (localStorage.getItem(KEYS.active) !== "true") return INACTIVE;
    const startTime = Number(localStorage.getItem(KEYS.startTime));
    const etaTimestamp = Number(localStorage.getItem(KEYS.eta));
    if (!startTime || !etaTimestamp) return INACTIVE;
    const remainingMs = etaTimestamp - Date.now();
    return {
      active: true,
      startTime,
      etaTimestamp,
      origin: localStorage.getItem(KEYS.origin) ?? "",
      destination: localStorage.getItem(KEYS.destination) ?? "",
      remainingMs,
      isExpired: remainingMs <= 0,
    };
  } catch {
    // Private-browsing/storage-disabled — the check-in feature just can't persist; treat as off.
    return INACTIVE;
  }
}

/**
 * Client-side, localStorage-backed journey check-in timer. Nothing here ever reaches a server —
 * it's purely this browser's own storage, recomputed from the stored target timestamp (not
 * counted down in memory) on a 1s tick AND on visibilitychange/focus, so unlocking the phone
 * after the tab was backgrounded/throttled snaps straight to the correct remaining time instead
 * of a frozen or drifted one.
 */
export function useJourneyTimer() {
  const [state, setState] = useState<JourneyTimerState>(INACTIVE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setState(readState()), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate one-time read of localStorage after mount (SSR has no window/localStorage), not state synchronization
    refresh();
    intervalRef.current = setInterval(refresh, 1000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const startJourney = useCallback(
    (origin: string, destination: string, durationMinutes: number) => {
      const now = Date.now();
      const eta = now + durationMinutes * 60 * 1000;
      try {
        localStorage.setItem(KEYS.active, "true");
        localStorage.setItem(KEYS.startTime, String(now));
        localStorage.setItem(KEYS.eta, String(eta));
        localStorage.setItem(KEYS.origin, origin);
        localStorage.setItem(KEYS.destination, destination);
      } catch {
        /* storage unavailable — the in-memory state below still drives this session's UI */
      }
      refresh();
    },
    [refresh]
  );

  /** Extends from the current target time (or from now, if it already passed) — returns the new
   * timestamp so the caller can put it straight into a WhatsApp message without a second read. */
  const extendJourney = useCallback(
    (extraMinutes: number) => {
      const current = readState();
      const base = current.etaTimestamp && current.etaTimestamp > Date.now() ? current.etaTimestamp : Date.now();
      const newEta = base + extraMinutes * 60 * 1000;
      try {
        localStorage.setItem(KEYS.eta, String(newEta));
      } catch {
        /* ignore */
      }
      refresh();
      return newEta;
    },
    [refresh]
  );

  const endJourney = useCallback(() => {
    try {
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
    setState(INACTIVE);
  }, []);

  return { ...state, startJourney, extendJourney, endJourney };
}
