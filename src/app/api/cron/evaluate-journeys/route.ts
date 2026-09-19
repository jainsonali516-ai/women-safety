import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeJourneyRisk, type JourneyRiskLevel } from "@/lib/journeyRisk";
import { sendSafetyAlert } from "@/lib/email/sendSafetyAlert";

const ESCALATION_LEVELS: JourneyRiskLevel[] = ["CONCERN", "CRITICAL"];

/**
 * Server-autonomous journey evaluation — the whole reason this feature doesn't depend on a
 * user's browser staying open. Meant to be hit on a schedule by Vercel Cron (see vercel.json).
 *
 * Real, hard limitation, not a bug: this route can only send the Gmail half of an escalation.
 * The existing WhatsApp alert is a client-side `wa.me` link opened via `window.open()` — there's
 * no server-side "send WhatsApp" API behind it, so a cron run with no browser attached genuinely
 * cannot make a phone's WhatsApp app open. Every alert this route sends is recorded with
 * whatsapp_status = 'not_triggered' for exactly that reason, never a fabricated "sent".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: journeys, error } = await supabase.from("journeys").select("*").eq("status", "active");
  if (error) return NextResponse.json({ error: "Failed to load journeys" }, { status: 500 });

  let evaluated = 0;
  let escalated = 0;

  for (const journey of journeys ?? []) {
    evaluated++;

    const { data: locations } = await supabase
      .from("journey_locations")
      .select("latitude, longitude, recorded_at")
      .eq("journey_id", journey.id)
      .order("recorded_at", { ascending: false })
      .limit(3);

    const { data: activeSos } = await supabase.from("sos_alerts").select("id").eq("user_id", journey.user_id).eq("status", "active").limit(1);

    const recentLocations = (locations ?? []).map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
      recordedAt: new Date(l.recorded_at).getTime(),
    }));

    const { journeyRiskIndex, riskLevel, reasons } = computeJourneyRisk({
      etaAt: new Date(journey.eta_at).getTime(),
      now: Date.now(),
      destination:
        journey.destination_lat !== null && journey.destination_lng !== null
          ? { latitude: journey.destination_lat, longitude: journey.destination_lng }
          : null,
      origin:
        journey.origin_lat !== null && journey.origin_lng !== null
          ? { latitude: journey.origin_lat, longitude: journey.origin_lng }
          : null,
      recentLocations,
      missedCheckins: journey.missed_checkins ?? 0,
      sosActive: Boolean(activeSos && activeSos.length > 0),
    });

    if (!ESCALATION_LEVELS.includes(riskLevel)) continue;

    const { data: existing } = await supabase
      .from("safety_alerts")
      .select("id")
      .eq("journey_id", journey.id)
      .eq("risk_level", riskLevel)
      .maybeSingle();
    if (existing) continue; // already alerted at this level — duplicate protection

    const { data: contacts } = await supabase
      .from("emergency_contacts")
      .select("email")
      .eq("user_id", journey.user_id)
      .eq("alerts_enabled", true)
      .not("email", "is", null);
    const recipients = (contacts ?? []).map((c) => c.email as string).filter(Boolean);

    const { data: userRow } = await supabase.from("users").select("email").eq("id", journey.user_id).single();
    const userName = userRow?.email ? userRow.email.split("@")[0] : "A HerLane user";

    const lastKnown =
      journey.last_known_latitude !== null && journey.last_known_longitude !== null
        ? { latitude: journey.last_known_latitude, longitude: journey.last_known_longitude, at: journey.last_known_location_at as string }
        : null;

    const alertContext = {
      userName,
      originLabel: journey.origin_label,
      destinationLabel: journey.destination_label,
      journeyRiskIndex,
      riskLevel,
      reasons,
      lastKnownLatitude: lastKnown?.latitude ?? null,
      lastKnownLongitude: lastKnown?.longitude ?? null,
      lastKnownLocationAt: lastKnown?.at ?? null,
      expectedArrivalAt: journey.eta_at,
      demoMode: false,
    };

    const results = await Promise.all(recipients.map((email) => sendSafetyAlert({ ...alertContext, recipient: email })));
    const emailStatus = recipients.length === 0 ? "not_triggered" : results.some((r) => r.ok) ? "sent" : "failed";

    await supabase.from("safety_alerts").insert({
      user_id: journey.user_id,
      journey_id: journey.id,
      journey_risk_index: journeyRiskIndex,
      risk_level: riskLevel,
      reasons,
      last_known_latitude: lastKnown?.latitude ?? null,
      last_known_longitude: lastKnown?.longitude ?? null,
      last_known_location_at: lastKnown?.at ?? null,
      recipient: recipients.join(", ") || null,
      email_status: emailStatus,
      whatsapp_status: "not_triggered", // no browser present in a cron run — see file header
      demo_mode: false,
      sent_at: new Date().toISOString(),
    });

    escalated++;
  }

  return NextResponse.json({ evaluated, escalated });
}
