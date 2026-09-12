"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, WifiOff, Square, BatteryLow } from "lucide-react";
import { enqueuePing, flushQueue, readQueue } from "@/lib/offlineQueue";
import { useEmergencyMode, getSinglePositionLowPower } from "@/components/EmergencyModeProvider";

const LOW_POWER_POLL_INTERVAL_MS = 5 * 60 * 1000; // one-shot fix every 5 min instead of continuous GPS

export function SosTracker() {
  const { active: lowPower } = useEmergencyMode();
  const [alertId, setAlertId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lowPowerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertIdRef = useRef<string | null>(null);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!navigator.onLine);
    }
    updateOnlineStatus();

    async function handleOnline() {
      setIsOffline(false);
      const { synced } = await flushQueue();
      if (synced > 0) setCachedCount(readQueue().length);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function reportPosition(id: string, latitude: number, longitude: number) {
    if (!navigator.onLine) {
      enqueuePing({ alertId: id, latitude, longitude, timestamp: Date.now() });
      setCachedCount(readQueue().length);
      return;
    }
    try {
      const res = await fetch(`/api/sos/${id}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      if (!res.ok) {
        enqueuePing({ alertId: id, latitude, longitude, timestamp: Date.now() });
        setCachedCount(readQueue().length);
      }
    } catch {
      enqueuePing({ alertId: id, latitude, longitude, timestamp: Date.now() });
      setCachedCount(readQueue().length);
    }
  }

  function clearAllPositioning() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (lowPowerIntervalRef.current !== null) clearInterval(lowPowerIntervalRef.current);
    lowPowerIntervalRef.current = null;
  }

  function beginContinuousWatch(id: string) {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => reportPosition(id, position.coords.latitude, position.coords.longitude),
      () => setError("Lost GPS signal — will keep retrying."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }

  function beginLowPowerPolling(id: string) {
    const poll = async () => {
      const pos = await getSinglePositionLowPower();
      if (pos) reportPosition(id, pos.coords.latitude, pos.coords.longitude);
    };
    poll();
    lowPowerIntervalRef.current = setInterval(poll, LOW_POWER_POLL_INTERVAL_MS);
  }

  function beginTracking(id: string) {
    if (lowPower) beginLowPowerPolling(id);
    else beginContinuousWatch(id);
  }

  // If low-power mode toggles on/off mid-tracking, switch strategy without stopping the alert.
  useEffect(() => {
    if (!alertIdRef.current) return;
    clearAllPositioning();
    beginTracking(alertIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the power mode itself flips
  }, [lowPower]);

  async function startTracking() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    const getPosition = lowPower
      ? getSinglePositionLowPower
      : () =>
          new Promise<GeolocationPosition | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000 });
          });

    const position = await getPosition();
    if (!position) {
      setError("Location permission denied.");
      return;
    }

    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          message: "Live journey tracking started",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start tracking");
        return;
      }
      setAlertId(data.alert.id);
      alertIdRef.current = data.alert.id;
      beginTracking(data.alert.id);
    } catch {
      setError("Network error while starting tracking.");
    }
  }

  async function stopTracking() {
    clearAllPositioning();
    if (alertId) {
      await fetch(`/api/sos/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      }).catch(() => {});
    }
    await flushQueue();
    setAlertId(null);
    alertIdRef.current = null;
    setCachedCount(readQueue().length);
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Live Journey Tracking</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.9rem" }}>
        Pings your location periodically while active. If your connection drops, pings are cached on your device and
        sent automatically once you&apos;re back online.
      </p>

      {lowPower && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.8rem",
            borderRadius: "0.6rem",
            background: "rgba(59, 130, 246, 0.15)",
            color: "#3b82f6",
            fontSize: "0.8rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          <BatteryLow size={14} /> Low Power Mode — checking position every 5 min instead of continuously
        </div>
      )}

      {isOffline && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 0.8rem",
            borderRadius: "0.6rem",
            background: "rgba(234, 179, 8, 0.15)",
            color: "#b45309",
            fontSize: "0.8rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          <WifiOff size={14} /> Offline Mode — Route Cached Locally {cachedCount > 0 ? `(${cachedCount} pending)` : ""}
        </div>
      )}

      {error && <p style={{ fontSize: "0.85rem", color: "#ef4444", marginBottom: "0.6rem" }}>{error}</p>}

      {!alertId ? (
        <button
          onClick={startTracking}
          className="btn-accent"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1.1rem", borderRadius: "0.75rem", fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          <Radio size={16} /> Start Tracking
        </button>
      ) : (
        <button
          onClick={stopTracking}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.7rem 1.1rem",
            borderRadius: "0.75rem",
            fontWeight: 600,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
            cursor: "pointer",
          }}
        >
          <Square size={16} /> Stop Tracking
        </button>
      )}
    </div>
  );
}
