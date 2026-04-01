// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

function basicAuthFail() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="INTERLIGENS Admin"' },
  });
}

function checkBasicAuth(req: NextRequest): boolean {
  const user = process.env.ADMIN_BASIC_USER;
  const pass = process.env.ADMIN_BASIC_PASS;
  if (!user || !pass) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const [u, ...rest] = decoded.split(":");
  return u === user && rest.join(":") === pass;
}

function checkInvestigatorCookie(req: NextRequest): boolean {
  const envToken = process.env.INVESTIGATOR_TOKEN;
  if (!envToken) return false;
  const cookie = req.cookies.get("investigator_token")?.value;
  if (!cookie) return false;
  return cookie === envToken;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin routes — basic auth in prod
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isProd && isAdminRoute) {
    if (!checkBasicAuth(req)) return basicAuthFail();
  }

  // Investigator routes — cookie auth (login page + auth API excluded)
  const isInvestigatorRoute =
    (pathname.startsWith("/en/investigator") && !pathname.startsWith("/en/investigator/login")) ||
    (pathname.startsWith("/api/investigator") && !pathname.startsWith("/api/investigator/auth"));
  if (isInvestigatorRoute) {
    if (!checkInvestigatorCookie(req)) {
      // Redirect page requests to login, block API with 401
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/en/investigator/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/en/investigator/:path*",
    "/api/investigator/:path*",
  ],
};
