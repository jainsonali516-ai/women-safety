import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";

// Loose bounding box covering Delhi/Gurugram/Noida/Ghaziabad/Faridabad: left,top,right,bottom.
const NCR_VIEWBOX = "76.80,28.90,77.60,28.30";
const NOMINATIM_HEADERS = { "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (lat !== null && lng !== null) {
    return reverseGeocode(lat, lng);
  }

  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2) return jsonError("q is required");
  if (query.length > 200) return jsonError("q is too long");

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("viewbox", NCR_VIEWBOX); // soft bias toward Delhi NCR, not a hard filter
  url.searchParams.set("countrycodes", "in");

  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return jsonError("Geocoding failed", 502);
    const data = await res.json();

    const results = (data as { display_name: string; lat: string; lon: string }[]).map((r) => ({
      name: r.display_name,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
    }));

    return NextResponse.json({ results });
  } catch {
    return jsonError("Geocoding request failed", 502);
  }
}

async function reverseGeocode(latRaw: string, lngRaw: string) {
  const parsed = safeParse(coordinateSchema, { latitude: Number(latRaw), longitude: Number(lngRaw) });
  if (!parsed.ok) return jsonError(parsed.error);

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(parsed.data.latitude));
  url.searchParams.set("lon", String(parsed.data.longitude));
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return jsonError("Reverse geocoding failed", 502);
    const data = await res.json();
    return NextResponse.json({ address: data.display_name ?? null });
  } catch {
    return jsonError("Reverse geocoding request failed", 502);
  }
}
