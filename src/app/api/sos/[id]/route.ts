import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*, sos_locations(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ alert: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const { status } = body ?? {};
  if (!["resolved", "cancelled"].includes(status)) {
    return jsonError("status must be 'resolved' or 'cancelled'");
  }

  const { data, error } = await supabase
    .from("sos_alerts")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ alert: data });
}
