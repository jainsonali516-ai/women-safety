import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchRouteAmenities, type RouteAmenity } from "@/lib/helpPoints";

const AMENITY_TYPES = ["washroom", "hospital", "police", "restaurant", "safe_zone"] as const;

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  // Optional: lets the client ask for a subset (e.g. the fast group separately from the slower
  // "safe_zone" pharmacy/mall query) so pins can appear on the map as each group resolves
  // instead of all waiting on the slowest one.
  types: z.array(z.enum(AMENITY_TYPES)).min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const amenities = await fetchRouteAmenities(
    parsed.data.origin,
    parsed.data.destination,
    undefined,
    parsed.data.types as RouteAmenity["type"][] | undefined
  );
  return NextResponse.json({ amenities });
}
