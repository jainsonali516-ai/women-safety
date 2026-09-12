"use client";

import { BatteryLow, WifiOff, Zap } from "lucide-react";
import { useEmergencyMode } from "./EmergencyModeProvider";

export function EmergencyModeBanner() {
  const { active, source } = useEmergencyMode();
  if (!active) return null;

  const label =
    source === "offline"
      ? "OFFLINE MODE — Displaying Last Saved Route"
      : source === "battery"
        ? "LOW BATTERY MODE — Power Saving Active"
        : "LOW POWER MODE (Manual) — Power Saving Active";

  const Icon = source === "offline" ? WifiOff : source === "battery" ? BatteryLow : Zap;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.6rem 1rem",
        background: "#ef4444",
        color: "white",
        fontWeight: 800,
        fontSize: "0.8rem",
        letterSpacing: "0.03em",
        textAlign: "center",
      }}
      role="status"
    >
      <Icon size={16} /> {label}
    </div>
  );
}
