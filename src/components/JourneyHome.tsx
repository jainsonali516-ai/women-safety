"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { JourneySearchHero, type JourneySearchValues } from "@/components/JourneySearchHero";
import { RouteCardGrid, type RouteOption } from "@/components/RouteCardGrid";
import { SafetyMapContainer, type MapPoint, type RouteAmenity } from "@/components/SafetyMapContainer";
import { OfflineRouteView } from "@/components/OfflineRouteView";
import { useEmergencyMode } from "@/components/EmergencyModeProvider";
import { saveEmergencyRoute } from "@/lib/offlineDb";
import { computeFinalScore } from "@/lib/scoring";
import { T } from "@/components/Translated";

type SortMode = "balanced" | "safest" | "fastest" | "cheapest";

const UI_MODE_MAP: Record<string, string[]> = {
  metro: ["metro"],
  dtc_bus: ["bus"],
  cab: ["cab_uber", "cab_ola"],
};

/**
 * Re-sorting doesn't need a fresh server round-trip — the safety/duration/fare numbers behind
 * each option don't change with the sort tab, only the ordering (and the "balanced" blended
 * score) does. Recomputing and reordering here, from data already on the page, makes tab
 * switches instant instead of re-running live geocoding + Overpass/OSRM lookups every time.
 */
function reorderOptions(options: RouteOption[], sort: SortMode): RouteOption[] {
  const rescored = options.map((opt) => ({
    ...opt,
    final_score: computeFinalScore(opt.safety_score, opt.rush_score, sort),
  }));
  return rescored.sort((a, b) => {
    if (sort === "cheapest") return a.fare_inr - b.fare_inr;
    if (sort === "fastest") return a.duration_min - b.duration_min;
    if (sort === "safest") return b.safety_score - a.safety_score;
    return b.final_score - a.final_score;
  });
}

async function geocodeOne(query: string) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

/** Best-effort: caches the just-planned route for offline/low-power access. Never blocks or
 * fails the search itself — if any of this fails, the user still sees their live results. */
async function cacheRouteForOffline(origin: MapPoint, destination: MapPoint) {
  try {
    const [cacheRes, contactsRes] = await Promise.all([
      fetch("/api/emergency-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
      }),
      fetch("/api/contacts"),
    ]);

    const cacheData = cacheRes.ok ? await cacheRes.json() : { steps: [], polyline: [], helpPoints: [] };
    const contacts = contactsRes.ok ? (await contactsRes.json()).contacts ?? [] : [];

    await saveEmergencyRoute({
      routeId: crypto.randomUUID(),
      steps: cacheData.steps ?? [],
      polyline: cacheData.polyline ?? [],
      helpPoints: cacheData.helpPoints ?? [],
      lastKnownLocation: { latitude: origin.latitude, longitude: origin.longitude, address: origin.label },
      destination: { latitude: destination.latitude, longitude: destination.longitude, address: destination.label },
      contacts: contacts.map((c: { name: string; phone: string }) => ({ name: c.name, phone: c.phone })),
      timestamp: Date.now(),
    });
  } catch {
    /* offline caching is a best-effort background enhancement */
  }
}

export function JourneyHome() {
  const { active: lowPowerActive } = useEmergencyMode();
  const searchParams = useSearchParams();
  const initialOrigin = searchParams.get("origin") ?? undefined;
  const initialDestination = searchParams.get("destination") ?? undefined;
  const [sort, setSort] = useState<SortMode>("balanced");
  // Defaults to true (matches the About preview card's own default), but respects an explicit
  // ?concession=false carried over from there if the person switched it off before clicking through.
  const [pinkSaheliActive, setPinkSaheliActive] = useState(searchParams.get("concession") !== "false");
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);
  const [amenities, setAmenities] = useState<RouteAmenity[]>([]);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  // Overpass can take several seconds (sometimes 10+, per earlier testing) to answer the
  // slower "safe_zone" query. If the user searches again before that resolves, the stale
  // response would otherwise land after the new search's reset and mix old-route amenities into
  // the new one's pins. This counter lets each fetch recognize it's stale and ignore itself.
  const amenityRequestIdRef = useRef(0);

  async function fetchAmenityGroup(originPoint: MapPoint, destPoint: MapPoint, types: string[], requestId: number) {
    try {
      const res = await fetch("/api/route-amenities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: originPoint, destination: destPoint, types }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (requestId !== amenityRequestIdRef.current) return; // a newer search has since started
      // Merge rather than replace — the other group's request is in flight independently and
      // may resolve before or after this one.
      setAmenities((prev) => [...prev, ...(data.amenities ?? [])]);
    } catch {
      /* amenity dots are a map enhancement, not critical to the route results */
    }
  }

  /** Fetches the fast hospital/police/washroom/restaurant amenities and the slower "safe_zone"
   * category (pharmacy/mall — Overpass has to scan more for these in a commercial area) as two
   * independent, parallel requests instead of one combined call, so the fast group's pins can
   * appear on the map right away instead of all of them waiting on the slowest one. */
  async function fetchRouteAmenities(originPoint: MapPoint, destPoint: MapPoint) {
    const requestId = ++amenityRequestIdRef.current;
    setAmenities([]);
    fetchAmenityGroup(originPoint, destPoint, ["washroom", "hospital", "police", "restaurant"], requestId);
    fetchAmenityGroup(originPoint, destPoint, ["safe_zone"], requestId);
  }

  async function runSearch(values: JourneySearchValues) {
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

      const toggledModes = values.selectedModes.flatMap((m) => UI_MODE_MAP[m] ?? []);
      if (toggledModes.length === 0) {
        setError("Select at least one transit mode.");
        return;
      }
      // Auto-rickshaw and e-rickshaw aren't user-toggleable in the hero's filter pills, but
      // should still show up alongside whatever the user did pick.
      const modes = Array.from(new Set([...toggledModes, "auto", "e_rickshaw"]));

      const res = await fetch("/api/routes/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originMapPoint,
          destination: destMapPoint,
          sort,
          modes,
          concession: pinkSaheliActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptions(data.options);
      setSignals(data.signals);
      setRoutePolyline(data.route_polyline ?? null);

      cacheRouteForOffline(originMapPoint, destMapPoint);
      fetchRouteAmenities(originMapPoint, destMapPoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to plan route");
    } finally {
      setLoading(false);
    }
  }

  function changeSort(next: SortMode) {
    setSort(next);
    if (options.length > 0) setOptions((prev) => reorderOptions(prev, next));
  }

  // Arriving from the About page's journey preview card with both fields already filled in —
  // run the search immediately instead of making the person retype and press the button again.
  useEffect(() => {
    if (initialOrigin && initialDestination) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate one-time kickoff of a real search from the URL's initial query params, not state synchronization
      runSearch({ origin: initialOrigin, destination: initialDestination, travelDate: new Date().toISOString().split("T")[0], selectedModes: ["metro", "dtc_bus", "cab"], originCoords: null, destinationCoords: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only, from the URL's initial query params
  }, []);

  const safetyIndex = options.length > 0 ? Math.round(options.reduce((a, o) => a + o.safety_score, 0) / options.length) : null;

  if (lowPowerActive) {
    return <OfflineRouteView />;
  }

  return (
    <>
      <JourneySearchHero
        pinkSaheliActive={pinkSaheliActive}
        onTogglePinkSaheli={() => setPinkSaheliActive((v) => !v)}
        onSearch={(values) => runSearch(values)}
        loading={loading}
        initialOrigin={initialOrigin}
        initialDestination={initialDestination}
      />

      <main style={{ padding: "0 1.5rem 2rem", maxWidth: 1100, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.9rem" }}>
            <T>{error}</T>
          </p>
        )}

        <SafetyMapContainer
          origin={origin}
          destination={destination}
          safetyIndex={safetyIndex}
          amenities={amenities}
          routePolyline={routePolyline}
        />

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
                  <T>{s === "balanced" ? "AI Balanced" : `${s} First`}</T>
                </button>
              ))}
            </div>

            {signals && (
              <p style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                <T>
                  {`${signals.live_routing_available ? "Real road-distance routing used. " : "Routing service unavailable — using distance estimates. "}${signals.street_light_data_available ? "Live OSM street-light data used." : "Street-light data unavailable."}`}
                </T>
              </p>
            )}

            <RouteCardGrid options={options} originLabel={origin?.label} destinationLabel={destination?.label} />
          </>
        )}
      </main>
    </>
  );
}
