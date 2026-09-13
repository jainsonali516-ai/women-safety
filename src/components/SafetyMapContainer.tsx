"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Flame, TrainFront, ShieldCheck, RotateCcw, Droplets, Compass, Loader2, Layers, X } from "lucide-react";
import { classifyRiskTier, RISK_TIER_COLOR } from "@/lib/riskTier";
import type { AmenityPoint, AmenityType } from "@/lib/helpPoints";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MapPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface RouteAmenity {
  name: string;
  type: "washroom" | "hospital" | "police" | "safe_zone";
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
}

interface Props {
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  safetyIndex?: number | null;
  amenities?: RouteAmenity[];
  /** Real road-snapped [lat, lng] path from OSRM — null when live routing was unavailable. */
  routePolyline?: [number, number][] | null;
}

const AMENITY_COLOR: Record<RouteAmenity["type"], string> = {
  washroom: "#FF69B4",
  hospital: "#FF2E93",
  police: "#EC4899",
  safe_zone: "#F59E0B",
};

// Small inline SVG glyphs per amenity type — a hospital cross, a police shield, a washroom
// figure, a shopping-bag for pharmacies/malls/restaurants — so each type reads as visually
// distinct on the map, not just by dot color.
const AMENITY_GLYPH: Record<RouteAmenity["type"], string> = {
  hospital: '<path d="M10 3h4v5h5v4h-5v5h-4v-5H5V8h5V3z"/>',
  police: '<path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z"/>',
  washroom: '<circle cx="12" cy="5" r="2.3"/><path d="M12 8.5c-2.2 0-4 1.6-4 3.6v4.4h1.6L10.4 22h3.2l.8-5.5h1.2l.8 5.5h3.2l-.8-5.5H20v-4.4c0-2-1.8-3.6-4-3.6h-4z"/>',
  safe_zone: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="white" stroke-width="1.6"/>',
};

const AMENITY_LABEL: Record<RouteAmenity["type"], string> = {
  washroom: "Washroom",
  hospital: "Hospital",
  police: "Police Station",
  safe_zone: "Safe Zone (pharmacy/mall/restaurant)",
};

const AMENITY_BUFFER_METERS = 1000;

/** 30px badge right on the route, shrinking to 16px near the 1km buffer edge. */
function amenityBadgeSizePx(distanceMeters: number) {
  const t = Math.min(1, distanceMeters / AMENITY_BUFFER_METERS);
  return Math.round(30 - t * 14);
}

// Mock foot-density/lighting sample points across well-known Delhi NCR corridors — a stand-in
// for a real live feed until Google Places/Earth Engine equivalents are wired up (see
// src/lib/scoring.ts for the live OSM-based signals actually used to score routes).
const MOCK_CORRIDORS: { name: string; latitude: number; longitude: number; density: "high" | "moderate" | "low" }[] = [
  { name: "Rajiv Chowk", latitude: 28.6328, longitude: 77.2197, density: "high" },
  { name: "Connaught Place", latitude: 28.6315, longitude: 77.2167, density: "high" },
  { name: "Cyber Hub", latitude: 28.4951, longitude: 77.0885, density: "high" },
  { name: "MG Road", latitude: 28.4799, longitude: 77.0947, density: "moderate" },
  { name: "Hauz Khas", latitude: 28.5535, longitude: 77.2010, density: "moderate" },
  { name: "Yamuna Bank stretch", latitude: 28.6139, longitude: 77.2733, density: "low" },
];

const DENSITY_COLOR: Record<string, string> = { high: "#22c55e", moderate: "#eab308", low: "#ef4444" };
const DENSITY_WEIGHT: Record<string, number> = { high: 0.9, moderate: 0.55, low: 0.25 };

const EXPLORE_TYPES: AmenityType[] = ["washroom", "hospital", "police", "safe_zone"];
const EXPLORE_MOVE_DEBOUNCE_MS = 500;

/** Rounds a bounding box to a coarse grid so small pans/zooms within roughly the same area
 * reuse a cached result instead of re-fetching — same idea as map tile coordinates. */
function boundsCacheKey(bounds: { north: number; south: number; east: number; west: number }) {
  const round = (n: number) => Math.round(n * 200) / 200; // ~0.005° grid, roughly 500m
  return [round(bounds.north), round(bounds.south), round(bounds.east), round(bounds.west)].join(",");
}

export function SafetyMapContainer({ origin, destination, safetyIndex, amenities, routePolyline }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const heatLayerRef = useRef<import("leaflet").Layer | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const userMarkerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const amenityLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);
  const [showAmenities, setShowAmenities] = useState(true);
  const [locating, setLocating] = useState(false);
  // Collapsed by default — the full button stack was covering a large chunk of the map,
  // especially on phones. One small toggle button expands it into a dropdown on demand.
  const [controlsOpen, setControlsOpen] = useState(false);

  // --- Pan/zoom amenity exploration (separate from the route-linked `amenities` prop above) ---
  const exploreClusterRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const exploreCacheRef = useRef<Map<string, AmenityPoint[]>>(new Map());
  const exploreAbortFastRef = useRef<AbortController | null>(null);
  const exploreAbortSlowRef = useRef<AbortController | null>(null);
  const exploreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exploreRawRef = useRef<AmenityPoint[]>([]); // amenities fetched so far for the current view, before category filtering
  const [exploreMode, setExploreMode] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [exploreAreaTooLarge, setExploreAreaTooLarge] = useState(false);
  const [exploreFilters, setExploreFilters] = useState<Set<AmenityType>>(new Set(EXPLORE_TYPES));

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // @ts-expect-error -- leaflet.heat has no type declarations; it patches L.heatLayer at runtime
      await import("leaflet.heat");
      await import("leaflet.markercluster"); // patches L.markerClusterGroup at runtime
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Navigating away and back can leave Leaflet's internal id on a reused DOM node, which
      // makes L.map() throw "Map container is already initialized" and breaks client-side
      // routing entirely. Clearing it makes re-initialization safe.
      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) delete container._leaflet_id;

      // Bundlers break Leaflet's default marker icon path resolution — point it at a CDN instead.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: [28.6139, 77.209],
        zoom: 12,
        zoomControl: false,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.control.scale({ position: "bottomleft", metric: true, imperial: false }).addTo(map);

      // Plain OpenStreetMap tiles — always free, no API key, no referer restrictions (we tried
      // Wikimedia's tile service for real @2x/retina tiles, but it now 403s anything outside
      // Wikimedia's own sites). No free anonymous tile host we found serves genuine retina
      // tiles without a key, so the sharper/industrial look here comes from a higher default
      // zoom (more real detail visible) plus a higher-contrast CSS filter on the tile pane.
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: "abc",
        maxZoom: 19,
      }).addTo(map);

      const heat = L.heatLayer(
        MOCK_CORRIDORS.map((c) => [c.latitude, c.longitude, DENSITY_WEIGHT[c.density]]),
        { radius: 35, blur: 25, maxZoom: 14 }
      );
      heat.addTo(map);
      heatLayerRef.current = heat;

      const markerGroup = L.layerGroup().addTo(map);
      MOCK_CORRIDORS.forEach((c) => {
        L.circleMarker([c.latitude, c.longitude], {
          radius: 7,
          color: DENSITY_COLOR[c.density],
          fillColor: DENSITY_COLOR[c.density],
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindTooltip(`${c.name} — ${c.density} footfall`)
          .addTo(markerGroup);
      });
      markersLayerRef.current = markerGroup;

      routeLayerRef.current = L.layerGroup().addTo(map);
      userMarkerRef.current = L.layerGroup().addTo(map);
      amenityLayerRef.current = L.layerGroup().addTo(map);
      // Not added to the map yet — only shown once "Explore Nearby" is toggled on, so it never
      // costs anything (no listener, no markers) unless a user actually opts into it.
      exploreClusterRef.current = L.markerClusterGroup({ maxClusterRadius: 60, disableClusteringAtZoom: 18 });
      mapRef.current = map;
    }

    init();

    return () => {
      cancelled = true;
      try {
        mapRef.current?.remove();
      } catch {
        /* ignore — container may already be gone if the page unmounted mid-init */
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!heatLayerRef.current || !mapRef.current) return;
    const map = mapRef.current;
    if (showHeatmap) heatLayerRef.current.addTo(map);
    else map.removeLayer(heatLayerRef.current);
  }, [showHeatmap]);

  useEffect(() => {
    if (!markersLayerRef.current || !mapRef.current) return;
    const map = mapRef.current;
    if (showCorridors) markersLayerRef.current.addTo(map);
    else map.removeLayer(markersLayerRef.current);
  }, [showCorridors]);

  useEffect(() => {
    async function drawRoute() {
      if (!mapRef.current || !routeLayerRef.current) return;
      const L = (await import("leaflet")).default;
      routeLayerRef.current.clearLayers();

      if (origin) {
        L.marker([origin.latitude, origin.longitude]).bindTooltip(origin.label ?? "Start").addTo(routeLayerRef.current);
      }
      if (destination) {
        L.marker([destination.latitude, destination.longitude]).bindTooltip(destination.label ?? "Destination").addTo(routeLayerRef.current);
      }
      if (origin && destination) {
        // A uniform glow matching the route's overall risk tier — one route line per search,
        // colored the same as the risk badge shown on the cards below, not a per-stretch
        // breakdown (that was tried and removed by request in favor of this simpler view).
        const tierColor = typeof safetyIndex === "number" ? classifyRiskTier(safetyIndex).tier : null;
        const glowColor = tierColor ? RISK_TIER_COLOR[tierColor] : "#ff2fb2";

        if (routePolyline && routePolyline.length > 1) {
          // Real road-snapped path (actual street turns/flyovers/roundabouts from OSRM), not a
          // straight line between the two points.
          L.polyline(routePolyline, { color: glowColor, weight: 5, opacity: 0.85 }).addTo(routeLayerRef.current);
          L.polyline(routePolyline, { color: glowColor, weight: 12, opacity: 0.18 }).addTo(routeLayerRef.current);
        } else {
          // Live routing wasn't available for this search — say so with a dashed line rather
          // than silently drawing a straight "path" that looks like a real route.
          L.polyline(
            [
              [origin.latitude, origin.longitude],
              [destination.latitude, destination.longitude],
            ],
            { color: glowColor, weight: 3, dashArray: "6 6" }
          )
            .bindTooltip("Live routing unavailable — showing a straight-line estimate")
            .addTo(routeLayerRef.current);
        }

        const bounds = routePolyline && routePolyline.length > 1
          ? routePolyline
          : [
              [origin.latitude, origin.longitude] as [number, number],
              [destination.latitude, destination.longitude] as [number, number],
            ];
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 });
      } else if (origin) {
        mapRef.current.flyTo([origin.latitude, origin.longitude], 13, { duration: 1 });
      }
    }
    drawRoute();
  }, [origin, destination, routePolyline, safetyIndex]);

  useEffect(() => {
    async function drawAmenities() {
      if (!mapRef.current || !amenityLayerRef.current) return;
      const L = (await import("leaflet")).default;
      amenityLayerRef.current.clearLayers();

      (amenities ?? []).forEach((a) => {
        const color = AMENITY_COLOR[a.type];
        const size = amenityBadgeSizePx(a.distanceFromRouteMeters);
        const iconSize = Math.round(size * 0.6);
        const icon = L.divIcon({
          className: "tulip-amenity-badge",
          html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="white">${AMENITY_GLYPH[a.type]}</svg></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([a.latitude, a.longitude], { icon })
          .bindPopup(
            `<strong>${a.name}</strong><br/>${AMENITY_LABEL[a.type]} — ${(a.distanceFromRouteMeters / 1000).toFixed(2)} km off route`
          )
          .addTo(amenityLayerRef.current!);
      });
    }
    drawAmenities();
  }, [amenities]);

  useEffect(() => {
    if (!amenityLayerRef.current || !mapRef.current) return;
    const map = mapRef.current;
    if (showAmenities) amenityLayerRef.current.addTo(map);
    else map.removeLayer(amenityLayerRef.current);
  }, [showAmenities]);

  /** Redraws the cluster group from the last fetched batch, applying the active category
   * filters — called on every filter toggle without re-fetching, since Overpass is the slow
   * part here, not rendering. */
  async function renderExploreMarkers() {
    if (!exploreClusterRef.current) return;
    const L = (await import("leaflet")).default;
    exploreClusterRef.current.clearLayers();

    exploreRawRef.current
      .filter((a) => exploreFiltersRef.current.has(a.type))
      .forEach((a) => {
        const color = AMENITY_COLOR[a.type];
        const icon = L.divIcon({
          className: "tulip-amenity-badge",
          html: `<div style="width:22px;height:22px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"><svg width="13" height="13" viewBox="0 0 24 24" fill="white">${AMENITY_GLYPH[a.type]}</svg></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([a.latitude, a.longitude], { icon })
          .bindPopup(`<strong>${a.name}</strong><br/>${AMENITY_LABEL[a.type]}`)
          .addTo(exploreClusterRef.current!);
      });
  }

  // Effects can't directly read state set after they were created without becoming a dependency
  // (which would mean re-running the whole fetch/listener setup on every filter toggle) — a ref
  // mirror lets the moveend/fetch handler always see the latest filter set without that. Synced
  // in its own effect (not during render) since mutating a ref mid-render is unsafe.
  const exploreFiltersRef = useRef(exploreFilters);
  useEffect(() => {
    exploreFiltersRef.current = exploreFilters;
    renderExploreMarkers();
  }, [exploreFilters]);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = exploreClusterRef.current;
    if (!map || !cluster) return;

    if (!exploreMode) {
      // No setState here: the loading/error status panel is only ever rendered while
      // exploreMode is true (see the JSX below), so there's nothing to visibly reset — it'll
      // start fresh from fetchForCurrentView the next time explore mode is turned back on.
      map.removeLayer(cluster);
      exploreAbortFastRef.current?.abort();
      exploreAbortSlowRef.current?.abort();
      if (exploreDebounceRef.current) clearTimeout(exploreDebounceRef.current);
      return;
    }

    cluster.addTo(map);
    let pendingGroups = 0;

    // The map usually opens zoomed out far enough to see all of Delhi NCR (to fit a searched
    // route, or just the default view) — nowhere near the tight area the server will actually
    // search (see MAX_VIEWPORT_SPAN_DEGREES in helpPoints.ts, needed to keep Overpass fast).
    // Toggling this on at that zoom would silently hit "area too large" on every request and
    // never show a single marker, which reads as "this feature doesn't work." Zoom 15 comfortably
    // fits under that cap for this map's actual on-screen size, so jump there first — but only
    // in, never out, if the user's already looking closer than that.
    const zoomedIn = map.getZoom() < 15;
    if (zoomedIn) map.setZoom(15);

    // Split into a fast group (hospital/police/washroom) and the much slower shop-dense
    // "safe_zone" group — same lesson learned from /api/route-amenities: fetching everything as
    // one request means the whole result waits on the slowest category. Fetching the two groups
    // as independent requests lets the fast one render right away instead of both being stuck
    // behind whichever is slow this time.
    async function fetchGroup(bounds: { north: number; south: number; east: number; west: number }, types: AmenityType[], groupLabel: string, abortRef: { current: AbortController | null }) {
      const cacheKey = `${boundsCacheKey(bounds)}::${groupLabel}`;
      const cached = exploreCacheRef.current.get(cacheKey);
      if (cached) {
        exploreRawRef.current = [...exploreRawRef.current, ...cached];
        renderExploreMarkers();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      pendingGroups++;
      setExploreLoading(true);
      setExploreAreaTooLarge(false);

      try {
        const res = await fetch("/api/amenities/viewport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bounds, types }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (controller.signal.aborted) return; // superseded by a newer pan/zoom
        if (!res.ok) {
          setExploreError("Couldn't load some amenities for this area.");
          return;
        }
        if (data.areaTooLarge) {
          setExploreAreaTooLarge(true);
          return;
        }
        exploreCacheRef.current.set(cacheKey, data.amenities);
        exploreRawRef.current = [...exploreRawRef.current, ...data.amenities];
        renderExploreMarkers();
      } catch (err) {
        if ((err as Error).name !== "AbortError") setExploreError("Couldn't load some amenities for this area.");
      } finally {
        if (!controller.signal.aborted) {
          pendingGroups--;
          if (pendingGroups <= 0) setExploreLoading(false);
        }
      }
    }

    function fetchForCurrentView() {
      const b = map!.getBounds();
      const bounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
      exploreRawRef.current = [];
      setExploreError(null);
      renderExploreMarkers(); // clear stale markers from the previous view immediately
      fetchGroup(bounds, ["washroom", "hospital", "police"], "fast", exploreAbortFastRef);
      fetchGroup(bounds, ["safe_zone"], "slow", exploreAbortSlowRef);
    }

    function onMoveEnd() {
      if (exploreDebounceRef.current) clearTimeout(exploreDebounceRef.current);
      exploreDebounceRef.current = setTimeout(fetchForCurrentView, EXPLORE_MOVE_DEBOUNCE_MS);
    }

    map.on("moveend", onMoveEnd);
    // If setZoom just fired above, Leaflet's own (async) zoom animation will end with a
    // "moveend" that onMoveEnd already catches — firing a second, immediate fetch here too
    // would either double up the request or run against bounds that haven't settled yet from
    // the still-animating zoom. Only fetch immediately when the zoom (and thus bounds) didn't
    // just change.
    if (!zoomedIn) fetchForCurrentView();

    return () => {
      map.off("moveend", onMoveEnd);
      if (exploreDebounceRef.current) clearTimeout(exploreDebounceRef.current);
    };
  }, [exploreMode]);

  function toggleExploreFilter(type: AmenityType) {
    setExploreFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function recenterToGps() {
    if (!("geolocation" in navigator) || !mapRef.current) return;
    setLocating(true);
    const L = (await import("leaflet")).default;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        mapRef.current?.flyTo([latitude, longitude], 15, { duration: 1 });

        userMarkerRef.current?.clearLayers();
        if (userMarkerRef.current) {
          // Accuracy circle + pulsing "you are here" dot, like Google Maps' blue dot.
          L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 1,
          }).addTo(userMarkerRef.current);
          L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "tulip-user-dot-wrap",
              html: '<span class="tulip-user-dot"></span>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          })
            .bindTooltip("You are here")
            .addTo(userMarkerRef.current);
        }

        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function resetToDelhiNcr() {
    if (origin && destination) {
      mapRef.current?.flyToBounds(
        [
          [origin.latitude, origin.longitude],
          [destination.latitude, destination.longitude],
        ],
        { padding: [60, 60], duration: 1 }
      );
    } else {
      mapRef.current?.flyTo([28.6139, 77.209], 12, { duration: 1 });
    }
  }

  return (
    <div className="card tulip-map" style={{ position: "relative", height: 550, overflow: "hidden", padding: 0 }}>
      <div ref={containerRef} className="tulip-map-tiles" style={{ width: "100%", height: "100%" }} />

      {typeof safetyIndex === "number" && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            padding: "0.5rem 0.9rem",
            borderRadius: "0.7rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          <ShieldCheck size={15} color="var(--accent-strong)" /> Safety Index: {safetyIndex}/100
        </div>
      )}

      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
        <button
          onClick={() => setControlsOpen((v) => !v)}
          aria-label={controlsOpen ? "Hide map controls" : "Show map controls"}
          aria-expanded={controlsOpen}
          className="glass"
          style={{
            width: 38,
            height: 38,
            borderRadius: "0.7rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            color: "var(--foreground)",
            cursor: "pointer",
          }}
        >
          {controlsOpen ? <X size={16} /> : <Layers size={16} />}
        </button>

        {controlsOpen && (
          <div
            className="glass"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
              padding: "0.5rem",
              borderRadius: "0.8rem",
              maxWidth: "min(220px, calc(100vw - 3rem))",
            }}
          >
            <ToggleBtn active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)} icon={<Flame size={13} />} label="Night Heatmap" />
            <ToggleBtn active={showCorridors} onClick={() => setShowCorridors((v) => !v)} icon={<TrainFront size={13} />} label="Safety Corridors" />
            <ToggleBtn active={showAmenities} onClick={() => setShowAmenities((v) => !v)} icon={<Droplets size={13} />} label="Nearby Amenities" />
            <ToggleBtn active={exploreMode} onClick={() => setExploreMode((v) => !v)} icon={<Compass size={13} />} label="Explore Nearby" />
            <button
              onClick={recenterToGps}
              disabled={locating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              <LocateFixed size={13} /> {locating ? "Locating..." : "My GPS"}
            </button>
            <button
              onClick={resetToDelhiNcr}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>
        )}
      </div>

      {exploreMode && exploreAreaTooLarge && (
        <div
          className="glass"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1001,
            padding: "0.9rem 1.3rem",
            borderRadius: "0.9rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 260,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          Zoom in to explore amenities in this area
        </div>
      )}

      {exploreMode && (
        <div
          className="glass"
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            padding: "0.5rem 0.7rem",
            borderRadius: "0.7rem",
            fontSize: "0.72rem",
          }}
        >
          {EXPLORE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleExploreFilter(type)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.3rem 0.55rem",
                borderRadius: "999px",
                border: `1px solid ${AMENITY_COLOR[type]}`,
                background: exploreFilters.has(type) ? AMENITY_COLOR[type] : "transparent",
                color: exploreFilters.has(type) ? "white" : AMENITY_COLOR[type],
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {AMENITY_LABEL[type].split(" (")[0]}
            </button>
          ))}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--foreground-muted)" }}>
            {exploreLoading && (
              <>
                <Loader2 size={12} className="animate-spin" /> Loading...
              </>
            )}
            {!exploreLoading && exploreError && <span style={{ color: "#f59e0b" }}>{exploreError}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "0.75rem",
        padding: "0.4rem 0.6rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--border)",
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "white" : "var(--foreground)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {icon} {label}
    </button>
  );
}
