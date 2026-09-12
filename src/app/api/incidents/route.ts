import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const hasLatLng = searchParams.has("lat") && searchParams.has("lng");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusKm = Number(searchParams.get("radius_km") ?? "5");

  if (hasLatLng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const { data, error } = await supabase.rpc("nearby_incidents", {
      lat,
      lng,
      radius_km: radiusKm,
    });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ incidents: data });
  }

  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ incidents: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const { title, description, category, latitude, longitude, is_public } = body ?? {};

  if (!title || typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("title, latitude and longitude are required");
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      user_id: user.id,
      title,
      description,
      category: category ?? "other",
      latitude,
      longitude,
      is_public: is_public ?? true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ incident: data }, { status: 201 });
}
