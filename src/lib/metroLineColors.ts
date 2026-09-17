/** Display colors for DMRC's real line names (from GTFS routes.txt's route_long_name prefix —
 * see lib/gtfs/load.ts). Used both server-side (plan/route.ts's line_colors) and client-side
 * (MetroJourneyPanel.tsx), kept in one place so they can't drift apart. */
export const METRO_LINE_COLOR: Record<string, string> = {
  RED: "#EF4444",
  YELLOW: "#EAB308",
  BLUE: "#3B82F6",
  GREEN: "#22C55E",
  VIOLET: "#8B5CF6",
  PINK: "#EC4899",
  MAGENTA: "#D946EF",
  GRAY: "#9CA3AF",
  AQUA: "#06B6D4",
  "ORANGE/AIRPORT": "#F97316",
  RAPID: "#F59E0B",
};

export function metroLineColor(name: string): string {
  return METRO_LINE_COLOR[name] ?? "#94a3b8";
}
