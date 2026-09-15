import { createHash, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, safeParse } from "@/lib/validation";
import { sendPasswordResetOtpEmail } from "@/lib/email";

const OTP_TTL_MS = 10 * 60 * 1000;

const bodySchema = z.object({ email: emailSchema });

// Always the same response whether or not the email has an account — otherwise this endpoint
// could be used to check which emails are registered, same anti-enumeration reasoning as login.
const GENERIC_RESPONSE = { message: "If an account exists for that email, a 6-digit code has been sent." };

// randomInt is crypto-secure (Node's CSPRNG), unlike Math.random().
function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

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
    // Only one valid code per user at a time — older ones stop working once a new one is requested.
    const { error: deleteError } = await supabase.from("password_resets").delete().eq("user_id", user.id);
    if (deleteError) console.log("[forgot-password] error clearing old otps:", deleteError.message);

    const otp = generateOtp();
    const otpHash = createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabase.from("password_resets").insert({ user_id: user.id, otp_hash: otpHash, expires_at: expiresAt });
    if (error) console.log("[forgot-password] error inserting otp:", error.message);

    if (!error) {
      console.log("[forgot-password] sending otp to:", user.email);
      const sent = await sendPasswordResetOtpEmail(user.email, otp);
      console.log("[forgot-password] email sent?", sent);
    }
  }

  console.log("[forgot-password] returning generic response");
  return NextResponse.json(GENERIC_RESPONSE);
}
