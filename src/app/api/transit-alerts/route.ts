import { NextResponse } from "next/server";
import { checkTransitDisruption } from "@/lib/transitAlerts";

export async function GET() {
  const alert = await checkTransitDisruption();
  return NextResponse.json({ alert });
}
