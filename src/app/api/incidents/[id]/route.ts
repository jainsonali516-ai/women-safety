import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.from("incidents").select("*").eq("id", id).single();
  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ incident: data });
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
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { error } = await supabase.from("incidents").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
