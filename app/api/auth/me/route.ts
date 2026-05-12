import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const configured = isAuthConfigured();

  if (!configured) {
    return NextResponse.json({ configured: false, authenticated: true, user: null });
  }

  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  return NextResponse.json({
    configured: true,
    authenticated: Boolean(session),
    user: session ? { id: session.id, name: session.name } : null,
  });
}
