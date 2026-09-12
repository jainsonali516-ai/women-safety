import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Reads and verifies the session cookie set by /api/auth/login or /api/auth/signup. */
export async function requireUser() {
  const session = await getSessionUser();
  if (!session) return null;
  return { id: session.userId, email: session.email };
}
