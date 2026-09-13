import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { computeRouteZones } from "@/lib/zoneSafety";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
});

/**
 * Separate, on-demand endpoint (not part of /api/routes/plan) — scoring 3 zones means several
 * sequential Overpass round-trips, which can take 15-30s on their free public server under
 * load. Keeping this out of the main route-search response means the primary results stay fast;
 * the client only calls this when the user actually opens the safety-zone breakdown.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const zones = await computeRouteZones(parsed.data.origin, parsed.data.destination);
  return NextResponse.json({ zones });
}
