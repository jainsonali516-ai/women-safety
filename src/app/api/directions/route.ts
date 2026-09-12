import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchDrivingRoute } from "@/lib/routing";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const route = await fetchDrivingRoute(parsed.data.origin, parsed.data.destination);
  if (!route) return jsonError("No route found", 404);

  return NextResponse.json({
    distance_meters: route.distanceMeters,
    duration_seconds: route.durationSeconds,
  });
}
