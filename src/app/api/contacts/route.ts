import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireUser } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ contacts: data });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const { name, phone, relationship, email, alertsEnabled } = body ?? {};
  if (!name || !phone) return jsonError("name and phone are required");
  if (email && typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Enter a valid email address");
  }

  const { data, error } = await supabase
    .from("emergency_contacts")
    .insert({
      user_id: user.id,
      name,
      phone,
      relationship,
      email: email || null,
      // Defaults to true (matches the column's own DB default) so an existing integration that
      // doesn't send this field at all keeps behaving exactly as before.
      alerts_enabled: typeof alertsEnabled === "boolean" ? alertsEnabled : true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ contact: data }, { status: 201 });
}
