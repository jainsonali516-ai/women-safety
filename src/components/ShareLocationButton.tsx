"use client";

import { useState } from "react";
import { MapPin, Loader2, Copy, Check } from "lucide-react";

interface ShareResult {
  smsSent: boolean;
  mapsUrl: string;
  sent?: number;
  contacts?: number;
  note?: string;
}

export function ShareLocationButton() {
  const [status, setStatus] = useState<"idle" | "locating" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setErrorMessage(null);
    setResult(null);
    setCopied(false);
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage("Geolocation is not supported in this browser.");
      return;
    }

    const confirmed = window.confirm(
      "Share your live location now? This generates a Google Maps link with your current GPS position."
    );
    if (!confirmed) return;

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus("sending");
        try {
          const res = await fetch("/api/location/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setStatus("error");
            setErrorMessage(data.error ?? "Failed to generate location link");
            return;
          }
          setStatus("done");
          setResult({
            smsSent: data.sms_sent,
            mapsUrl: data.maps_url,
            sent: data.sent,
            contacts: data.contacts,
            note: data.message,
          });
        } catch {
          setStatus("error");
          setErrorMessage("Network error while getting your location.");
        }
      },
      () => {
        setStatus("error");
        setErrorMessage("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.mapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — link is still visible/clickable */
    }
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Share My Location</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.9rem" }}>
        Generates a Google Maps link from your current GPS position that you can send to trusted contacts.
      </p>
      <button
        onClick={handleShare}
        disabled={status === "locating" || status === "sending"}
        className="btn-accent"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.7rem 1.1rem",
          borderRadius: "0.75rem",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        {status === "locating" || status === "sending" ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
        {status === "locating" ? "Getting location..." : status === "sending" ? "Generating link..." : "Share my location now"}
      </button>

      {errorMessage && <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#ef4444" }}>{errorMessage}</p>}

      {result && (
        <div style={{ marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {result.smsSent ? (
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
              SMS sent to {result.sent}/{result.contacts} trusted contact(s).
            </p>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
              {result.note ?? "SMS isn't set up yet — copy or open the link below to share it yourself."}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              href={result.mapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: "0.85rem",
                padding: "0.5rem 0.8rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              Open in Maps
            </a>
            <button
              onClick={copyLink}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.85rem",
                padding: "0.5rem 0.8rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
