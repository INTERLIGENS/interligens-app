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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isProd && isAdminRoute) {
    if (!checkBasicAuth(req)) return basicAuthFail();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
