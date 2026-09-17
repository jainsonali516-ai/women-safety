"use client";

import { useEffect, useState } from "react";
import { ArrowDown, TrainFront, Footprints, Repeat, Clock, IndianRupee, MapPin } from "lucide-react";
import { T } from "@/components/Translated";
import { metroLineColor as lineColor } from "@/lib/metroLineColors";

interface LatLng {
  latitude: number;
  longitude: number;
}

interface JourneyLeg {
  lineName: string;
  boardStopName: string;
  alightStopName: string;
  stationCount: number;
  travelMinutes: number | null;
}

interface Interchange {
  stationName: string;
  fromLine: string;
  toLine: string;
}

type MetroJourneyResponse =
  | {
      status: "ok";
      origin: { name: string; walkMinutes: number };
      destination: { name: string; walkMinutes: number };
      legs: JourneyLeg[];
      interchanges: Interchange[];
      totalMinutes: number | null;
      scheduleNote: string;
      availabilityVerified: boolean;
      serviceWindowNote?: string;
      estimatedFareInr: number | null;
    }
  | { status: "unavailable"; reason: string; detail?: string }
  | { status: "unverified"; reason: string };

interface Props {
  origin: LatLng;
  destination: LatLng;
  straightLineKm?: number;
  /** The fare already shown on the route card (lib/fares.ts) — reused here instead of
   * recomputing, so the two never drift out of sync. */
  knownFareInr?: number;
}

export function MetroJourneyPanel({ origin, destination, straightLineKm, knownFareInr }: Props) {
  const [data, setData] = useState<MetroJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/routes/metro-journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, straightLineKm }),
    })
      .then((res) => (res.ok ? res.json() : { status: "unverified", reason: "Request failed" }))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ status: "unverified", reason: "Request failed" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- origin/destination are plain lat/lng values from the parent's already-resolved search, not something that should re-trigger on every parent re-render
  }, []);

  if (loading) {
    return (
      <div style={panelStyle}>
        <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
          <T>Loading Metro journey details…</T>
        </p>
      </div>
    );
  }

  if (!data || data.status !== "ok") {
    const isUnverified = data?.status === "unverified";
    return (
      <div style={panelStyle}>
        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: isUnverified ? "#f59e0b" : "var(--foreground)" }}>
          <T>{isUnverified ? "Metro details temporarily unavailable" : "Metro unavailable"}</T>
        </p>
        <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
          <T>{data?.reason ?? "Unable to verify Metro journey details right now."}</T>
        </p>
        {data?.status === "unavailable" && data.detail && (
          <p style={{ fontSize: "0.74rem", color: "var(--foreground-muted)" }}>{data.detail}</p>
        )}
      </div>
    );
  }

  const steps: React.ReactNode[] = [];
  steps.push(<StepPin key="origin" icon={<MapPin size={14} />} label="Origin" />);
  steps.push(<StepArrow key="a0" />);
  steps.push(<StepText key="walk0" icon={<Footprints size={14} />} text={`Walk · ${data.origin.walkMinutes} min`} />);
  steps.push(<StepArrow key="a1" />);
  steps.push(<StepStation key="s0" name={data.origin.name} />);

  data.legs.forEach((leg, i) => {
    steps.push(<StepArrow key={`la${i}`} />);
    steps.push(<StepLine key={`line${i}`} name={leg.lineName} stations={leg.stationCount} />);
    steps.push(<StepArrow key={`lb${i}`} />);
    steps.push(<StepStation key={`st${i}`} name={leg.alightStopName} />);

    const interchange = data.interchanges[i];
    if (interchange) {
      steps.push(<StepArrow key={`ia${i}`} />);
      steps.push(
        <StepChange key={`ch${i}`} station={interchange.stationName} from={interchange.fromLine} to={interchange.toLine} />
      );
    }
  });

  steps.push(<StepArrow key="a2" />);
  steps.push(<StepText key="walk1" icon={<Footprints size={14} />} text={`Walk · ${data.destination.walkMinutes} min`} />);
  steps.push(<StepArrow key="a3" />);
  steps.push(<StepPin key="destination" icon={<MapPin size={14} />} label="Destination" />);

  return (
    <div style={panelStyle}>
      <p style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent-strong)" }}>
        <T>Metro Journey</T>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", padding: "0.3rem 0" }}>{steps}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
        <Stat icon={<Clock size={13} />} text={data.totalMinutes !== null ? `${data.totalMinutes} min total` : "Duration not fully verifiable"} />
        {data.interchanges.length > 0 && <Stat icon={<Repeat size={13} />} text={`${data.interchanges.length} interchange${data.interchanges.length > 1 ? "s" : ""}`} />}
        <Stat
          icon={<IndianRupee size={13} />}
          text={(() => {
            const fare = knownFareInr ?? data.estimatedFareInr;
            return fare !== null && fare !== undefined ? `Est. ₹${fare} (distance-based, confirm at station)` : "Check current Metro fare";
          })()}
        />
      </div>

      <p style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>
        <T>{data.scheduleNote}</T>
        {!data.availabilityVerified && " — departure time against schedule could not be verified"}
      </p>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  fontSize: "0.78rem",
  color: "var(--foreground-muted)",
  background: "var(--background-solid)",
  padding: "0.85rem",
  borderRadius: "0.6rem",
  border: "1px solid var(--border)",
};

function StepArrow() {
  return <ArrowDown size={12} color="var(--foreground-muted)" style={{ marginLeft: 3 }} />;
}

function StepPin({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--foreground)" }}>
      {icon} <T>{label}</T>
    </div>
  );
}

function StepText({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      {icon} <T>{text}</T>
    </div>
  );
}

function StepStation({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--foreground)" }}>
      <TrainFront size={14} /> {name}
    </div>
  );
}

function StepLine({ name, stations }: { name: string; stations: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "1.3rem" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: lineColor(name), flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: "var(--foreground)" }}>
        {name} <T>Line</T>
      </span>
      {stations > 0 && <span>· {stations} <T>stations</T></span>}
    </div>
  );
}

function StepChange({ station, from, to }: { station: string; from: string; to: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        padding: "0.4rem 0.6rem",
        borderRadius: "0.5rem",
        background: "color-mix(in srgb, var(--accent-strong) 12%, transparent)",
        border: "1px solid var(--accent-strong)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 800, fontSize: "0.72rem", color: "var(--accent-strong)" }}>
        <Repeat size={13} /> <T>CHANGE LINE</T>
      </span>
      <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{station}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.73rem" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: lineColor(from) }} /> {from}
        <span>→</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: lineColor(to) }} /> {to}
      </span>
    </div>
  );
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.76rem", fontWeight: 600 }}>
      {icon} <T>{text}</T>
    </span>
  );
}
