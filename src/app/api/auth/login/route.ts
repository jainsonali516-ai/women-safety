import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return jsonError("email and password are required");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return jsonError(error.message, 401);

  return NextResponse.json({ user: data.user, session: data.session });
}
