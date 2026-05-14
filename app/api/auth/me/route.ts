import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifyActiveSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const configured = isAuthConfigured();

  if (!configured) {
    return NextResponse.json({ configured: false, authenticated: true, user: null });
  }

  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyActiveSessionToken(token);
  const response = NextResponse.json({
    configured: true,
    authenticated: Boolean(session),
    code: token && !session ? "session_replaced" : null,
    message:
      token && !session
        ? "다른 기기에서 같은 계정으로 새 로그인이 발생했거나 로그인 시간이 만료되었습니다. 다시 로그인해 주세요."
        : null,
    user: session ? { id: session.id, name: session.name } : null,
  });

  if (token && !session) {
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
