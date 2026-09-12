import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { indianPhoneSchema, otpSchema, safeParse } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phoneResult = safeParse(indianPhoneSchema, body?.phone);
  if (!phoneResult.ok) return jsonError(phoneResult.error);

  const otpResult = safeParse(otpSchema, body?.token);
  if (!otpResult.ok) return jsonError(otpResult.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneResult.data,
    token: otpResult.data,
    type: "sms",
  });

  if (error) return jsonError(error.message, 401);
  return NextResponse.json({ user: data.user, session: data.session });
}
