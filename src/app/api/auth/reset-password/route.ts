import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, otpSchema, passwordSchema, safeParse } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
const GENERIC_FAIL = "That code is invalid or has expired. Please request a new one.";

const bodySchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const supabase = createAdminClient();

  const { data: user } = await supabase.from("users").select("id").eq("email", parsed.data.email).maybeSingle();
  if (!user) return jsonError(GENERIC_FAIL, 400);

  const { data: reset } = await supabase
    .from("password_resets")
    .select("id, otp_hash, expires_at, used_at, attempts")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
    return jsonError(GENERIC_FAIL, 400);
  }

  if (reset.attempts >= MAX_ATTEMPTS) {
    return jsonError("Too many incorrect attempts. Please request a new code.", 400);
  }

  const otpHash = createHash("sha256").update(parsed.data.otp).digest("hex");

  if (otpHash !== reset.otp_hash) {
    await supabase.from("password_resets").update({ attempts: reset.attempts + 1 }).eq("id", reset.id);
    return jsonError(GENERIC_FAIL, 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const { error: updateError } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", user.id);
  if (updateError) return jsonError(updateError.message, 500);

  // Single-use: mark it spent instead of deleting, so a replay of the same request is a no-op
  // rather than silently succeeding twice.
  await supabase.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", reset.id);

  return NextResponse.json({ message: "Password updated. You can now log in." });
}
