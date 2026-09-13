import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";

/**
 * Deliberately unauthenticated — this is what a trusted contact's shared tracking link hits.
 * They aren't a Tulip user, so there's no session to check; the alert's id (a random uuid) is
 * itself the access token, the same trust model as an "anyone with the link" share. Only the
 * minimum needed to show a live dot on a map is returned — no email, phone, or other account
 * details, even though the admin client bypasses RLS for this lookup.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: alert, error: alertError } = await supabase
    .from("sos_alerts")
    .select("id, status, created_at, resolved_at, user_id")
    .eq("id", id)
    .single();

  if (alertError || !alert) return jsonError("This tracking link is invalid or has expired.", 404);

  const [{ data: user }, { data: latest }] = await Promise.all([
    supabase.from("users").select("full_name").eq("id", alert.user_id).single(),
    supabase
      .from("sos_locations")
      .select("latitude, longitude, recorded_at")
      .eq("sos_alert_id", id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    status: alert.status,
    started_at: alert.created_at,
    resolved_at: alert.resolved_at,
    sharer_name: user?.full_name ?? null,
    location: latest ?? null,
  });
}
