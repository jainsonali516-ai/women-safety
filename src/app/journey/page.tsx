"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Search, Navigation, Shield, Clock, IndianRupee } from "lucide-react";

interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

interface RouteOption {
  mode: string;
  label: string;
  duration_min: number;
  fare_inr: number;
  safety_score: number;
  rush_score: number;
  final_score: number;
  deep_link?: string;
  web_link?: string;
}

type SortMode = "balanced" | "safest" | "fastest" | "cheapest";

function PlaceInput({
  placeholder,
  onSelect,
}: {
  placeholder: string;
  onSelect: (p: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);

  async function search(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/mapbox/geocode?q=${encodeURIComponent(value)}`);
    if (res.ok) setSuggestions((await res.json()).results);
    else setSuggestions([]);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        placeholder={placeholder}
        value={query}
        onChange={(e) => search(e.target.value)}
        style={inputStyle}
      />
      {suggestions.length > 0 && !selected && (
        <ul className="card" style={{ position: "absolute", zIndex: 10, width: "100%", marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
          {suggestions.map((s) => (
            <li
              key={`${s.latitude},${s.longitude}`}
              onClick={() => {
                setQuery(s.name);
                setSelected(s);
                setSuggestions([]);
                onSelect(s);
              }}
              style={{ padding: "0.6rem 0.8rem", fontSize: "0.85rem", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function JourneyPage() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [sort, setSort] = useState<SortMode>("balanced");
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);

  async function planRoute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!origin || !destination) {
      setError("Pick both a pickup and drop-off from the suggestions.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, sort }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptions(data.options);
      setSignals(data.signals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan route");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Plan a safe journey</h1>

        <form onSubmit={planRoute} className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <PlaceInput placeholder="Pickup location" onSelect={setOrigin} />
          <PlaceInput placeholder="Drop-off location" onSelect={setDestination} />

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["balanced", "safest", "fastest", "cheapest"] as SortMode[]).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: sort === s ? "var(--accent)" : "var(--surface)",
                  color: sort === s ? "white" : "var(--foreground)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>}

          <button type="submit" disabled={loading} className="btn-accent" style={{ padding: "0.75rem", borderRadius: "0.7rem", fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
            <Search size={16} /> {loading ? "Finding routes..." : "Find Routes"}
          </button>
        </form>

        {signals && (
          <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
            {signals.live_traffic_available ? "Live traffic data used. " : "Live traffic unavailable — using estimates. "}
            {signals.street_light_data_available ? "Live OSM street-light data used." : "Street-light data unavailable."}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {options.map((opt) => (
            <div key={opt.mode} className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{opt.label}</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Score: {opt.final_score}/100</span>
              </div>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--foreground-muted)", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Clock size={14} /> {opt.duration_min} min
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <IndianRupee size={14} /> {opt.fare_inr}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <Shield size={14} /> Safety {opt.safety_score}
                </span>
              </div>
              {opt.deep_link && (
                <a
                  href={opt.web_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-accent"
                  style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", borderRadius: "0.6rem", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <Navigation size={14} /> Book {opt.label}
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: "0.6rem",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.9rem",
};
