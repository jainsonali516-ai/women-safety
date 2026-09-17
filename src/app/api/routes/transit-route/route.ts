import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchNearestBusStop } from "@/lib/transitAnchors";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  mode: z.literal("bus"),
});

/**
 * Real nearest-bus-stop anchors for drawing an honest walk+stop map view — never a road route
 * relabeled as "Bus". Each anchor is null when OSM simply has nothing mapped nearby, which the
 * map then shows as "not available here" rather than fabricating a location.
 *
 * Metro no longer goes through this endpoint — it uses the "View Details" journey panel backed
 * by real DMRC GTFS data instead of a drawn map route (see MetroJourneyPanel.tsx and
 * /api/routes/metro-journey), which doesn't need a station anchor lookup here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { origin, destination } = parsed.data;

  const originAnchor = await fetchNearestBusStop(origin);
  const destAnchor = await fetchNearestBusStop(destination);
  return NextResponse.json({ originAnchor, destAnchor, lineSummary: undefined, lineColors: [], interchangeNeeded: false });
}
