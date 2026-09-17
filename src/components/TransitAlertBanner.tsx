"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { T } from "@/components/Translated";

interface TransitAlert {
  headline: string;
  description: string;
  url: string;
  sourceName: string;
  mode: "metro" | "bus" | "general";
}

const MODE_NOTE: Record<TransitAlert["mode"], string> = {
  bus: "Bus routes may be affected — Metro is a safer bet right now.",
  metro: "Metro services may be affected.",
  general: "Some routes in Delhi NCR may be affected.",
};

// Matches the server-side cache TTL in lib/transitAlerts.ts — polling more often than that would
// just re-fetch the same cached result, and a strike ending/starting shouldn't take longer than
// this to reflect for someone who leaves the page open.
const POLL_INTERVAL_MS = 20 * 60 * 1000;

/**
 * A live news search for a current (last 3 days) Delhi NCR transit disruption — a strike, rally,
 * or road closure. Renders nothing at all if NEWS_API_KEY isn't configured or nothing recent
 * enough was found (see lib/transitAlerts.ts) — never a stale placeholder pretending to be live.
 * Always links back to the actual source article, since this is a news search result, not an
 * official DMRC/DTC advisory.
 */
export function TransitAlertBanner() {
  const [alert, setAlert] = useState<TransitAlert | null>(null);

  useEffect(() => {
    function fetchAlert() {
      fetch("/api/transit-alerts")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setAlert(data?.alert ?? null))
        .catch(() => {});
    }
    fetchAlert();
    const interval = setInterval(fetchAlert, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!alert) return null;

  return (
    <div
      className="card"
      style={{
        padding: "0.9rem 1.1rem",
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
        border: "1px solid var(--accent-amber)",
        background: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
      }}
    >
      <AlertTriangle size={18} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: "0.15rem" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 0 }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-amber)" }}>
          <T>Transit Disruption Reported</T>
        </p>
        <p style={{ fontSize: "0.88rem", color: "var(--foreground)", fontWeight: 700, lineHeight: 1.4 }}>
          <T>{alert.headline}</T>
        </p>
        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
          <T>{MODE_NOTE[alert.mode]}</T>
        </p>
        <a
          href={alert.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "0.74rem", color: "var(--accent-strong)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
        >
          <T>Source</T>: {alert.sourceName} <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
