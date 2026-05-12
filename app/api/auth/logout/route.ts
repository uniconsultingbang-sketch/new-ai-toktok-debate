import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, clearLoginSession, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  await clearLoginSession(session);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
