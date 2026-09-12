import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireUser } from "@/lib/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const { name, phone, relationship } = body ?? {};

  const { data, error } = await supabase
    .from("emergency_contacts")
    .update({ name, phone, relationship })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ contact: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
