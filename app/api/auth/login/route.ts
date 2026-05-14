import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSession,
  createSessionToken,
  getLoginUsers,
  getSessionMaxAge,
  registerLoginSession,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const users = getLoginUsers();
  const adminUserId = process.env.ADMIN_USER_ID?.trim() || "demo03";

  if (!users.length) {
    return NextResponse.json(
      {
        error: "로그인 계정 설정이 필요합니다. Vercel 환경변수에 APP_LOGIN_USERS와 AUTH_SECRET을 설정해 주세요.",
      },
      { status: 503 },
    );
  }

  let body: { id?: string; password?: string; adminOnly?: boolean };

  try {
    body = (await request.json()) as { id?: string; password?: string; adminOnly?: boolean };
  } catch {
    return NextResponse.json({ error: "아이디와 비밀번호를 다시 확인해 주세요." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  const password = body.password ?? "";

  if (body.adminOnly && id !== adminUserId) {
    return NextResponse.json({ error: "관리자 계정만 로그인할 수 있습니다." }, { status: 403 });
  }

  const user = users.find((item) => item.id === id && item.password === password);

  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const session = createSession(user);
  const sessionLockEnabled = await registerLoginSession(session);
  const response = NextResponse.json({
    ok: true,
    sessionLockEnabled,
    sessionPolicy: "latest-login-wins",
    user: { id: user.id, name: user.name },
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: await createSessionToken(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAge(),
  });

  return response;
}
