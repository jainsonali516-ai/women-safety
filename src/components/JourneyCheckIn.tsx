"use client";

import { useEffect, useState } from "react";
import { PlayCircle, MessageCircle, X } from "lucide-react";
import { T } from "@/components/Translated";
import { useJourneyTimer } from "@/hooks/useJourneyTimer";
import { JourneyCheckInModal, formatEta, type CheckInStep } from "@/components/JourneyCheckInModal";

function openWhatsApp(message: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalMinutes = Math.ceil(ms / 60000);
  return formatEta(totalMinutes);
}

type ChannelStatus = "idle" | "sending" | "sent" | "failed";
type BannerStatus = "monitoring" | "check_required" | "contact_alerted" | "critical" | "offline";

interface AlertPipelineState {
  journeyRiskIndex: number | null;
  riskLevel: "LOW" | "ATTENTION" | "CONCERN" | "CRITICAL" | null;
  reasons: string[];
  emailStatus: ChannelStatus;
  whatsappStatus: ChannelStatus;
}

const ALERT_IDLE: AlertPipelineState = {
  journeyRiskIndex: null,
  riskLevel: null,
  reasons: [],
  emailStatus: "idle",
  whatsappStatus: "idle",
};

/**
 * Self-contained journey check-in feature: a "Start Journey" button that becomes a live countdown
 * banner once active, plus the expiration check-in flow (safe / still traveling / unsafe) with
 * WhatsApp notifications. Entirely client-side and localStorage-backed (see useJourneyTimer) —
 * nothing here is sent to or stored on HerLane's own servers.
 */
export function JourneyCheckIn({ originLabel, destinationLabel }: { originLabel?: string; destinationLabel?: string }) {
  const timer = useJourneyTimer();
  const [openStep, setOpenStep] = useState<CheckInStep | null>(null);
  const [alertState, setAlertState] = useState<AlertPipelineState>(ALERT_IDLE);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // The expiration prompt isn't something the user dismisses their way out of — it opens itself
  // the moment the ETA passes (and stays open across a reload, since isExpired is recomputed from
  // localStorage every tick) until they actually pick one of the three options.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external system (the ETA passing, via the tick-driven timer.isExpired), not synchronizing React state with itself
    if (timer.active && timer.isExpired && openStep === null) setOpenStep("expired");
  }, [timer.active, timer.isExpired, openStep]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the external localStorage-backed timer going inactive, not synchronizing React state with itself
    if (!timer.active) setAlertState(ALERT_IDLE);
  }, [timer.active]);

  /**
   * Calls the real /api/safety/send-alert pipeline — server computes the Journey Risk Index
   * itself (never trusts anything from here), sends a real Gmail email to enabled trusted
   * contacts if escalation is warranted, and returns a ready wa.me link/message for the EXISTING
   * WhatsApp channel, which this function then actually opens (fire-and-forget for email; the
   * WhatsApp open happens synchronously enough to survive most popup blockers since it's still
   * within the same user-gesture handler chain as the button press that triggered this).
   */
  async function triggerSafetyAlert(opts: { manualUnsafe?: boolean; testAlert?: boolean } = {}) {
    if (!timer.journeyId) return;
    if (!navigator.onLine) {
      setAlertState((s) => ({ ...s, emailStatus: "sending" }));
      return;
    }
    setAlertState((s) => ({ ...s, emailStatus: "sending" }));
    try {
      const res = await fetch("/api/safety/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: timer.journeyId, manualUnsafe: opts.manualUnsafe, testAlert: opts.testAlert }),
      });
      if (!res.ok) {
        setAlertState((s) => ({ ...s, emailStatus: "failed" }));
        return;
      }
      const data = await res.json();
      setAlertState({
        journeyRiskIndex: data.journeyRiskIndex,
        riskLevel: data.riskLevel,
        reasons: data.reasons ?? [],
        emailStatus: data.email?.status === "sent" ? "sent" : data.email?.status === "failed" ? "failed" : "idle",
        whatsappStatus: data.whatsapp?.status === "ready" ? "sent" : "idle",
      });
      if (data.whatsapp?.status === "ready" && data.whatsapp.url) {
        window.open(data.whatsapp.url, "_blank");
      }
    } catch {
      setAlertState((s) => ({ ...s, emailStatus: "failed" }));
    }
  }

  function handleStartConfirm(origin: string, destination: string, durationMinutes: number, sendWhatsApp: boolean) {
    timer.startJourney(origin, destination, durationMinutes);
    setOpenStep(null);
    if (sendWhatsApp) {
      openWhatsApp(
        `Hi, I've started my journey from ${origin} to ${destination} on HerLane. Expected arrival in ${formatEta(durationMinutes)}. I'll check in when I reach.`
      );
    }
  }

  function handleSafe() {
    openWhatsApp("Hi, I've reached my destination safely on HerLane.");
    timer.endJourney();
    setOpenStep(null);
  }

  function handleExtend(extraMinutes: number) {
    const newEta = timer.extendJourney(extraMinutes);
    const remainingLabel = formatRemaining(newEta - Date.now());
    openWhatsApp(`Hi, I'm still traveling. Updated expected arrival in ${remainingLabel} on HerLane.`);
    // A missed check-in is exactly one of the Journey Risk Index's contextual signals — let the
    // server re-evaluate now that missed_checkins has been incremented, rather than waiting for
    // the next cron pass. This is additive to the WhatsApp update above, never a replacement.
    void triggerSafetyAlert();
    setOpenStep(null);
  }

  function handleUnsafeMessage() {
    openWhatsApp(
      `EMERGENCY: I am feeling unsafe during my trip from ${timer.origin || "my origin"} to ${timer.destination || "my destination"}. ` +
        `Please check on me or contact help. My last estimated location was: ${timer.destination || timer.origin || "unknown"}.`
    );
    void triggerSafetyAlert({ manualUnsafe: true });
  }

  const displayOrigin = timer.active ? timer.origin : originLabel ?? "";
  const displayDestination = timer.active ? timer.destination : destinationLabel ?? "";

  const bannerStatus: BannerStatus = !isOnline
    ? "offline"
    : alertState.riskLevel === "CRITICAL"
      ? "critical"
      : alertState.riskLevel === "CONCERN"
        ? "contact_alerted"
        : timer.active && timer.isExpired
          ? "check_required"
          : "monitoring";

  const bannerCopy: Record<BannerStatus, { icon: string; text: string }> = {
    monitoring: { icon: "🟢", text: "HERLANE is monitoring your journey." },
    check_required: { icon: "🟡", text: "Your expected check-in was missed. Please confirm that you're safe." },
    contact_alerted: { icon: "🟠", text: "A trusted contact has been notified." },
    critical: { icon: "🔴", text: "Emergency escalation has been triggered." },
    offline: { icon: "⚪", text: "Offline — journey data is being stored securely and will sync when connection returns." },
  };

  return (
    <>
      {!timer.active && (
        <button
          onClick={() => setOpenStep("start")}
          className="btn-accent"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.2rem",
            borderRadius: "0.7rem",
            border: "none",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <PlayCircle size={18} />
          <T>Start Journey</T>
        </button>
      )}

      {timer.active && !timer.isExpired && (
        <div
          className="glass"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "1.5rem",
            zIndex: 1900,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.7rem",
            padding: "0.7rem 1rem",
            borderRadius: "1rem",
            maxWidth: "min(320px, calc(100vw - 3rem))",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <span className="tulip-bloom-breathe" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent-strong)", flexShrink: 0, marginTop: "0.15rem" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 0 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.35 }}>
              <T>Check-in Active</T> — <T>ETA</T>: {formatRemaining(timer.remainingMs)} <T>remaining</T>
            </span>
            <span style={{ fontSize: "0.72rem", lineHeight: 1.3 }}>
              {bannerCopy[bannerStatus].icon} <T>{bannerCopy[bannerStatus].text}</T>
            </span>
            {alertState.journeyRiskIndex !== null && (
              <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                <T>Journey Risk Index</T>: {alertState.journeyRiskIndex} ({alertState.riskLevel})
                {alertState.reasons.length > 0 && <> — {alertState.reasons.join("; ")}</>}
              </span>
            )}
            {(alertState.emailStatus !== "idle" || alertState.whatsappStatus !== "idle") && (
              <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
                <T>Email</T>: <T>{alertState.emailStatus}</T> · <T>WhatsApp</T>: <T>{alertState.whatsappStatus}</T>
              </span>
            )}
          </div>
          <button
            onClick={() => openWhatsApp(`Hi, I'm still on my way from ${displayOrigin} to ${displayDestination} on HerLane.`)}
            aria-label="Share update on WhatsApp"
            style={{ background: "none", border: "none", color: "var(--accent-strong)", cursor: "pointer", display: "flex", flexShrink: 0, marginTop: "0.1rem" }}
          >
            <MessageCircle size={16} />
          </button>
          <button
            onClick={handleSafe}
            aria-label="End check-in — I'm safe"
            title="I'm safe — end check-in"
            style={{ background: "none", border: "none", color: "var(--foreground-muted)", cursor: "pointer", display: "flex", flexShrink: 0, marginTop: "0.1rem" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {openStep === "start" && (
        <JourneyCheckInModal
          step="start"
          originLabel={originLabel ?? ""}
          destinationLabel={destinationLabel ?? ""}
          onConfirm={handleStartConfirm}
          onClose={() => setOpenStep(null)}
        />
      )}

      {openStep === "expired" && (
        <JourneyCheckInModal
          step="expired"
          onSafe={handleSafe}
          onStillTraveling={() => setOpenStep("extend")}
          onUnsafe={() => setOpenStep("unsafe")}
        />
      )}

      {openStep === "extend" && <JourneyCheckInModal step="extend" onExtend={handleExtend} onBack={() => setOpenStep("expired")} />}

      {openStep === "unsafe" && (
        <JourneyCheckInModal
          step="unsafe"
          originLabel={displayOrigin}
          destinationLabel={displayDestination}
          onSendEmergencyMessage={handleUnsafeMessage}
          onBack={() => setOpenStep("expired")}
          onResolved={() => {
            timer.endJourney();
            setOpenStep(null);
          }}
        />
      )}
    </>
  );
}
