import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireUser } from "@/lib/api";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const { latitude, longitude, message } = body ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("latitude and longitude (numbers) are required");
  }

  const { data: alert, error } = await supabase
    .from("sos_alerts")
    .insert({ user_id: user.id, latitude, longitude, message, status: "active" })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  // First location ping for this alert (also the seed row for live tracking).
  await supabase
    .from("sos_locations")
    .insert({ sos_alert_id: alert.id, user_id: user.id, latitude, longitude });

  const { data: contacts } = await supabase
    .from("emergency_contacts")
    .select("id, name, phone")
    .eq("user_id", user.id);

  // Hook an SMS/push provider (e.g. Twilio) here to actually notify `contacts`.
  return NextResponse.json({ alert, notified_contacts: contacts ?? [] }, { status: 201 });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ alerts: data });
}
