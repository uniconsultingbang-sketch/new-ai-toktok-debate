import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthConfigured, verifySessionToken } from "@/lib/auth";

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

  const session = await verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (pathname === "/login") {
    if (session) {
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
