import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { passwordSchema, safeParse } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";

const bodySchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const supabase = createAdminClient();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const { data: reset } = await supabase
    .from("password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
    return jsonError("This reset link is invalid or has expired. Please request a new one.", 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const { error: updateError } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", reset.user_id);
  if (updateError) return jsonError(updateError.message, 500);

  // Single-use: mark it spent instead of deleting, so a replay of the same request is a no-op
  // rather than silently succeeding twice.
  await supabase.from("password_resets").update({ used_at: new Date().toISOString() }).eq("id", reset.id);

  return NextResponse.json({ message: "Password updated. You can now log in." });
}
