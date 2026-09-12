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

  const { data: contacts, error } = await supabase
    .from("emergency_contacts")
    .select("id, name, phone")
    .eq("user_id", user.id);

  if (error) return jsonError(error.message, 500);
  if (!contacts || contacts.length === 0) {
    return jsonError("No trusted contacts saved yet", 400);
  }

  if (!isTwilioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        maps_url: mapsUrl,
        contacts,
        message:
          "Twilio is not configured on this server yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to send real SMS.",
      },
      { status: 202 }
    );
  }

  const message = `Tulip Safety Alert: I'm sharing my live location with you. View it here: ${mapsUrl}`;

  const results = await Promise.allSettled(
    contacts.map((c) => sendSms(c.phone, message))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return NextResponse.json({ ok: true, maps_url: mapsUrl, sent, failed, contacts: contacts.length });
}
