import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError, requireUser } from "@/lib/api";
import { safeParse } from "@/lib/validation";

const reminderSchema = z.object({
  label: z.string().trim().min(1).max(80).default("Share my location"),
  time_of_day: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time_of_day must be HH:MM"),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("location_reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("time_of_day", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ reminders: data });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const parsed = safeParse(reminderSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { data, error } = await supabase
    .from("location_reminders")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ reminder: data }, { status: 201 });
}
