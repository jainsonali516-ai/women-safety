import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";

const bodySchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
});

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return jsonError("Google Maps is not configured on this server", 503);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { origin, destination } = parsed.data;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!res.ok || data.status !== "OK" || !data.routes?.length) {
      return jsonError(data?.error_message ?? "No route found", 404);
    }

    const leg = data.routes[0].legs[0];
    return NextResponse.json({
      distance_meters: leg.distance.value,
      duration_seconds: leg.duration.value,
      duration_in_traffic_seconds: leg.duration_in_traffic?.value ?? leg.duration.value,
    });
  } catch {
    return jsonError("Directions request failed", 502);
  }
}
