import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { safeParse } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  originLabel: z.string().trim().min(1).max(300),
  destinationLabel: z.string().trim().min(1).max(300),
  originLat: z.number().min(-90).max(90).optional(),
  originLng: z.number().min(-180).max(180).optional(),
  destinationLat: z.number().min(-90).max(90).optional(),
  destinationLng: z.number().min(-180).max(180).optional(),
  etaMinutes: z.number().int().min(1).max(1440),
});

/**
 * Creates a server-synced record for an active journey, alongside (not instead of) the existing
 * client-only localStorage timer (useJourneyTimer.ts) — the countdown UI still reads from
 * localStorage exactly as before; this row exists purely so the server-side risk evaluator
 * (the /api/cron/evaluate-journeys job) can see the journey even if the browser goes offline
 * or is closed entirely.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { originLabel, destinationLabel, originLat, originLng, destinationLat, destinationLng, etaMinutes } = parsed.data;

  const supabase = createAdminClient();
  const etaAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      origin_label: originLabel,
      destination_label: destinationLabel,
      origin_lat: originLat ?? null,
      origin_lng: originLng ?? null,
      destination_lat: destinationLat ?? null,
      destination_lng: destinationLng ?? null,
      eta_at: etaAt,
      status: "active",
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ journey: data }, { status: 201 });
}
