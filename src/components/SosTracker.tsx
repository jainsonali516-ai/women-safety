"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, WifiOff, Square } from "lucide-react";
import { enqueuePing, flushQueue, readQueue } from "@/lib/offlineQueue";

export function SosTracker() {
  const [alertId, setAlertId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

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

  async function startTracking() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
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
          beginWatch(data.alert.id);
        } catch {
          setError("Network error while starting tracking.");
        }
      },
      () => setError("Location permission denied."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function beginWatch(id: string) {
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
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
      },
      () => setError("Lost GPS signal — will keep retrying."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }

  async function stopTracking() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (alertId) {
      await fetch(`/api/sos/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      }).catch(() => {});
    }
    await flushQueue();
    setAlertId(null);
    setCachedCount(readQueue().length);
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Live Journey Tracking</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.9rem" }}>
        Pings your location periodically while active. If your connection drops, pings are cached on your device and
        sent automatically once you&apos;re back online.
      </p>

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
