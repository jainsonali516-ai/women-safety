import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchRouteAmenities } from "@/lib/helpPoints";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const amenities = await fetchRouteAmenities(parsed.data.origin, parsed.data.destination);
  return NextResponse.json({ amenities });
}
