"use client";

import { BatteryLow } from "lucide-react";
import { useEmergencyMode } from "./EmergencyModeProvider";
import { T } from "@/components/Translated";

export function LowPowerToggle() {
  const { active, source, batterySupported, toggleManual } = useEmergencyMode();
  const manualOn = source === "manual";

  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "0.65rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
            color: "white",
            flexShrink: 0,
          }}
        >
          <BatteryLow size={18} />
        </div>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            <T>Low Power / Offline Mode</T>
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", lineHeight: 1.5, maxWidth: 420 }}>
            <T>
              {`Turns off the map, animations, and live location polling in favor of a lightweight offline view with your last saved route, cached help points, and one-tap check-in. Activates automatically when you lose connection${batterySupported ? " or your battery drops to 5%" : ""}.${!batterySupported ? " (Automatic battery detection isn't supported in this browser — toggle it manually if needed.)" : ""}`}
            </T>
          </p>
        </div>
      </div>
      <button
        onClick={toggleManual}
        role="switch"
        aria-checked={manualOn}
        style={{
          width: 50,
          height: 28,
          borderRadius: "999px",
          border: "none",
          padding: "3px",
          background: active ? "var(--accent)" : "var(--border)",
          cursor: "pointer",
          flexShrink: 0,
          display: "flex",
          justifyContent: active ? "flex-end" : "flex-start",
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "white", display: "block" }} />
      </button>
    </div>
  );
}
