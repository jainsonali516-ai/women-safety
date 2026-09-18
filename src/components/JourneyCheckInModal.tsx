"use client";

import { useState } from "react";
import { X, MessageCircle, ShieldAlert, Clock, ArrowLeft } from "lucide-react";
import { T } from "@/components/Translated";
import { QuickDial } from "@/components/QuickDial";

export type CheckInStep = "start" | "expired" | "extend" | "unsafe";

const ETA_PRESETS_MIN = [30, 60, 90, 120];

export function formatEta(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

interface StartProps {
  step: "start";
  originLabel: string;
  destinationLabel: string;
  onConfirm: (origin: string, destination: string, durationMinutes: number, sendWhatsApp: boolean) => void;
  onClose: () => void;
}

interface ExpiredProps {
  step: "expired";
  onSafe: () => void;
  onStillTraveling: () => void;
  onUnsafe: () => void;
}

interface ExtendProps {
  step: "extend";
  onExtend: (extraMinutes: number) => void;
  onBack: () => void;
}

interface UnsafeProps {
  step: "unsafe";
  originLabel: string;
  destinationLabel: string;
  onSendEmergencyMessage: () => void;
  onBack: () => void;
  onResolved: () => void;
}

type Props = StartProps | ExpiredProps | ExtendProps | UnsafeProps;

/** The single dialog behind "Start Journey" and every later check-in prompt — one component,
 * four steps, so the visual language (overlay, card, close affordance) stays identical across
 * the whole flow instead of four separately-styled modals. Matches AuthModal's overlay/card
 * pattern already used elsewhere in the app, and relies entirely on the app's existing CSS
 * custom properties (var(--accent) etc.) for theming, so light/dark mode is automatic. */
export function JourneyCheckInModal(props: Props) {
  const dismissible = props.step === "start";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        props.step === "start"
          ? "Check in before you start"
          : props.step === "unsafe"
            ? "Emergency help"
            : "Journey check-in"
      }
      onClick={dismissible ? props.onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3200,
        background: "rgba(10, 4, 14, 0.65)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: "1.5rem",
          width: "100%",
          maxWidth: 420,
          maxHeight: "calc(100vh - 2.5rem)",
          overflowY: "auto",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {dismissible && props.step === "start" && (
          <button
            onClick={props.onClose}
            aria-label="Close"
            style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "var(--foreground-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        )}

        {props.step === "start" && <StartStep {...props} />}
        {props.step === "expired" && <ExpiredStep {...props} />}
        {props.step === "extend" && <ExtendStep {...props} />}
        {props.step === "unsafe" && <UnsafeStep {...props} />}
      </div>
    </div>
  );
}

function StartStep({ originLabel, destinationLabel, onConfirm }: StartProps) {
  const [origin, setOrigin] = useState(originLabel);
  const [destination, setDestination] = useState(destinationLabel);
  const [preset, setPreset] = useState<number | "custom">(30);
  const [customMinutes, setCustomMinutes] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const durationMinutes = preset === "custom" ? Math.max(1, parseInt(customMinutes, 10) || 0) : preset;
  const canConfirm = origin.trim().length > 0 && destination.trim().length > 0 && durationMinutes > 0;

  return (
    <>
      <div>
        <h2 style={{ fontWeight: 700, fontSize: "1.15rem" }}>
          <T>Check in before you start</T>
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", marginTop: "0.3rem" }}>
          <T>{"We'll remind you to check in when your ETA passes — and can let a trusted contact know you're on your way."}</T>
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label style={labelStyle}>
          <T>Starting from</T>
        </label>
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Where are you starting from?" style={inputStyle} />
        <label style={labelStyle}>
          <T>Heading to</T>
        </label>
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Where are you headed?" style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>
          <T>Expected time to arrive</T>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.4rem" }}>
          {ETA_PRESETS_MIN.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => setPreset(min)}
              style={pillStyle(preset === min)}
            >
              {formatEta(min)}
            </button>
          ))}
          <button type="button" onClick={() => setPreset("custom")} style={pillStyle(preset === "custom")}>
            <T>Custom</T>
          </button>
        </div>
        {preset === "custom" && (
          <input
            type="number"
            min={1}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Minutes"
            style={{ ...inputStyle, marginTop: "0.5rem", maxWidth: 140 }}
          />
        )}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.82rem", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={sendWhatsApp}
          onChange={(e) => setSendWhatsApp(e.target.checked)}
          style={{ marginTop: "0.15rem", width: 16, height: 16, accentColor: "var(--accent-strong)", flexShrink: 0 }}
        />
        <span>
          <T>{"Send WhatsApp notification to trusted contacts that I've started."}</T>
        </span>
      </label>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm(origin.trim(), destination.trim(), durationMinutes, sendWhatsApp)}
        className="btn-accent"
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.7rem",
          border: "none",
          fontWeight: 700,
          fontSize: "0.9rem",
          cursor: canConfirm ? "pointer" : "not-allowed",
          opacity: canConfirm ? 1 : 0.5,
        }}
      >
        <T>Confirm &amp; Start Journey</T>
      </button>
    </>
  );
}

function ExpiredStep({ onSafe, onStillTraveling, onUnsafe }: ExpiredProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Clock size={20} color="var(--accent-strong)" />
        <h2 style={{ fontWeight: 700, fontSize: "1.15rem" }}>
          <T>Check In — How are you doing?</T>
        </h2>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
        <T>Your expected arrival time has passed. Let us know how your trip is going.</T>
      </p>

      <button onClick={onSafe} className="btn-accent" style={choiceButtonStyle}>
        <T>I am safe / Reached my location</T>
      </button>
      <button onClick={onStillTraveling} style={{ ...choiceButtonStyle, background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
        <T>I am still traveling</T>
      </button>
      <button
        onClick={onUnsafe}
        style={{ ...choiceButtonStyle, background: "#ef4444", color: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
      >
        <ShieldAlert size={16} />
        <T>I am feeling unsafe / Need Help</T>
      </button>
    </>
  );
}

function ExtendStep({ onExtend, onBack }: ExtendProps) {
  return (
    <>
      <button onClick={onBack} style={backLinkStyle}>
        <ArrowLeft size={14} /> <T>Back</T>
      </button>
      <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>
        <T>How much longer?</T>
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {[15, 30, 60].map((min) => (
          <button key={min} onClick={() => onExtend(min)} className="btn-accent" style={{ padding: "0.6rem 1.1rem", borderRadius: "0.6rem", border: "none", fontWeight: 700, fontSize: "0.85rem" }}>
            +{min < 60 ? `${min} min` : "1 hr"}
          </button>
        ))}
      </div>
    </>
  );
}

function UnsafeStep({ originLabel, destinationLabel, onSendEmergencyMessage, onBack, onResolved }: UnsafeProps) {
  return (
    <>
      <button onClick={onBack} style={backLinkStyle}>
        <ArrowLeft size={14} /> <T>Back</T>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ShieldAlert size={20} color="#ef4444" />
        <h2 style={{ fontWeight: 700, fontSize: "1.15rem", color: "#ef4444" }}>
          <T>Need Help</T>
        </h2>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
        <T>Call for help immediately, or notify a trusted contact on WhatsApp.</T>
      </p>

      <button
        onClick={onSendEmergencyMessage}
        style={{ ...choiceButtonStyle, background: "#25D366", color: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
      >
        <MessageCircle size={16} />
        <T>Notify Trusted Contact on WhatsApp</T>
      </button>

      <QuickDial />

      <button onClick={onResolved} style={{ ...choiceButtonStyle, background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
        <T>{"I'm safe now — end check-in"}</T>
      </button>

      {(originLabel || destinationLabel) && (
        <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
          <T>Trip</T>: {originLabel || "?"} → {destinationLabel || "?"}
        </p>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "var(--foreground-muted)" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.85rem",
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.4rem 0.8rem",
    borderRadius: "999px",
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "white" : "var(--foreground)",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}

const choiceButtonStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "0.7rem",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
  width: "100%",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  fontSize: "0.78rem",
  color: "var(--foreground-muted)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  alignSelf: "flex-start",
};
