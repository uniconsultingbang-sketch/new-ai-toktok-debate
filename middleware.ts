import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifyActiveSessionToken } from "@/lib/auth";

const adminPathPrefix = "/admin";
const adminUserId = process.env.ADMIN_USER_ID?.trim() || "demo03";
const replacedReason = "session-replaced";

const publicPrefixes = [
  "/_next",
  "/images",
  "/api/auth",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/robots.txt",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyActiveSessionToken(token);

  if (pathname === adminPathPrefix || pathname.startsWith(`${adminPathPrefix}/`)) {
    if (!session) {
      return redirectToLogin(request, pathname, token);
    }

    if (session.id !== adminUserId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/login") {
    const nextPath = request.nextUrl.searchParams.get("next") || "";
    const isAdminLogin = nextPath === adminPathPrefix || nextPath.startsWith(`${adminPathPrefix}?`);

    if (session) {
      if (isAdminLogin) {
        if (session.id === adminUserId) {
          return NextResponse.redirect(new URL(nextPath, request.url));
        }

        return NextResponse.next();
      }

      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      token
        ? {
            code: "session_replaced",
            error: "다른 기기에서 같은 계정으로 새 로그인이 발생했거나 로그인 시간이 만료되었습니다. 다시 로그인해 주세요.",
          }
        : { code: "login_required", error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  return redirectToLogin(request, pathname, token);
}

function redirectToLogin(request: NextRequest, pathname: string, token: string | undefined) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

  if (token) {
    loginUrl.searchParams.set("reason", replacedReason);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
