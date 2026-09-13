import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { safeParse } from "@/lib/validation";
import { fetchAmenitiesInViewport } from "@/lib/helpPoints";

const AMENITY_TYPES = ["washroom", "hospital", "police", "safe_zone"] as const;

const bodySchema = z.object({
  bounds: z.object({
    north: z.number().min(-90).max(90),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    west: z.number().min(-180).max(180),
  }),
  types: z.array(z.enum(AMENITY_TYPES)).min(1).optional(),
});

/**
 * Free pan/zoom map exploration — unlike /api/route-amenities, this isn't tied to a searched
 * route at all, just "what's inside the map's current view." No auth required: it's the same
 * public OSM data anyone could look up directly, just proxied server-side like every other
 * Overpass call in this app.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { bounds, types } = parsed.data;
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    return jsonError("bounds.north must exceed south, and east must exceed west");
  }

  const result = await fetchAmenitiesInViewport(bounds, types ?? [...AMENITY_TYPES]);
  return NextResponse.json(result);
}
