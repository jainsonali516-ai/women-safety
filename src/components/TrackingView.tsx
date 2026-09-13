"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MapPinOff, Radio, CircleCheck, Clock } from "lucide-react";
import { TulipLogo } from "@/components/TulipLogo";

const POLL_INTERVAL_MS = 8000;

interface TrackingLocation {
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface TrackingData {
  status: "active" | "resolved" | "cancelled";
  started_at: string;
  resolved_at: string | null;
  sharer_name: string | null;
  location: TrackingLocation | null;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

/** A minimal, single-purpose Leaflet map for the public tracking link — deliberately not
 * reusing SafetyMapContainer, which is coupled to the journey-search flow (heatmap, amenities,
 * sort tabs) that a trusted contact viewing a share link has no use for. */
function LiveMap({ location }: { location: TrackingLocation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) delete container._leaflet_id;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, { zoomControl: true, center: [location.latitude, location.longitude], zoom: 16 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: "abc",
        maxZoom: 19,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    }
    init();
    return () => {
      cancelled = true;
      try {
        mapRef.current?.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever initialize the map once, at its starting position; live updates are handled by the marker effect below
  }, []);

  useEffect(() => {
    async function drawMarker() {
      if (!mapRef.current || !markerLayerRef.current) return;
      const L = (await import("leaflet")).default;
      markerLayerRef.current.clearLayers();

      L.circle([location.latitude, location.longitude], {
        radius: 40,
        color: "#ff2fb2",
        fillColor: "#ff2fb2",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(markerLayerRef.current);
      L.marker([location.latitude, location.longitude], {
        icon: L.divIcon({
          className: "tulip-user-dot-wrap",
          html: '<span class="tulip-user-dot"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(markerLayerRef.current);

      mapRef.current.panTo([location.latitude, location.longitude]);
    }
    drawMarker();
  }, [location.latitude, location.longitude]);

  return <div ref={containerRef} className="tulip-map-tiles" style={{ width: "100%", height: "100%" }} />;
}

export function TrackingView({ alertId }: { alertId: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0); // re-render periodically so "X ago" stays fresh

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/sos/${alertId}/public`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "This tracking link is invalid or has expired.");
          return;
        }
        setData(json);
        if (json.status === "active") {
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setError("Network error while loading this tracking link.");
      }
    }
    poll();

    const tickTimer = setInterval(() => forceTick((t) => t + 1), 15000);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      clearInterval(tickTimer);
    };
  }, [alertId]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        className="glass"
        style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.9rem 1.5rem", borderLeft: "none", borderRight: "none", borderTop: "none" }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <TulipLogo size={26} />
          <span style={{ fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.15em" }}>TULIP</span>
        </Link>
      </header>

      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && (
          <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", textAlign: "center" }}>
            <MapPinOff size={28} color="var(--foreground-muted)" />
            <p style={{ color: "var(--foreground-muted)" }}>{error}</p>
          </div>
        )}

        {!error && !data && (
          <div className="card" style={{ padding: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <Loader2 size={18} className="animate-spin" /> Loading tracking link…
          </div>
        )}

        {data && (
          <>
            <div className="card" style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <h1 style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                {data.sharer_name ? `${data.sharer_name}'s live location` : "Live location"}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
                {data.status === "active" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#22c55e", fontWeight: 700 }}>
                    <Radio size={14} /> Active
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--foreground-muted)", fontWeight: 700 }}>
                    <CircleCheck size={14} /> Tracking ended
                  </span>
                )}
                {data.location && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--foreground-muted)" }}>
                    <Clock size={14} /> Updated {timeAgo(data.location.recorded_at)}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--foreground-muted)" }}>
                Only people with this exact link can view this. It stops updating once tracking ends.
              </p>
            </div>

            <div className="card tulip-map" style={{ height: 420, overflow: "hidden", padding: 0 }}>
              {data.location ? (
                <LiveMap location={data.location} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--foreground-muted)", fontSize: "0.85rem" }}>
                  No location received yet.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
