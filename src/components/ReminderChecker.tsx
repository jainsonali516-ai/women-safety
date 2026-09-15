"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { T } from "@/components/Translated";

interface Reminder {
  id: string;
  label: string;
  time_of_day: string;
  days_of_week: number[];
  enabled: boolean;
}

const CHECK_INTERVAL_MS = 20_000;
const FIRED_KEY_PREFIX = "herlane-reminder-fired";

function todayKey(reminderId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-date-ish is fine for a once-a-day guard
  return `${FIRED_KEY_PREFIX}:${reminderId}:${today}`;
}

/**
 * Nothing in this app was ever actually watching the clock against saved reminders — they sat in
 * the database and the "alarm" simply never fired. This runs globally (mounted once in the root
 * layout) while any tab is open, polling every 20s for a reminder whose time and day match right
 * now, and — since the Reminders UI promises "you will always be asked for consent before
 * anything is sent" — surfaces a dismissible prompt rather than silently sending a location.
 *
 * Known limitation, and there isn't a way around it without standing up real Web Push (VAPID keys,
 * a push-subscription table, a server-side cron) instead of this client-side timer: this only
 * fires while a HerLane tab is open somewhere, not if the browser is fully closed.
 */
export function ReminderChecker() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [due, setDue] = useState<Reminder | null>(null);
  const duplicateGuardRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/reminders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.reminders) setReminders(data.reminders);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || reminders.length === 0) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const tick = () => {
      const now = new Date();
      const day = now.getDay();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      for (const reminder of reminders) {
        if (!reminder.enabled) continue;
        if (!reminder.days_of_week.includes(day)) continue;
        if (reminder.time_of_day.slice(0, 5) !== hhmm) continue;

        const key = todayKey(reminder.id);
        if (duplicateGuardRef.current.has(key)) continue;
        let alreadyFired = false;
        try {
          alreadyFired = localStorage.getItem(key) === "1";
        } catch {
          /* localStorage unavailable — worst case this fires more than once today */
        }
        if (alreadyFired) continue;

        duplicateGuardRef.current.add(key);
        try {
          localStorage.setItem(key, "1");
        } catch {
          /* not fatal — the in-memory guard above still prevents an immediate repeat */
        }

        setDue(reminder);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("HerLane", { body: `${reminder.label} — tap HerLane to share your location`, tag: "herlane-reminder" });
        }
        break; // one prompt at a time — if two reminders land on the same minute, the next tick picks up the other
      }
    };

    tick();
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, reminders]);

  if (!due) return null;
  return <ReminderPrompt reminder={due} onClose={() => setDue(null)} />;
}

function ReminderPrompt({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "sharing" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function shareNow() {
    setStatus("sharing");
    setErrorMessage(null);
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch("/api/location/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          });
          const data = await res.json();
          if (!res.ok) {
            setStatus("error");
            setErrorMessage(data.error ?? "Failed to share location");
            return;
          }
          setStatus("done");
        } catch {
          setStatus("error");
          setErrorMessage("Network error while sharing your location.");
        }
      },
      () => {
        setStatus("error");
        setErrorMessage("Couldn't get your location. Check your GPS/network and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div
      className="card"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "1.5rem",
        width: "min(360px, calc(100vw - 2rem))",
        padding: "1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        zIndex: 2100,
        // The shared .card background is a translucent "glass" surface, which reads fine over
        // mostly-empty space but let a busy photo/gradient background show through too much on a
        // floating alert like this one — same fix as the chat widget's panel: fully opaque instead.
        background: "var(--surface)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        border: "1px solid var(--accent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <MapPin size={18} color="var(--accent)" />
          <strong style={{ fontSize: "0.95rem" }}>
            <T>{reminder.label}</T>
          </strong>
        </div>
        <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground-muted)" }}>
          <X size={16} />
        </button>
      </div>

      {status === "done" ? (
        <p style={{ fontSize: "0.85rem", color: "var(--accent-strong)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Check size={15} /> <T>Location shared.</T>
        </p>
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
            <T>{"It's time for your scheduled location share. Share now, or dismiss if you don't need to."}</T>
          </p>
          {status === "error" && errorMessage && (
            <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>
              <T>{errorMessage}</T>
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={shareNow}
              disabled={status === "sharing"}
              className="btn-accent"
              style={{ flex: 1, padding: "0.6rem", borderRadius: "0.6rem", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: status === "sharing" ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
            >
              {status === "sharing" ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              <T>{status === "sharing" ? "Sharing..." : "Share Now"}</T>
            </button>
            <button
              onClick={onClose}
              style={{ padding: "0.6rem 0.9rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
            >
              <T>Dismiss</T>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
