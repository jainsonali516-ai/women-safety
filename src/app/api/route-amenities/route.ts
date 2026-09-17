import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchAmenitiesAlongPath, type RouteAmenity } from "@/lib/helpPoints";

const AMENITY_TYPES = ["washroom", "hospital", "police", "restaurant", "safe_zone", "fuel", "atm", "metro_station", "bus_stop"] as const;

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  // A real path (e.g. the road route's OSRM polyline, or a walk→station→station→walk transit
  // path) to search along instead of the plain origin→destination line — see
  // fetchAmenitiesAlongPath. Optional so existing callers that only have the two endpoints keep
  // working unchanged.
  path: z.array(coordinateSchema).min(2).optional(),
  // Optional: lets the client ask for a subset (e.g. the fast group separately from the slower
  // "safe_zone" pharmacy/mall query) so pins can appear on the map as each group resolves
  // instead of all waiting on the slowest one.
  types: z.array(z.enum(AMENITY_TYPES)).min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const path = parsed.data.path ?? [parsed.data.origin, parsed.data.destination];
  const amenities = await fetchAmenitiesAlongPath(path, undefined, parsed.data.types as RouteAmenity["type"][] | undefined);
  return NextResponse.json({ amenities });
}
