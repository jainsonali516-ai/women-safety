"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Flame, TrainFront, ShieldCheck, RotateCcw } from "lucide-react";

export interface MapPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

interface Props {
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  safetyIndex?: number | null;
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

export function SafetyMapContainer({ origin, destination, safetyIndex }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const heatLayerRef = useRef<import("leaflet").Layer | null>(null);
  const markersLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const userMarkerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // @ts-expect-error -- leaflet.heat has no type declarations; it patches L.heatLayer at runtime
      await import("leaflet.heat");
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
        L.polyline(
          [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
          { color: "#ff2fb2", weight: 3, dashArray: "6 6" }
        ).addTo(routeLayerRef.current);
        mapRef.current.flyToBounds(
          [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
          { padding: [60, 60], duration: 1.2 }
        );
      } else if (origin) {
        mapRef.current.flyTo([origin.latitude, origin.longitude], 13, { duration: 1 });
      }
    }
    drawRoute();
  }, [origin, destination]);

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

      <div
        className="glass"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          padding: "0.5rem",
          borderRadius: "0.8rem",
        }}
      >
        <ToggleBtn active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)} icon={<Flame size={13} />} label="Night Heatmap" />
        <ToggleBtn active={showCorridors} onClick={() => setShowCorridors((v) => !v)} icon={<TrainFront size={13} />} label="Safety Corridors" />
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
