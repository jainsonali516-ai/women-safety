"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueJourneyPing, flushJourneyQueue } from "@/lib/journeyLocationQueue";

// Plain localStorage keys, not a single JSON blob — lets any one field be read/cleared
// independently and matches the exact field names requested (journey_active, journey_start_time,
// journey_eta_timestamp) for anyone inspecting storage directly.
const KEYS = {
  active: "journey_active",
  startTime: "journey_start_time",
  eta: "journey_eta_timestamp",
  origin: "journey_origin",
  destination: "journey_destination",
  // Extension for the server-synced Journey Risk Index pipeline — the server-side journey row's
  // id (see /api/journey/start), and a local mirror of the missed-checkin count so the UI/risk
  // calc has it immediately without waiting on a round-trip. Both are additive: a journey with
  // no journeyId (e.g. the server call failed, or the user isn't signed in) still runs exactly
  // as the original client-only timer always did.
  journeyId: "journey_id",
  originLat: "journey_origin_lat",
  originLng: "journey_origin_lng",
  destinationLat: "journey_destination_lat",
  destinationLng: "journey_destination_lng",
  missedCheckins: "journey_missed_checkins",
} as const;

export interface JourneyTimerState {
  active: boolean;
  startTime: number | null;
  etaTimestamp: number | null;
  origin: string;
  destination: string;
  journeyId: string | null;
  originCoords: { latitude: number; longitude: number } | null;
  destinationCoords: { latitude: number; longitude: number } | null;
  missedCheckins: number;
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
  journeyId: null,
  originCoords: null,
  destinationCoords: null,
  missedCheckins: 0,
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
    const originLat = Number(localStorage.getItem(KEYS.originLat));
    const originLng = Number(localStorage.getItem(KEYS.originLng));
    const destLat = Number(localStorage.getItem(KEYS.destinationLat));
    const destLng = Number(localStorage.getItem(KEYS.destinationLng));
    return {
      active: true,
      startTime,
      etaTimestamp,
      origin: localStorage.getItem(KEYS.origin) ?? "",
      destination: localStorage.getItem(KEYS.destination) ?? "",
      journeyId: localStorage.getItem(KEYS.journeyId),
      originCoords: originLat && originLng ? { latitude: originLat, longitude: originLng } : null,
      destinationCoords: destLat && destLng ? { latitude: destLat, longitude: destLng } : null,
      missedCheckins: Number(localStorage.getItem(KEYS.missedCheckins)) || 0,
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

  /**
   * Starts the local timer exactly as before, then — best-effort, additive — tries to create a
   * matching journey row on the server so the Journey Risk Index pipeline can evaluate it even if
   * this tab closes. If the user is logged out, offline, or the call fails for any reason, the
   * local-only timer still runs precisely as it always has; journeyId just stays null.
   */
  const startJourney = useCallback(
    (
      origin: string,
      destination: string,
      durationMinutes: number,
      coords?: {
        originLat?: number;
        originLng?: number;
        destinationLat?: number;
        destinationLng?: number;
      }
    ) => {
      const now = Date.now();
      const eta = now + durationMinutes * 60 * 1000;
      try {
        localStorage.setItem(KEYS.active, "true");
        localStorage.setItem(KEYS.startTime, String(now));
        localStorage.setItem(KEYS.eta, String(eta));
        localStorage.setItem(KEYS.origin, origin);
        localStorage.setItem(KEYS.destination, destination);
        localStorage.setItem(KEYS.missedCheckins, "0");
        if (coords?.originLat != null) localStorage.setItem(KEYS.originLat, String(coords.originLat));
        if (coords?.originLng != null) localStorage.setItem(KEYS.originLng, String(coords.originLng));
        if (coords?.destinationLat != null) localStorage.setItem(KEYS.destinationLat, String(coords.destinationLat));
        if (coords?.destinationLng != null) localStorage.setItem(KEYS.destinationLng, String(coords.destinationLng));
      } catch {
        /* storage unavailable — the in-memory state below still drives this session's UI */
      }
      refresh();

      fetch("/api/journey/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLabel: origin,
          destinationLabel: destination,
          etaMinutes: durationMinutes,
          originLat: coords?.originLat,
          originLng: coords?.originLng,
          destinationLat: coords?.destinationLat,
          destinationLng: coords?.destinationLng,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const id = data?.journey?.id;
          if (!id) return;
          try {
            localStorage.setItem(KEYS.journeyId, id);
          } catch {
            /* ignore */
          }
          refresh();
        })
        .catch(() => {
          /* not logged in / offline / server error — local-only timer keeps working regardless */
        });
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
      const missed = current.missedCheckins + 1;
      try {
        localStorage.setItem(KEYS.eta, String(newEta));
        localStorage.setItem(KEYS.missedCheckins, String(missed));
      } catch {
        /* ignore */
      }
      refresh();

      if (current.journeyId) {
        fetch(`/api/journey/${current.journeyId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "extend", extendMinutes: extraMinutes }),
        }).catch(() => {
          /* server sync failed — local extension already applied above */
        });
      }
      return newEta;
    },
    [refresh]
  );

  const endJourney = useCallback(() => {
    const current = readState();
    if (current.journeyId) {
      fetch(`/api/journey/${current.journeyId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "safe" }),
      }).catch(() => {
        /* server sync failed — local state is cleared below regardless */
      });
    }
    try {
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
    setState(INACTIVE);
  }, []);

  // While a journey is active, watch GPS position and sync each fix to the server so the Journey
  // Risk Index has real movement/last-known-location data to evaluate — even if this tab is later
  // closed. Offline pings are queued locally (journeyLocationQueue) and flushed on reconnect, per
  // the "never claim the backend has a newer location than it actually received" requirement.
  useEffect(() => {
    if (!state.active || !state.journeyId || typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const journeyId = state.journeyId;

    function syncPosition(latitude: number, longitude: number, timestamp: number) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueJourneyPing({ journeyId, latitude, longitude, timestamp });
        return;
      }
      fetch(`/api/journey/${journeyId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, recordedAt: timestamp }),
      }).catch(() => {
        enqueueJourneyPing({ journeyId, latitude, longitude, timestamp });
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        syncPosition(position.coords.latitude, position.coords.longitude, position.timestamp);
      },
      () => {
        /* permission denied / unavailable — risk evaluation just falls back to fewer signals */
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    function onOnline() {
      flushJourneyQueue().catch(() => {
        /* ignore */
      });
    }
    window.addEventListener("online", onOnline);
    onOnline();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener("online", onOnline);
    };
  }, [state.active, state.journeyId]);

  return { ...state, startJourney, extendJourney, endJourney };
}
