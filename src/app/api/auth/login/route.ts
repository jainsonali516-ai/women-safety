import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, indianPhoneSchema, safeParse } from "@/lib/validation";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

// One free-text field — email or phone — rather than two, so the login form doesn't need the
// user to pick which kind of identifier they're typing.
const bodySchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number").max(254),
  password: z.string().min(1, "Password is required").max(72),
});

const GENERIC_ERROR = "Invalid email/phone or password";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { identifier, password } = parsed.data;
  const supabase = createAdminClient();

  const emailAttempt = emailSchema.safeParse(identifier);
  const phoneAttempt = indianPhoneSchema.safeParse(identifier);
  if (!emailAttempt.success && !phoneAttempt.success) return jsonError(GENERIC_ERROR, 401);

  const query = supabase.from("users").select("id, email, full_name, phone, password_hash");
  const { data: user, error } = await (emailAttempt.success
    ? query.eq("email", emailAttempt.data)
    : query.eq("phone", phoneAttempt.data)
  ).maybeSingle();

  // Same generic error in every failure case — wrong identifier, wrong password, or an
  // identifier that isn't even a valid email/phone shape — so this endpoint can't be used to
  // discover which emails or phone numbers have an account here.
  if (error || !user) return jsonError(GENERIC_ERROR, 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return jsonError(GENERIC_ERROR, 401);

  const token = await createSessionToken({ userId: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone },
  });
}
