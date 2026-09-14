"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Radio, WifiOff, Square, BatteryLow, Copy, Check, MessageCircle, Share2, UserPlus } from "lucide-react";
import { enqueuePing, flushQueue, readQueue } from "@/lib/offlineQueue";
import { useEmergencyMode, getSinglePositionLowPower } from "@/components/EmergencyModeProvider";

const LOW_POWER_POLL_INTERVAL_MS = 5 * 60 * 1000; // one-shot fix every 5 min instead of continuous GPS

interface Contact {
  id: string;
  name: string;
  phone: string;
}

export function SosTracker() {
  const { active: lowPower } = useEmergencyMode();
  const [alertId, setAlertId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lowPowerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertIdRef = useRef<string | null>(null);
  // Mobile browsers throttle or fully pause GPS watching once the screen locks or the tab goes
  // to the background — that's why a tracking session can silently stop updating even though it
  // still shows "Active". The Wake Lock API keeps the screen on while tracking, which is the only
  // thing a website (not a native app) can do to reduce that throttling — it doesn't help once the
  // user switches to a different app, only screen-lock.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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

  // Reopening this page (a reload, a new tab, coming back later) used to always show "Start
  // Tracking" even while an alert was still active server-side — there was no way to get back to
  // its share link or stop it short of letting it expire. Resume the in-progress session instead.
  useEffect(() => {
    async function resumeActiveTracking() {
      try {
        const res = await fetch("/api/sos/active");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.alert) return;
        setAlertId(data.alert.id);
        alertIdRef.current = data.alert.id;
        beginTracking(data.alert.id);
        const contactsRes = await fetch("/api/contacts");
        if (contactsRes.ok) setContacts((await contactsRes.json()).contacts);
      } catch {
        /* not fatal — worst case the user just sees "Start Tracking" and can start a new one */
      }
    }
    resumeActiveTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
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
    releaseWakeLock();
  }

  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      /* not fatal — e.g. denied, or battery saver is on. Tracking still runs, just more likely to be throttled. */
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  // A wake lock is automatically released the moment the tab is hidden, and browsers don't
  // re-acquire it for you — this re-requests it the moment the user comes back to the tab, so
  // switching apps briefly and returning doesn't leave tracking without a wake lock indefinitely.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && alertIdRef.current && !lowPower) {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [lowPower]);

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
    else {
      beginContinuousWatch(id);
      acquireWakeLock(); // low-power mode already polls infrequently by design, so it doesn't need the screen kept on
    }
  }

  // If low-power mode toggles on/off mid-tracking, switch strategy without stopping the alert.
  useEffect(() => {
    if (!alertIdRef.current) return;
    clearAllPositioning();
    beginTracking(alertIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the power mode itself flips
  }, [lowPower]);

  function getPositionOnce(options: PositionOptions): Promise<{ position: GeolocationPosition | null; errorCode: number | null }> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ position, errorCode: null }),
        (err) => resolve({ position: null, errorCode: err.code }),
        options
      );
    });
  }

  async function getPositionWithReason(): Promise<{ position: GeolocationPosition | null; errorCode: number | null }> {
    // A phone's first *high-accuracy* GPS fix (cold start) can genuinely take 15-20s, especially
    // indoors — that wait was making "Start Tracking" feel unresponsive. The continuous watch that
    // begins right after this already upgrades to a precise fix within seconds, so the very first
    // ping doesn't need to be perfect: try a fast, coarse (network/cell-based) fix first, and only
    // fall back to the slow high-accuracy request if that genuinely fails.
    const fast = await getPositionOnce({ enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
    if (fast.position) return fast;
    return getPositionOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }

  function messageForLocationError(errorCode: number | null): string {
    if (errorCode === 1) return "Location permission denied — enable location access for this site and try again.";
    if (errorCode === 3) return "Getting your location is taking too long. Try again, ideally outdoors or near a window.";
    if (errorCode === 2) return "Couldn't get your location. Check your GPS/network and try again.";
    return "Location permission denied.";
  }

  async function startTracking() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setStarting(true);
    try {
      if (lowPower) {
        const position = await getSinglePositionLowPower();
        if (!position) {
          setError("Couldn't get your location. Check your GPS/network and try again.");
          return;
        }
        await submitStart(position);
      } else {
        const { position, errorCode } = await getPositionWithReason();
        if (!position) {
          setError(messageForLocationError(errorCode));
          return;
        }
        await submitStart(position);
      }
    } finally {
      setStarting(false);
    }
  }

  async function submitStart(position: GeolocationPosition) {
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
      // /api/sos already looked these up (scoped to this session's user_id) to build its
      // notified_contacts response — reusing that instead of a second /api/contacts round trip.
      setContacts(data.notified_contacts ?? []);
    } catch {
      setError("Network error while starting tracking.");
    }
  }

  function trackingUrl(id: string) {
    return `${window.location.origin}/track/${id}`;
  }

  async function copyTrackingLink() {
    if (!alertId) return;
    try {
      await navigator.clipboard.writeText(trackingUrl(alertId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — link is still visible/copyable by hand */
    }
  }

  function trackingMessage(id: string) {
    return `TULIP: I've started live journey tracking — watch my location here: ${trackingUrl(id)}`;
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
    setContacts([]);
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
          disabled={starting}
          className="btn-accent"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.7rem 1.1rem",
            borderRadius: "0.75rem",
            fontWeight: 600,
            border: "none",
            cursor: starting ? "wait" : "pointer",
            opacity: starting ? 0.7 : 1,
          }}
        >
          <Radio size={16} /> {starting ? "Getting your location..." : "Start Tracking"}
        </button>
      ) : (
        <button
          onClick={stopTracking}
          className="btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.7rem 1.1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Square size={16} /> Stop Tracking
        </button>
      )}

      {alertId && !lowPower && (
        <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)", marginTop: "0.6rem" }}>
          Keep this tab open and your screen on for location updates to keep flowing — phones pause
          GPS in background tabs and when the screen locks, so a stale &quot;last updated&quot; time
          usually means one of those, not a technical failure.
        </p>
      )}

      {alertId && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.9rem",
            borderRadius: "0.75rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          <p style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", fontWeight: 700, color: "#ef4444" }}>
            <Share2 size={15} /> Notify your trusted contacts now
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
            Tracking doesn&apos;t notify anyone by itself — tap SMS or WhatsApp below to actually send each contact
            the live link, which updates automatically until you stop tracking.
          </p>

          {contacts.length === 0 ? (
            <div className="empty-state" style={{ background: "var(--background-solid)" }}>
              <UserPlus size={20} />
              No trusted contacts saved yet — add one so there&apos;s someone to notify.
              <Link href="/contacts" style={{ fontWeight: 700, color: "var(--accent-strong)" }}>
                Add a contact
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {contacts.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{c.name}</span>
                  <span style={{ display: "flex", gap: "0.4rem" }}>
                    <a
                      href={`sms:${c.phone}?body=${encodeURIComponent(trackingMessage(alertId))}`}
                      className="icon-btn"
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0.7rem" }}
                    >
                      Text via SMS
                    </a>
                    <a
                      href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(trackingMessage(alertId))}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.78rem",
                        padding: "0.4rem 0.7rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #25d366",
                        color: "#25d366",
                      }}
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.3rem", borderTop: "1px solid var(--border)" }}>
            <a
              href={trackingUrl(alertId)}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.75rem" }}
            >
              Open link
            </a>
            <button
              onClick={copyTrackingLink}
              className="icon-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.8rem",
                padding: "0.45rem 0.75rem",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
