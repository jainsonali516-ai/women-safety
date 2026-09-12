import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const { latitude, longitude } = body ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("latitude and longitude (numbers) are required");
  }

  const { data: alert, error: alertError } = await supabase
    .from("sos_alerts")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (alertError || !alert) return jsonError("SOS alert not found", 404);
  if (alert.status !== "active") return jsonError("SOS alert is not active", 409);

  const { data, error } = await supabase
    .from("sos_locations")
    .insert({ sos_alert_id: id, user_id: user.id, latitude, longitude })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ location: data }, { status: 201 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("sos_locations")
    .select("*")
    .eq("sos_alert_id", id)
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ locations: data });
}
