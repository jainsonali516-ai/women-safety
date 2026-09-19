import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Syncs one location point for an active journey — same shape/pattern as the existing
 * /api/sos/[id]/location route (sos_locations table), applied to the new journey_locations
 * table. Ownership is verified the same way (journey must belong to the requesting user).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const { latitude, longitude, recordedAt } = body ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("latitude and longitude (numbers) are required");
  }

  const supabase = createAdminClient();

  const { data: journey, error: journeyError } = await supabase
    .from("journeys")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (journeyError || !journey) return jsonError("Journey not found", 404);
  if (journey.status !== "active") return jsonError("Journey is not active", 409);

  const recordedAtIso = typeof recordedAt === "number" ? new Date(recordedAt).toISOString() : new Date().toISOString();

  const { error: insertError } = await supabase
    .from("journey_locations")
    .insert({ journey_id: id, user_id: user.id, latitude, longitude, recorded_at: recordedAtIso });

  if (insertError) return jsonError(insertError.message, 500);

  // Keep a denormalized "last known location" on the journey row itself so reading it (e.g. for
  // an email alert) never needs a second query against journey_locations.
  await supabase
    .from("journeys")
    .update({ last_known_latitude: latitude, last_known_longitude: longitude, last_known_location_at: recordedAtIso })
    .eq("id", id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
