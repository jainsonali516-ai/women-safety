"use client";

import { useState } from "react";
import { MapPin, Loader2, Copy, Check, MessageCircle } from "lucide-react";
import { T } from "@/components/Translated";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualLandmark, setManualLandmark] = useState("");
  const [needsManualLocation, setNeedsManualLocation] = useState(false);

  async function shareFromCoords(latitude: number, longitude: number) {
    setStatus("sending");
    try {
      const [shareRes, contactsRes] = await Promise.all([
        fetch("/api/location/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        }),
        fetch("/api/contacts"),
      ]);
      const data = await shareRes.json();
      if (!shareRes.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Failed to generate location link");
        return;
      }
      if (contactsRes.ok) setContacts((await contactsRes.json()).contacts ?? []);

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
      setErrorMessage("Network error while sharing your location.");
    }
  }

  async function handleShare() {
    setErrorMessage(null);
    setResult(null);
    setCopied(false);
    setNeedsManualLocation(false);

    if (!("geolocation" in navigator)) {
      setNeedsManualLocation(true);
      return;
    }

    const confirmed = window.confirm(
      "Share your live location now? This generates a Google Maps link with your current GPS position."
    );
    if (!confirmed) return;

    setStatus("locating");
    const timeoutId = setTimeout(() => {
      setStatus((s) => {
        if (s === "locating") setNeedsManualLocation(true);
        return s === "locating" ? "idle" : s;
      });
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        shareFromCoords(position.coords.latitude, position.coords.longitude);
      },
      () => {
        clearTimeout(timeoutId);
        setStatus("idle");
        setNeedsManualLocation(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function useManualLandmark(e: React.FormEvent) {
    e.preventDefault();
    if (!manualLandmark.trim()) return;
    setErrorMessage(null);
    setStatus("locating");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(manualLandmark)}`);
      const data = await res.json();
      if (!res.ok || !data.results?.length) {
        setStatus("error");
        setErrorMessage("Couldn't find that landmark — try a more specific name.");
        return;
      }
      setNeedsManualLocation(false);
      await shareFromCoords(data.results[0].latitude, data.results[0].longitude);
    } catch {
      setStatus("error");
      setErrorMessage("Network error while resolving that landmark.");
    }
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

  function smsMessage() {
    return `HERLANE EMERGENCY ALERT: Track my location: ${result?.mapsUrl}`;
  }

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
        <T>Share My Location</T>
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginBottom: "0.9rem" }}>
        <T>Generates a Google Maps link from your current GPS position that you can send to trusted contacts.</T>
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
        <T>{status === "locating" ? "Getting location..." : status === "sending" ? "Generating link..." : "Share my location now"}</T>
      </button>

      {errorMessage && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#ef4444" }}>
          <T>{errorMessage}</T>
        </p>
      )}

      {needsManualLocation && (
        <form onSubmit={useManualLandmark} style={{ marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
            <T>Location permission denied or weak GPS signal. Enter your current landmark or Metro station instead:</T>
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={manualLandmark}
              onChange={(e) => setManualLandmark(e.target.value)}
              placeholder="e.g. Rajiv Chowk Metro Station"
              style={{
                flex: 1,
                padding: "0.55rem 0.7rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--background-solid)",
                color: "var(--foreground)",
                fontSize: "0.85rem",
              }}
            />
            <button type="submit" className="btn-accent" style={{ padding: "0.55rem 0.9rem", borderRadius: "0.5rem", border: "none", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
              <T>Use this</T>
            </button>
          </div>
        </form>
      )}

      {result && (
        <div style={{ marginTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {result.smsSent ? (
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>
              <T>{`SMS sent automatically to ${result.sent}/${result.contacts} trusted contact(s).`}</T>
            </p>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
              <T>{result.note ?? "Automatic SMS isn't set up — send it yourself below, free, right from your phone."}</T>
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              href={result.mapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.85rem", padding: "0.5rem 0.8rem", borderRadius: "0.6rem", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <T>Open in Maps</T>
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
              {copied ? <Check size={14} /> : <Copy size={14} />} <T>{copied ? "Copied" : "Copy link"}</T>
            </button>
          </div>

          {!result.smsSent && contacts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.3rem" }}>
              {contacts.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>{c.name}</span>
                  <span style={{ display: "flex", gap: "0.4rem" }}>
                    <a
                      href={`sms:${c.phone}?body=${encodeURIComponent(smsMessage())}`}
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0.7rem", borderRadius: "0.5rem", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    >
                      <T>Text via SMS</T>
                    </a>
                    <a
                      href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(smsMessage())}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.78rem",
                        padding: "0.4rem 0.7rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #25d366",
                        color: "#25d366",
                      }}
                    >
                      <MessageCircle size={13} /> <T>WhatsApp</T>
                    </a>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
