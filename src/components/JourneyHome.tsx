"use client";

import { useState } from "react";
import { JourneySearchHero, type JourneySearchValues } from "@/components/JourneySearchHero";
import { RouteCardGrid, type RouteOption } from "@/components/RouteCardGrid";
import { SafetyMapContainer, type MapPoint } from "@/components/SafetyMapContainer";

type SortMode = "balanced" | "safest" | "fastest" | "cheapest";

const UI_MODE_MAP: Record<string, string[]> = {
  metro: ["metro"],
  dtc_bus: ["bus"],
  cab: ["cab_uber", "cab_ola"],
};

async function geocodeOne(query: string) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export function JourneyHome() {
  const [sort, setSort] = useState<SortMode>("balanced");
  const [pinkSaheliActive, setPinkSaheliActive] = useState(true);
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);
  const [lastSearch, setLastSearch] = useState<JourneySearchValues | null>(null);

  async function runSearch(values: JourneySearchValues, sortOverride?: SortMode) {
    setError(null);
    setLoading(true);
    try {
      // Prefer coordinates the user explicitly confirmed (GPS detect or picking a suggestion)
      // over blindly geocoding raw text, which could silently resolve to the wrong place.
      const originPoint = values.originCoords ?? (await geocodeOne(values.origin));
      const destPoint = values.destinationCoords ?? (await geocodeOne(values.destination));

      if (!originPoint || !destPoint) {
        setError("Couldn't locate one of those places — try a more specific station or landmark.");
        return;
      }

      const originMapPoint: MapPoint = { latitude: originPoint.latitude, longitude: originPoint.longitude, label: values.origin };
      const destMapPoint: MapPoint = { latitude: destPoint.latitude, longitude: destPoint.longitude, label: values.destination };
      setOrigin(originMapPoint);
      setDestination(destMapPoint);

      const modes = values.selectedModes.flatMap((m) => UI_MODE_MAP[m] ?? []);
      if (modes.length === 0) {
        setError("Select at least one transit mode.");
        return;
      }

      const res = await fetch("/api/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originMapPoint,
          destination: destMapPoint,
          sort: sortOverride ?? sort,
          modes,
          concession: pinkSaheliActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptions(data.options);
      setSignals(data.signals);
      setLastSearch(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan route");
    } finally {
      setLoading(false);
    }
  }

  function changeSort(next: SortMode) {
    setSort(next);
    if (lastSearch) runSearch(lastSearch, next);
  }

  const safetyIndex = options.length > 0 ? Math.round(options.reduce((a, o) => a + o.safety_score, 0) / options.length) : null;

  return (
    <>
      <JourneySearchHero
        pinkSaheliActive={pinkSaheliActive}
        onTogglePinkSaheli={() => setPinkSaheliActive((v) => !v)}
        onSearch={(values) => runSearch(values)}
        loading={loading}
      />

      <main style={{ padding: "0 1.5rem 2rem", maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {error && <p style={{ color: "#ef4444", fontSize: "0.9rem" }}>{error}</p>}

        <SafetyMapContainer origin={origin} destination={destination} safetyIndex={safetyIndex} />

        {options.length > 0 && (
          <>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["balanced", "safest", "fastest", "cheapest"] as SortMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeSort(s)}
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
                  {s === "balanced" ? "AI Balanced" : `${s} First`}
                </button>
              ))}
            </div>

            {signals && (
              <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                {signals.live_routing_available ? "Real road-distance routing used. " : "Routing service unavailable — using distance estimates. "}
                {signals.street_light_data_available ? "Live OSM street-light data used." : "Street-light data unavailable."}
              </p>
            )}

            <RouteCardGrid options={options} />
          </>
        )}
      </main>
    </>
  );
}
