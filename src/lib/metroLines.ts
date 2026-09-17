import { queryOverpass } from "@/lib/overpass";

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MetroLine {
  name: string;
  colour: string;
  ref: string;
}

// OSM subway/light-rail route relation names include direction, e.g.
// "Blue Line (Noida Electronic City → Dwarka Sector 21)" — both directions of the same physical
// line show up as separate relations with the same `ref`, so this strips the direction suffix
// and lets callers dedupe on `ref` (falling back to the stripped name when a relation has no ref).
function baseLineName(fullName: string): string {
  return fullName.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * Real Delhi Metro/Rapid Metro line names + colors near a point, from OpenStreetMap's own
 * subway route relations — free, live, and (per spot-checking Rajiv Chowk) genuinely well
 * mapped, including correctly showing interchange stations served by multiple lines. This is
 * not a live train-running feed (no real-time data exists publicly for DMRC), just which lines
 * physically pass near this point — good enough to name a line rather than saying "Delhi Metro"
 * generically, without inventing anything not actually on the map.
 */
export async function fetchNearbyMetroLines(point: LatLng, radiusMeters = 1200): Promise<MetroLine[]> {
  const query = `
    [out:json][timeout:8];
    relation["type"="route"]["route"~"subway|light_rail"](around:${radiusMeters},${point.latitude},${point.longitude});
    out tags;
  `;
  // Short timeout, no mirror retry: naming the line is a nice-to-have on top of an already-
  // working route card, not something worth letting hold up the whole /routes/plan response —
  // if Overpass doesn't answer quickly, the metro card just doesn't get a line name this time,
  // same "skipped, never faked" tradeoff already used elsewhere for below-the-fold enhancements.
  const data = await queryOverpass(query, 6000, false);
  if (!data) return [];

  const seen = new Map<string, MetroLine>();
  for (const el of data.elements as { tags?: Record<string, string> }[]) {
    const tags = el.tags ?? {};
    if (!tags.name) continue;
    const name = baseLineName(tags.name);
    const key = tags.ref || name;
    if (!seen.has(key)) seen.set(key, { name, colour: tags.colour || "#888888", ref: tags.ref || "" });
  }
  return Array.from(seen.values());
}

/**
 * Compares the lines near two points and returns a short, honest summary — "Direct via X" when
 * they share a line, a "likely interchange" note naming both ends' lines when they don't, or
 * undefined when OSM simply doesn't have enough line data here (said nothing, rather than guess).
 */
export function summarizeMetroLines(originLines: MetroLine[], destLines: MetroLine[]): { text: string; lines: MetroLine[] } | undefined {
  if (originLines.length === 0 || destLines.length === 0) return undefined;

  const shared = originLines.filter((o) => destLines.some((d) => (d.ref && o.ref ? d.ref === o.ref : d.name === o.name)));
  if (shared.length > 0) {
    return { text: `Direct via ${shared.map((l) => l.name).join(" / ")}`, lines: shared };
  }

  const originNames = originLines.map((l) => l.name).join(", ");
  const destNames = destLines.map((l) => l.name).join(", ");
  return {
    text: `${originNames} → ${destNames} (interchange likely)`,
    lines: [...originLines, ...destLines],
  };
}
