import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { safeParse } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeJourneyRisk, type JourneyRiskLevel } from "@/lib/journeyRisk";
import { sendSafetyAlert } from "@/lib/email/sendSafetyAlert";
import { whatsappEscalationMessage } from "@/lib/safetyAlertMessages";

const bodySchema = z.object({
  journeyId: z.string().uuid(),
  demoMode: z.boolean().optional().default(false),
  // The user's own "I am feeling unsafe" button — an explicit human signal, not something the
  // formula should ever need to reverse-engineer. Forces CRITICAL regardless of the computed
  // index, same way an SOS activation does inside computeJourneyRisk itself.
  manualUnsafe: z.boolean().optional().default(false),
  // "Send Test Safety Alert" (demo panel) — bypasses the escalation threshold gate and the
  // duplicate-alert dedup so it can be pressed repeatedly during a demo, but still runs through
  // the exact same real risk computation, real Gmail send, and real WhatsApp link-building as a
  // genuine escalation. It does NOT bypass authentication, ownership, or contact authorization.
  testAlert: z.boolean().optional().default(false),
});

const ESCALATION_LEVELS: JourneyRiskLevel[] = ["CONCERN", "CRITICAL"];

/**
 * The single entry point for the real alert pipeline (spec section 12): authenticates the
 * caller, verifies the journey and its trusted contacts belong to that same user, computes the
 * Journey Risk Index server-side (never trusts a client-supplied score), and — only if an
 * escalation is actually warranted — sends a real Gmail email to each enabled contact and
 * returns a ready-to-open WhatsApp link (which only a live client can actually open; see the
 * whatsapp.status values below for why a headless cron run can't do this part).
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { journeyId, demoMode, manualUnsafe, testAlert } = parsed.data;

  const supabase = createAdminClient();

  const { data: journey, error: journeyError } = await supabase
    .from("journeys")
    .select("*")
    .eq("id", journeyId)
    .eq("user_id", user.id)
    .single();
  if (journeyError || !journey) return jsonError("Journey not found", 404);

  const { data: locations } = await supabase
    .from("journey_locations")
    .select("latitude, longitude, recorded_at")
    .eq("journey_id", journeyId)
    .order("recorded_at", { ascending: false })
    .limit(3);

  const { data: activeSos } = await supabase
    .from("sos_alerts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);

  const recentLocations = (locations ?? []).map((l) => ({
    latitude: l.latitude,
    longitude: l.longitude,
    recordedAt: new Date(l.recorded_at).getTime(),
  }));

  let { journeyRiskIndex, riskLevel, reasons } = computeJourneyRisk({
    etaAt: new Date(journey.eta_at).getTime(),
    now: Date.now(),
    destination:
      journey.destination_lat !== null && journey.destination_lng !== null
        ? { latitude: journey.destination_lat, longitude: journey.destination_lng }
        : null,
    origin:
      journey.origin_lat !== null && journey.origin_lng !== null ? { latitude: journey.origin_lat, longitude: journey.origin_lng } : null,
    recentLocations,
    missedCheckins: journey.missed_checkins ?? 0,
    sosActive: Boolean(activeSos && activeSos.length > 0),
  });

  if (manualUnsafe && riskLevel !== "CRITICAL") {
    journeyRiskIndex = 100;
    riskLevel = "CRITICAL";
    reasons = [...reasons, "User manually reported feeling unsafe"];
  }

  const lastKnown =
    journey.last_known_latitude !== null && journey.last_known_longitude !== null
      ? { latitude: journey.last_known_latitude, longitude: journey.last_known_longitude, at: journey.last_known_location_at as string }
      : null;

  const shouldEscalate = testAlert || ESCALATION_LEVELS.includes(riskLevel);
  if (!shouldEscalate) {
    return NextResponse.json({
      journeyRiskIndex,
      riskLevel,
      reasons,
      lastKnownLocation: lastKnown,
      email: { status: "not_triggered", recipients: [] },
      whatsapp: { status: "not_triggered" },
    });
  }

  // Duplicate-alert protection: a real (non-test) escalation only ever sends once per
  // (journey_id, risk_level) pair — see the unique constraint in schema_journey_risk_index.sql.
  // Test sends deliberately skip this so the demo button can be pressed repeatedly.
  if (!testAlert) {
    const { data: existing } = await supabase
      .from("safety_alerts")
      .select("email_status, whatsapp_status")
      .eq("journey_id", journeyId)
      .eq("risk_level", riskLevel)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        journeyRiskIndex,
        riskLevel,
        reasons,
        lastKnownLocation: lastKnown,
        email: { status: existing.email_status, recipients: [], alreadySent: true },
        whatsapp: { status: existing.whatsapp_status, alreadySent: true },
      });
    }
  }

  const { data: contacts } = await supabase
    .from("emergency_contacts")
    .select("id, name, email")
    .eq("user_id", user.id)
    .eq("alerts_enabled", true)
    .not("email", "is", null);

  const recipients = (contacts ?? []).filter((c) => c.email);

  const alertContext = {
    userName: user.email.split("@")[0],
    originLabel: journey.origin_label,
    destinationLabel: journey.destination_label,
    journeyRiskIndex,
    riskLevel,
    reasons,
    lastKnownLatitude: lastKnown?.latitude ?? null,
    lastKnownLongitude: lastKnown?.longitude ?? null,
    lastKnownLocationAt: lastKnown?.at ?? null,
    expectedArrivalAt: journey.eta_at,
    demoMode,
  };

  const emailResults = await Promise.all(
    recipients.map(async (contact) => {
      const result = await sendSafetyAlert({ ...alertContext, recipient: contact.email as string });
      return { email: contact.email as string, name: contact.name as string, status: result.ok ? "sent" : "failed" };
    })
  );

  const emailStatus = recipients.length === 0 ? "not_triggered" : emailResults.some((r) => r.status === "sent") ? "sent" : "failed";

  const whatsappMessage = whatsappEscalationMessage(alertContext);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  if (!testAlert) {
    await supabase.from("safety_alerts").insert({
      user_id: user.id,
      journey_id: journeyId,
      journey_risk_index: journeyRiskIndex,
      risk_level: riskLevel,
      reasons,
      last_known_latitude: lastKnown?.latitude ?? null,
      last_known_longitude: lastKnown?.longitude ?? null,
      last_known_location_at: lastKnown?.at ?? null,
      recipient: recipients.map((r) => r.email).join(", ") || null,
      email_status: emailStatus,
      // A server request always originates from a live browser (this IS an HTTP call the
      // client made), so a "ready" WhatsApp link is genuinely actionable here — unlike the cron
      // job, which never reaches this line (see /api/cron/evaluate-journeys).
      whatsapp_status: "ready",
      demo_mode: demoMode,
      sent_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    journeyRiskIndex,
    riskLevel,
    reasons,
    lastKnownLocation: lastKnown,
    email: { status: emailStatus, recipients: emailResults },
    whatsapp: { status: "ready", url: whatsappUrl, message: whatsappMessage },
  });
}
