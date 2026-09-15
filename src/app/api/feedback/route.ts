import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { nameSchema, emailSchema, freeTextSchema, safeParse } from "@/lib/validation";

// No auth required in either direction — the feedback table's RLS already models exactly this:
// anyone can submit feedback, and only rows with status='approved' are ever publicly readable.
// This route uses the service-role client (which bypasses RLS) so GET must still filter to
// 'approved' explicitly in code rather than relying on the policy alone.
const feedbackSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: freeTextSchema(1000).pipe(z.string().min(1, "Message can't be empty")),
});

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("feedback")
    .select("id, name, message, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ feedback: data });
}

export async function POST(request: Request) {
  const supabase = createAdminClient();

  const body = await request.json().catch(() => null);
  const parsed = safeParse(feedbackSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { data, error } = await supabase
    .from("feedback")
    .insert({ name: parsed.data.name, email: parsed.data.email, message: parsed.data.message })
    .select("id, name, message, created_at, status")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ feedback: data }, { status: 201 });
}
