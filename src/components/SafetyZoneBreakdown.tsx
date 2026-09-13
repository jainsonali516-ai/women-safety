"use client";

import { useState } from "react";
import { ChevronDown, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { MapPoint } from "@/components/SafetyMapContainer";

interface RouteZoneSafety {
  zoneId: string;
  zoneName: string;
  safetyScore: number;
  status: "Safe" | "Moderate" | "Caution";
  neonColorHex: string;
  description: string;
  riskFactors: string[];
  safetyFeatures: string[];
  latitude: number;
  longitude: number;
}

export function SafetyZoneBreakdown({ origin, destination }: { origin: MapPoint; destination: MapPoint }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<RouteZoneSafety[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !zones && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/routes/zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load zone breakdown");
        setZones(data.zones);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load zone breakdown");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="card" style={{ padding: "1rem" }}>
      <button
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--foreground)",
          fontWeight: 700,
          fontSize: "0.9rem",
          padding: 0,
        }}
      >
        Safety Zone Breakdown
        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>

      {open && (
        <div style={{ marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {loading && (
            <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Loader2 size={14} className="animate-spin" /> Scoring the route in 3 stretches using live free map data — this can take up to 30-40s when that service is busy.
            </p>
          )}
          {error && <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>{error}</p>}
          {zones?.map((z) => (
            <div
              key={z.zoneId}
              style={{
                borderLeft: `4px solid ${z.neonColorHex}`,
                paddingLeft: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.85rem" }}>{z.zoneName}</strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    color: "#0a0a0a",
                    background: z.neonColorHex,
                    boxShadow: `0 0 8px ${z.neonColorHex}99`,
                  }}
                >
                  {z.status.toUpperCase()} — {z.safetyScore}/100
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{z.description}</p>
              {z.safetyFeatures.length > 0 && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {z.safetyFeatures.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#22c55e" }}>
                      <CheckCircle2 size={12} /> {f}
                    </li>
                  ))}
                </ul>
              )}
              {z.riskFactors.length > 0 && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {z.riskFactors.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#f97316" }}>
                      <AlertTriangle size={12} /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
