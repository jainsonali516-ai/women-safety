import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { safeParse } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  action: z.enum(["safe", "extend"]),
  extendMinutes: z.number().int().min(1).max(180).optional(),
});

/** Resolves or extends a journey server-side, mirroring exactly what useJourneyTimer.ts already
 * does in localStorage (endJourney / extendJourney) — this just keeps the server-synced copy
 * (used by the cron evaluator) in agreement with the client's own state. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const supabase = createAdminClient();
  const { data: journey, error: fetchError } = await supabase
    .from("journeys")
    .select("id, eta_at, missed_checkins")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !journey) return jsonError("Journey not found", 404);

  if (parsed.data.action === "safe") {
    const { error } = await supabase
      .from("journeys")
      .update({ status: "safe", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  // "extend" — same base-timestamp logic as useJourneyTimer.extendJourney: extend from the
  // current target if it's still in the future, otherwise from now.
  const extendMinutes = parsed.data.extendMinutes ?? 15;
  const currentEta = new Date(journey.eta_at).getTime();
  const base = currentEta > Date.now() ? currentEta : Date.now();
  const newEta = new Date(base + extendMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("journeys")
    .update({ eta_at: newEta, missed_checkins: (journey.missed_checkins ?? 0) + 1 })
    .eq("id", id);
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, etaAt: newEta });
}
