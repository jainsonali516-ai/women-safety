import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { indianPhoneSchema, safeParse } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(indianPhoneSchema, body?.phone);
  if (!parsed.ok) return jsonError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data });

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true, phone: parsed.data });
}
