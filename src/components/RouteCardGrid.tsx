"use client";

import { useState } from "react";
import { ChevronDown, Clock, IndianRupee, Navigation, AlertTriangle, ExternalLink } from "lucide-react";
import { RISK_TIER_COLOR } from "@/lib/riskTier";
import { TulipBloom } from "@/components/TulipBloom";

export interface RouteOption {
  mode: string;
  label: string;
  duration_min: number;
  fare_inr: number;
  safety_score: number;
  rush_score: number;
  final_score: number;
  risk_tier: "high" | "mid_high" | "mid_low" | "safe";
  risk_label: string;
  risk_alert: string;
  deep_link?: string;
  web_link?: string;
  why: { safety: string; cost: string; speed: string };
}

const TIER_STYLE: Record<RouteOption["risk_tier"], { bg: string; fg: string }> = {
  high: { bg: RISK_TIER_COLOR.high, fg: "white" },
  mid_high: { bg: RISK_TIER_COLOR.mid_high, fg: "white" },
  mid_low: { bg: RISK_TIER_COLOR.mid_low, fg: "#3f2d00" },
  safe: { bg: RISK_TIER_COLOR.safe, fg: "white" },
};

export function RouteCardGrid({ options }: { options: RouteOption[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (options.length === 0) {
    return <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>No routes match the selected filters.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
      {options.map((opt) => {
        const tierStyle = TIER_STYLE[opt.risk_tier];
        const isOpen = expanded === opt.mode;
        return (
          <div key={opt.mode} className="card route-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
              <strong style={{ fontSize: "0.95rem", flex: 1, minWidth: 0 }}>{opt.label}</strong>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  padding: "0.25rem 0.55rem",
                  borderRadius: "999px",
                  background: tierStyle.bg,
                  color: tierStyle.fg,
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  boxShadow: `0 0 10px ${tierStyle.bg}99`,
                  flexShrink: 0,
                }}
              >
                {opt.risk_label}
              </span>
            </div>

            {opt.risk_tier === "high" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", fontWeight: 700, color: "#ef4444" }}>
                <AlertTriangle size={13} /> {opt.risk_alert}
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--foreground-muted)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Clock size={14} /> {opt.duration_min} min
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <IndianRupee size={14} /> {opt.fare_inr}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }} title="A more open bloom means a higher safety score">
                <TulipBloom
                  size={18}
                  openness={opt.safety_score / 100}
                  color={tierStyle.bg}
                  centerColor={tierStyle.bg}
                  title={`Safety score ${opt.safety_score} of 100`}
                />
                Safety {opt.safety_score}
              </span>
            </div>

            <button
              onClick={() => setExpanded(isOpen ? null : opt.mode)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "var(--accent-strong)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                alignSelf: "flex-start",
              }}
            >
              Why this route? <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
            </button>

            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.78rem", color: "var(--foreground-muted)", background: "var(--background-solid)", padding: "0.75rem", borderRadius: "0.6rem", border: "1px solid var(--border)" }}>
                <p><strong style={{ color: "var(--foreground)" }}>Safety:</strong> {opt.why.safety}</p>
                <p><strong style={{ color: "var(--foreground)" }}>Cost:</strong> {opt.why.cost}</p>
                <p><strong style={{ color: "var(--foreground)" }}>Speed:</strong> {opt.why.speed}</p>
                {(opt.mode === "metro" || opt.mode === "bus") && (
                  <p style={{ paddingTop: "0.3rem", borderTop: "1px solid var(--border)" }}>
                    <strong style={{ color: "var(--foreground)" }}>Line / platform / interchange details:</strong> not
                    available here — Delhi Metro and DTC don&apos;t publish a public real-time feed for this. Use the{" "}
                    <a
                      href={opt.mode === "metro" ? "https://www.delhimetrorail.com" : "https://dtc.delhi.gov.in"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent-strong)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                    >
                      official {opt.mode === "metro" ? "DMRC" : "DTC"} app/site <ExternalLink size={11} />
                    </a>{" "}
                    for exact line, platform, and direction.
                  </p>
                )}
              </div>
            )}

            {opt.deep_link && (
              <a
                href={opt.web_link}
                target="_blank"
                rel="noreferrer"
                className="btn-accent"
                style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", borderRadius: "0.6rem", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <Navigation size={14} /> Book {opt.label}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
