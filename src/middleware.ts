import { NextRequest, NextResponse } from "next/server";

function prefersFR(req: NextRequest) {
  const al = req.headers.get("accept-language") || "";
  return al.toLowerCase().includes("fr");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ignore next/static + api
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // auto redirect for root + /demo
  if (pathname === "/" || pathname === "/demo") {
    const locale = prefersFR(req) ? "fr" : "en";
    const dest = pathname === "/demo" ? `/${locale}/demo` : `/${locale}`;
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/demo"],
};
