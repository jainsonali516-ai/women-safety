import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";

// left,bottom,right,top — covers Delhi/Gurugram/Noida/Ghaziabad/Faridabad.
const NCR_BBOX = "76.80,28.30,77.60,28.90";
const GEOCODER_HEADERS = { "User-Agent": "TulipSafetyApp/1.0 (contact: safety-app)" };

interface PhotonProperties {
  name?: string;
  street?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  properties: PhotonProperties;
  geometry: { coordinates: [number, number] }; // [lon, lat]
}

// Photon has no single "display_name" like Nominatim — build a similar human-readable string,
// skipping fields that duplicate the previous one (e.g. district === city for some records).
function displayName(p: PhotonProperties): string {
  const parts = [p.name, p.street, p.district, p.city, p.county, p.state, p.country].filter(
    (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i
  );
  return parts.join(", ");
}

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

  // Photon (Komoot's free, keyless OSM geocoder) instead of Nominatim's /search here — Nominatim's
  // full-text index only matches complete words, so autocomplete-while-typing queries like "noid"
  // (mid-way through "Noida") or many residential colony/sector names returned zero or irrelevant
  // results. Photon is built for prefix/typeahead search and handles both correctly.
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("bbox", NCR_BBOX);
  url.searchParams.set("lang", "en");

  try {
    const res = await fetch(url.toString(), { headers: GEOCODER_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return jsonError("Geocoding failed", 502);
    const data = (await res.json()) as { features: PhotonFeature[] };

    const results = (data.features ?? [])
      .map((f) => ({
        name: displayName(f.properties),
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
      }))
      .filter((r) => r.name.length > 0);

    return NextResponse.json({ results });
  } catch {
    return jsonError("Geocoding request failed", 502);
  }
}

async function reverseGeocode(latRaw: string, lngRaw: string) {
  const parsed = safeParse(coordinateSchema, { latitude: Number(latRaw), longitude: Number(lngRaw) });
  if (!parsed.ok) return jsonError(parsed.error);

  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(parsed.data.latitude));
  url.searchParams.set("lon", String(parsed.data.longitude));
  url.searchParams.set("lang", "en");

  try {
    const res = await fetch(url.toString(), { headers: GEOCODER_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return jsonError("Reverse geocoding failed", 502);
    const data = (await res.json()) as { features: PhotonFeature[] };
    const first = data.features?.[0];
    return NextResponse.json({ address: first ? displayName(first.properties) : null });
  } catch {
    return jsonError("Reverse geocoding request failed", 502);
  }
}
