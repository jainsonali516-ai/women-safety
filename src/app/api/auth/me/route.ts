import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** Lets client components tell guest vs signed-in apart without duplicating session-cookie
 * parsing — reads the same httpOnly cookie every other route already trusts. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: session.userId, email: session.email } });
}
