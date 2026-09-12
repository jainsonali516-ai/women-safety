import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

// Loose bounding box covering Delhi/Gurugram/Noida/Ghaziabad/Faridabad, used to bias results.
const NCR_BOUNDS = "28.30,76.80|28.90,77.60";

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return jsonError("Google Maps is not configured on this server", 503);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2) return jsonError("q is required");
  if (query.length > 200) return jsonError("q is too long");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", `${query}, Delhi NCR, India`);
  url.searchParams.set("bounds", NCR_BOUNDS);
  url.searchParams.set("region", "in");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!res.ok || (data.status !== "OK" && data.status !== "ZERO_RESULTS")) {
      return jsonError(data?.error_message ?? "Geocoding failed", 502);
    }

    const results = (data.results ?? []).slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }) => ({
      name: r.formatted_address,
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    }));

    return NextResponse.json({ results });
  } catch {
    return jsonError("Geocoding request failed", 502);
  }
}
