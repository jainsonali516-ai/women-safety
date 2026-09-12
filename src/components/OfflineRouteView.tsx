"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, Navigation, Car, TrainFront, Building2, Shield, Hospital, UserPlus } from "lucide-react";
import { getEmergencyRoute, type CachedEmergencyRoute } from "@/lib/offlineDb";
import { buildOlaLinks, buildUberLinks } from "@/lib/rideDeepLinks";
import { getSmsUri } from "@/lib/smsUri";
import { useEmergencyMode } from "@/components/EmergencyModeProvider";

const HELP_ICON = { hospital: Hospital, police: Shield, metro: TrainFront } as const;

const EMERGENCY_NUMBERS = [
  { label: "Women Helpline", number: "1091" },
  { label: "Police / Emergency", number: "112" },
  { label: "Ambulance", number: "102" },
];

export function OfflineRouteView() {
  const { source, batteryLevel } = useEmergencyMode();
  const [route, setRoute] = useState<CachedEmergencyRoute | null | undefined>(undefined);

  useEffect(() => {
    getEmergencyRoute().then(setRoute);
  }, []);

  if (route === undefined) {
    return <p style={{ padding: "1.5rem", color: "var(--foreground-muted)" }}>Loading cached route…</p>;
  }

  if (!route) {
    return (
      <div className="card" style={{ margin: "1.5rem", padding: "1.5rem" }}>
        <p style={{ color: "var(--foreground-muted)" }}>
          No route has been cached yet. Search a journey while online once, and it&apos;ll be saved
          here automatically for offline access.
        </p>
      </div>
    );
  }

  const primaryContact = route.contacts[0];

  function checkInNow() {
    if (!route || !primaryContact) return;
    const locationText = route.lastKnownLocation.address
      ? route.lastKnownLocation.address
      : `${route.lastKnownLocation.latitude.toFixed(5)}, ${route.lastKnownLocation.longitude.toFixed(5)}`;
    const mapsUrl = `https://maps.google.com/?q=${route.lastKnownLocation.latitude},${route.lastKnownLocation.longitude}`;
    const statusLabel =
      source === "battery" && batteryLevel !== null
        ? `Battery Low (${batteryLevel}%)`
        : source === "offline"
          ? "Offline"
          : "Emergency";

    const message = [
      "[SAFETY CHECK-IN]",
      `Status: ${statusLabel}`,
      `Last Known Location: ${locationText}`,
      `Google Maps Link: ${mapsUrl}`,
      `Time: ${new Date(route.timestamp).toLocaleString()}`,
      "Note: Sent automatically via Safety Web App.",
    ].join("\n");

    // Plain sms: navigation — no fetch, no XHR, works purely over the cellular SMS channel.
    // getSmsUri handles the iOS (&body=) vs Android (?body=) separator difference.
    window.location.href = getSmsUri(primaryContact.phone, message);
  }

  const uberLinks = route.destination
    ? buildUberLinks(route.lastKnownLocation, route.destination)
    : null;
  const olaLinks = route.destination ? buildOlaLinks(route.lastKnownLocation, route.destination) : null;

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {primaryContact ? (
        <div>
          <button
            onClick={checkInNow}
            className="btn-accent"
            style={{ width: "100%", padding: "1rem", borderRadius: "1rem", border: "none", fontWeight: 800, fontSize: "1.05rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}
          >
            <MessageCircle size={20} /> Check In Now
          </button>
          <p style={{ fontSize: "0.72rem", color: "var(--foreground-muted)", textAlign: "center", marginTop: "0.5rem" }}>
            Opens your native messaging app. Uses cellular SMS — no internet required.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: "1.1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
            No trusted contact saved yet — add one so Check In Now has somewhere to send your location.
          </p>
          <Link
            href="/contacts"
            className="btn-accent"
            style={{ padding: "0.6rem 1rem", borderRadius: "0.7rem", fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <UserPlus size={16} /> Set Emergency Contact
          </Link>
        </div>
      )}

      <div className="card" style={{ padding: "1rem" }}>
        <h3 style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem" }}>Emergency Calls</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {EMERGENCY_NUMBERS.map((e) => (
            <a
              key={e.number}
              href={`tel:${e.number}`}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.8rem", borderRadius: "0.6rem", border: "1px solid var(--border)", fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)" }}
            >
              <Phone size={14} /> {e.label}
            </a>
          ))}
          {route.contacts.map((c) => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              className="btn-accent"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.8rem", borderRadius: "0.6rem", fontSize: "0.8rem", fontWeight: 700 }}
            >
              <Phone size={14} /> Call {c.name}
            </a>
          ))}
        </div>
      </div>

      {route.helpPoints.length > 0 && (
        <div className="card" style={{ padding: "1rem" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem" }}>Nearby Safe Havens</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {route.helpPoints.map((p) => {
              const Icon = HELP_ICON[p.type as keyof typeof HELP_ICON] ?? Building2;
              return (
                <div key={`${p.name}-${p.latitude}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem" }}>
                  <Icon size={16} color="var(--accent-strong)" />
                  <span>{p.name}</span>
                  <span style={{ color: "var(--foreground-muted)", fontSize: "0.75rem" }}>
                    {(p.distanceMeters / 1000).toFixed(1)} km away
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {route.steps.length > 0 && (
        <div className="card" style={{ padding: "1rem" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem" }}>Saved Directions</h3>
          <ol style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1.1rem", fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
            {route.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="card" style={{ padding: "1rem" }}>
        <h3 style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem" }}>Other Ways to Get There</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {uberLinks && (
            <a href={uberLinks.web} style={linkBtn}>
              <Car size={14} /> Uber
            </a>
          )}
          {olaLinks && (
            <a href={olaLinks.web} style={linkBtn}>
              <Car size={14} /> Ola
            </a>
          )}
          <a href="https://www.delhimetrorail.com" target="_blank" rel="noreferrer" style={linkBtn}>
            <TrainFront size={14} /> Delhi Metro
          </a>
          <a href="https://dtc.delhi.gov.in" target="_blank" rel="noreferrer" style={linkBtn}>
            <Navigation size={14} /> DTC Bus
          </a>
        </div>
      </div>

      <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)", textAlign: "center" }}>
        Saved {new Date(route.timestamp).toLocaleString()}
      </p>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 0.8rem",
  borderRadius: "0.6rem",
  border: "1px solid var(--border)",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--foreground)",
};
