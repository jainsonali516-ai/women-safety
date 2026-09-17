"use client";

import { useState } from "react";
import { ChevronDown, Clock, IndianRupee, Navigation, AlertTriangle, Map as MapIcon, ListTree } from "lucide-react";
import { RISK_TIER_COLOR } from "@/lib/riskTier";
import { TulipBloom } from "@/components/TulipBloom";
import { T } from "@/components/Translated";
import { dispatchAskAlly, buildAskAllyQuery } from "@/lib/askAlly";
import { MetroJourneyPanel } from "@/components/MetroJourneyPanel";

/** Groups the app's granular booking modes into the four map-route categories used by
 * "View on Map" — Uber/Ola both draw the same real road route, e.g., just styled per-provider. */
export type MapRouteCategory = "car" | "auto" | "metro" | "bus";

export function mapRouteCategoryFor(mode: string): MapRouteCategory | null {
  if (mode === "cab_uber" || mode === "cab_ola") return "car";
  if (mode === "auto" || mode === "e_rickshaw") return "auto";
  if (mode === "metro") return "metro";
  if (mode === "bus") return "bus";
  return null;
}

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
  /** Real Delhi Metro line name(s) near origin/destination, from OSM's own subway route
   * relations — undefined when OSM simply doesn't have enough line data here, not a guess. */
  line_info?: string;
  line_colors?: string[];
  why: { safety: string; cost: string; speed: string };
}

const TIER_STYLE: Record<RouteOption["risk_tier"], { bg: string; fg: string }> = {
  high: { bg: RISK_TIER_COLOR.high, fg: "white" },
  mid_high: { bg: RISK_TIER_COLOR.mid_high, fg: "white" },
  mid_low: { bg: RISK_TIER_COLOR.mid_low, fg: "#3f2d00" },
  safe: { bg: RISK_TIER_COLOR.safe, fg: "white" },
};

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  options: RouteOption[];
  originLabel?: string;
  destinationLabel?: string;
  originPoint?: LatLng | null;
  destinationPoint?: LatLng | null;
  activeMapMode?: string | null;
  onViewOnMap?: (option: RouteOption, category: MapRouteCategory) => void;
}

export function RouteCardGrid({ options, originLabel, destinationLabel, originPoint, destinationPoint, activeMapMode, onViewOnMap }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [metroDetailsOpen, setMetroDetailsOpen] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
        <T>No routes match the selected filters.</T>
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
      {options.map((opt) => {
        const tierStyle = TIER_STYLE[opt.risk_tier];
        const isOpen = expanded === opt.mode;
        const category = mapRouteCategoryFor(opt.mode);
        const isActiveOnMap = activeMapMode === opt.mode;
        return (
          <div
            key={opt.mode}
            className="card route-card"
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              border: isActiveOnMap ? "2px solid var(--accent-strong)" : undefined,
              boxShadow: isActiveOnMap ? "0 0 0 3px color-mix(in srgb, var(--accent-strong) 25%, transparent)" : undefined,
            }}
          >
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
                <T>{opt.risk_label}</T>
              </span>
            </div>

            {opt.risk_tier === "high" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", fontWeight: 700, color: "#ef4444" }}>
                <AlertTriangle size={13} /> <T>{opt.risk_alert}</T>
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--foreground-muted)", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Clock size={14} /> {opt.duration_min} <T>min</T>
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
                <T>Safety</T> {opt.safety_score}
              </span>
            </div>

            {opt.line_info && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                {opt.line_colors?.map((color, i) => (
                  <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, border: "1px solid rgba(255,255,255,0.3)" }} />
                ))}
                <span style={{ fontSize: "0.76rem", color: "var(--foreground-muted)", fontWeight: 600 }}>
                  <T>{opt.line_info}</T>
                </span>
              </div>
            )}

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
              <T>Why this route?</T> <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
            </button>

            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.78rem", color: "var(--foreground-muted)", background: "var(--background-solid)", padding: "0.75rem", borderRadius: "0.6rem", border: "1px solid var(--border)" }}>
                <p><strong style={{ color: "var(--foreground)" }}><T>Safety:</T></strong> <T>{opt.why.safety}</T></p>
                <p><strong style={{ color: "var(--foreground)" }}><T>Cost:</T></strong> <T>{opt.why.cost}</T></p>
                <p><strong style={{ color: "var(--foreground)" }}><T>Speed:</T></strong> <T>{opt.why.speed}</T></p>
                {opt.mode === "metro" && originPoint && destinationPoint && (
                  <div style={{ paddingTop: "0.3rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setMetroDetailsOpen(metroDetailsOpen === opt.mode ? null : opt.mode)}
                      style={{
                        alignSelf: "flex-start",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.7rem",
                        borderRadius: "999px",
                        border: "none",
                        background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                      }}
                    >
                      <ListTree size={14} /> <T>{metroDetailsOpen === opt.mode ? "Hide Details" : "View Details"}</T>
                    </button>
                    {metroDetailsOpen === opt.mode && (
                      <MetroJourneyPanel origin={originPoint} destination={destinationPoint} knownFareInr={opt.fare_inr} />
                    )}
                  </div>
                )}
                {opt.mode === "bus" && (
                  <p style={{ paddingTop: "0.3rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    <span>
                      <strong style={{ color: "var(--foreground)" }}><T>Line / stop details:</T></strong>{" "}
                      <T>{"not available here — DTC doesn't publish a public real-time feed for this."}</T>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        dispatchAskAlly(
                          buildAskAllyQuery(originLabel, destinationLabel, opt.label)
                        )
                      }
                      style={{
                        alignSelf: "flex-start",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.7rem",
                        borderRadius: "999px",
                        border: "none",
                        background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                      }}
                    >
                      <T>Ask Ally</T> 🛡️
                    </button>
                  </p>
                )}
                {category && category !== "metro" && category !== "bus" && onViewOnMap && (
                  <button
                    type="button"
                    onClick={() => onViewOnMap(opt, category)}
                    style={{
                      alignSelf: "flex-start",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.5rem 0.85rem",
                      borderRadius: "0.6rem",
                      border: "none",
                      background: isActiveOnMap ? "var(--surface)" : "linear-gradient(135deg, var(--accent), var(--accent-strong))",
                      color: isActiveOnMap ? "var(--foreground)" : "white",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      marginTop: "0.2rem",
                    }}
                  >
                    <MapIcon size={14} /> <T>{isActiveOnMap ? "Viewing on Map" : "View on Map"}</T>
                  </button>
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
                <Navigation size={14} /> <T>Book</T> {opt.label}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
