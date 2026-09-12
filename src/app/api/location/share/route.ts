import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";
import { coordinateSchema, safeParse } from "@/lib/validation";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(coordinateSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { latitude, longitude } = parsed.data;
  const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  if (!isTwilioConfigured()) {
    // No SMS provider configured — still hand back the location link so the user can share it
    // manually (copy, WhatsApp, etc.) instead of promising an SMS that won't send.
    return NextResponse.json({ ok: true, sms_sent: false, maps_url: mapsUrl });
  }

  const { data: contacts, error } = await supabase
    .from("emergency_contacts")
    .select("id, name, phone")
    .eq("user_id", user.id);

  if (error) return jsonError(error.message, 500);
  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ ok: true, sms_sent: false, maps_url: mapsUrl, message: "No trusted contacts saved yet." });
  }

  const message = `Tulip Safety Alert: I'm sharing my live location with you. View it here: ${mapsUrl}`;

  const results = await Promise.allSettled(
    contacts.map((c) => sendSms(c.phone, message))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ ok: true, sms_sent: true, maps_url: mapsUrl, sent, failed, contacts: contacts.length });
}
