import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { fetchPlaceFact } from "@/lib/placeFact";

/**
 * A single short, real, non-negative "Did You Know?" fact about a destination, from Wikipedia's
 * free public REST API (see lib/placeFact.ts) — no key needed, no HTML scraping. Read-only, and
 * this app's other functionality never depends on it: a missing/failed fact just means the card
 * doesn't render (see DidYouKnowCard.tsx), never an error surfaced to the rest of the page.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const place = searchParams.get("place")?.trim();
  const context = searchParams.get("context")?.trim() || undefined;

  if (!place || place.length < 2) return jsonError("A `place` query parameter is required");

  const fact = await fetchPlaceFact(place, context);
  return NextResponse.json({ fact });
}
