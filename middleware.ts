import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifyActiveSessionToken } from "@/lib/auth";

const adminPathPrefix = "/admin";
const adminUserId = process.env.ADMIN_USER_ID?.trim() || "demo03";

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

  if (pathname === adminPathPrefix || pathname.startsWith(`${adminPathPrefix}/`)) {
    if (!isAuthConfigured()) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    const session = await verifyActiveSessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (session.id !== adminUserId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const session = await verifyActiveSessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

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
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
