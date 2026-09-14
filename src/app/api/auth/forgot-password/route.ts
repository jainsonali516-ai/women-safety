import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, safeParse } from "@/lib/validation";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const bodySchema = z.object({ email: emailSchema });

// Always the same response whether or not the email has an account — otherwise this endpoint
// could be used to check which emails are registered, same anti-enumeration reasoning as login.
const GENERIC_RESPONSE = { message: "If an account exists for that email, a reset link has been sent." };

export async function POST(request: Request) {
  console.log("[forgot-password] request received");
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) {
    console.log("[forgot-password] body failed validation:", parsed.error);
    return jsonError(parsed.error);
  }
  console.log("[forgot-password] looking up email:", parsed.data.email);

  const supabase = createAdminClient();
  const { data: user, error: lookupError } = await supabase.from("users").select("id, email").eq("email", parsed.data.email).maybeSingle();
  if (lookupError) console.log("[forgot-password] user lookup error:", lookupError.message);
  console.log("[forgot-password] user found?", !!user);

  if (user) {
    // Only one valid reset link per user at a time — older ones stop working once a new one is requested.
    const { error: deleteError } = await supabase.from("password_resets").delete().eq("user_id", user.id);
    if (deleteError) console.log("[forgot-password] error clearing old tokens:", deleteError.message);

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    const { error } = await supabase.from("password_resets").insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
    if (error) console.log("[forgot-password] error inserting token:", error.message);

    if (!error) {
      const origin = new URL(request.url).origin;
      const resetUrl = `${origin}/auth/reset?token=${token}`;
      console.log("[forgot-password] sending email to:", user.email, "with url:", resetUrl);
      const sent = await sendPasswordResetEmail(user.email, resetUrl);
      console.log("[forgot-password] email sent?", sent);
    }
  }

  console.log("[forgot-password] returning generic response");
  return NextResponse.json(GENERIC_RESPONSE);
}
