import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

// Loose bounding box covering Delhi/Gurugram/Noida/Ghaziabad/Faridabad: left,top,right,bottom.
const NCR_VIEWBOX = "76.80,28.90,77.60,28.30";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)" },
      signal: AbortSignal.timeout(10000),
    });
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
