import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  profile: z.enum(["walking", "driving-traffic", "cycling"]).default("driving-traffic"),
});

export async function POST(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return jsonError("Mapbox is not configured on this server", 503);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { origin, destination, profile } = parsed.data;
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  if (profile === "driving-traffic") url.searchParams.set("annotations", "duration,congestion");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!res.ok || !data.routes?.length) {
      return jsonError(data?.message ?? "No route found", res.status || 404);
    }

    const route = data.routes[0];
    return NextResponse.json({
      distance_meters: route.distance,
      duration_seconds: route.duration,
      duration_typical_seconds: route.duration_typical ?? route.duration,
      geometry: route.geometry,
    });
  } catch {
    return jsonError("Directions request failed", 502);
  }
}
