import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

const NCR_BBOX = "76.8,28.3,77.6,28.9"; // roughly Delhi/Gurugram/Noida/Ghaziabad/Faridabad

export async function GET(request: Request) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return jsonError("Mapbox is not configured on this server", 503);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2) return jsonError("q is required");
  if (query.length > 200) return jsonError("q is too long");

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("bbox", NCR_BBOX);
  url.searchParams.set("limit", "5");
  url.searchParams.set("country", "in");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!res.ok) return jsonError(data?.message ?? "Geocoding failed", res.status);

    const results = (data.features ?? []).map((f: { place_name: string; center: [number, number] }) => ({
      name: f.place_name,
      longitude: f.center[0],
      latitude: f.center[1],
    }));

    return NextResponse.json({ results });
  } catch {
    return jsonError("Geocoding request failed", 502);
  }
}
