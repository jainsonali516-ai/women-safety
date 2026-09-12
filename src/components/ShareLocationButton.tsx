"use client";

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

export function ShareLocationButton() {
  const [status, setStatus] = useState<"idle" | "locating" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleShare() {
    setMessage(null);
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage("Geolocation is not supported in this browser.");
      return;
    }

    const confirmed = window.confirm(
      "Share your live location with your trusted contacts now? Your GPS coordinates will be sent to them via SMS."
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
            setMessage(data.error ?? "Failed to share location");
            return;
          }
          setStatus("done");
          setMessage(
            data.ok
              ? `Location sent to ${data.sent}/${data.contacts} trusted contact(s).`
              : data.message ?? "Location link generated."
          );
        } catch {
          setStatus("error");
          setMessage("Network error while sharing your location.");
        }
      },
      () => {
        setStatus("error");
        setMessage("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Share My Location</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.9rem" }}>
        Sends your current GPS location as a Google Maps link to all your trusted contacts via SMS.
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
        {status === "locating" ? "Getting location..." : status === "sending" ? "Sending..." : "Share my location now"}
      </button>
      {message && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: status === "error" ? "#ef4444" : "var(--foreground-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
