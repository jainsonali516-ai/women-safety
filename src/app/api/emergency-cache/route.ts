import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { fetchTurnByTurnRoute } from "@/lib/routing";
import { fetchNearbyHelpPoints } from "@/lib/helpPoints";

const bodySchema = z.object({
  origin: coordinateSchema.extend({ label: z.string().trim().max(300).optional() }),
  destination: coordinateSchema.extend({ label: z.string().trim().max(300).optional() }),
});

/**
 * Bundles everything an offline emergency view needs — turn-by-turn steps, route geometry,
 * and nearby hospitals/police/metro — into one response the client caches in IndexedDB while
 * still online. Kept as a single endpoint so the client only has to make one call per search.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { origin, destination } = parsed.data;

  const [route, helpPoints] = await Promise.all([
    fetchTurnByTurnRoute(origin, destination),
    fetchNearbyHelpPoints(destination),
  ]);

  return NextResponse.json({
    steps: route?.steps ?? [],
    polyline: route?.polyline ?? [],
    helpPoints,
  });
}
