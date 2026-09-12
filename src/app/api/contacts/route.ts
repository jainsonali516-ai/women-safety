import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function GET() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ contacts: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const { name, phone, relationship } = body ?? {};
  if (!name || !phone) return jsonError("name and phone are required");

  const { data, error } = await supabase
    .from("emergency_contacts")
    .insert({ user_id: user.id, name, phone, relationship })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ contact: data }, { status: 201 });
}
