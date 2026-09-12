import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { emailSchema, nameSchema, passwordSchema, safeParse } from "@/lib/validation";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";

const bodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: nameSchema.optional(),
  phone: z.string().trim().max(20).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { email, password, full_name, phone } = parsed.data;
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return jsonError("An account with that email already exists", 409);

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash, full_name, phone })
    .select("id, email, full_name, phone, created_at")
    .single();

  if (error) return jsonError(error.message, 500);

  const token = await createSessionToken({ userId: user.id, email: user.email });
  await setSessionCookie(token);

  return NextResponse.json({ user }, { status: 201 });
}
