import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, requireUser } from "@/lib/api";

export async function GET() {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return jsonError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("sos_alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ alert: data });
}
