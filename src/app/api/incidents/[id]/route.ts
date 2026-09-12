import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireUser } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase.from("incidents").select("*").eq("id", id).single();
  if (error || !data) return jsonError("Not found", 404);

  // Non-public incidents are only visible to their owner (the admin client bypasses RLS, so
  // this check has to happen here instead).
  if (!data.is_public) {
    const user = await requireUser();
    if (!user || user.id !== data.user_id) return jsonError("Not found", 404);
  }

  return NextResponse.json({ incident: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const { title, description, category, status, is_public } = body ?? {};

  const { data, error } = await supabase
    .from("incidents")
    .update({ title, description, category, status, is_public })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ incident: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const { error } = await supabase.from("incidents").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
