// Shared between RouteCardGrid and SafetyMapContainer so a route card's accent color is always
// the exact same color as its line on the map — one visual language instead of two components
// each inventing their own palette. Reuses the app's existing brand tokens rather than new hex
// values, and CSS custom properties resolve fine as Leaflet polyline/marker colors since Leaflet
// renders vector layers as SVG.
export const MODE_COLOR: Record<string, string> = {
  metro: "var(--brand-teal)",
  bus: "var(--accent-amber)",
  e_rickshaw: "var(--accent-violet)",
  auto: "var(--accent-violet)",
  cab_uber: "var(--accent)",
  cab_ola: "var(--accent)",
};

// Modes with a real OSRM-routed road path to draw. Metro/bus have no live transit-routing feed
// (see riskTier.ts / the About FAQ), so their map line is always an explicitly-labeled
// approximation rather than something that looks like real route geometry.
export const ROAD_MODES = new Set(["auto", "cab_uber", "cab_ola", "e_rickshaw"]);
