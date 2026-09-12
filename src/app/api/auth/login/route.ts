import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, safeParse } from "@/lib/validation";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

const bodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { email, password } = parsed.data;
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, full_name, phone, password_hash")
    .eq("email", email)
    .maybeSingle();

  // Same generic error whether the email doesn't exist or the password is wrong, so a caller
  // can't use this endpoint to discover which emails have accounts.
  if (error || !user) return jsonError("Invalid email or password", 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return jsonError("Invalid email or password", 401);

  const token = await createSessionToken({ userId: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone },
  });
}
