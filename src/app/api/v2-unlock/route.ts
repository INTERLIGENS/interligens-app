import { NextRequest, NextResponse } from "next/server";

/**
 * V2 preview password validation endpoint.
 *
 * Receives the shared password from the /unlock form, compares it against
 * the expected value, and — on success — sets the `v2_preview_access`
 * cookie so the proxy lets the visitor through to every public (forensic)
 * route. Independent of the beta NDA / investigator_session flow.
 *
 * No external auth library, no DB: a cookie + a string comparison.
 */

// ─────────────────────────────────────────────────────────────────────────
// DEFAULT PREVIEW PASSWORD
//
// Used ONLY when the `V2_PREVIEW_PASSWORD` environment variable is not set.
//
//        >>>  interligens-preview-2026  <<<
//
// Dood: give the string above to investors for the Vercel preview demo.
// To rotate it, set `V2_PREVIEW_PASSWORD` (to any value) in:
//   Vercel → Project → Settings → Environment Variables
// then redeploy. The env var always wins over this default.
// ─────────────────────────────────────────────────────────────────────────
const V2_PREVIEW_DEFAULT_PASSWORD = "interligens-preview-2026";

const V2_PREVIEW_COOKIE = "v2_preview_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function safeRedirect(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const redirect = safeRedirect(
    form.get("redirect") ? String(form.get("redirect")) : null,
  );

  const expected = process.env.V2_PREVIEW_PASSWORD || V2_PREVIEW_DEFAULT_PASSWORD;

  // Wrong password → back to /unlock with an error flag (preserve target).
  if (password !== expected) {
    const url = new URL("/unlock", req.url);
    url.searchParams.set("error", "1");
    if (redirect !== "/") url.searchParams.set("redirect", redirect);
    return NextResponse.redirect(url, 303);
  }

  // Correct → set the session cookie and bounce to the requested page.
  const res = NextResponse.redirect(new URL(redirect, req.url), 303);
  res.cookies.set(V2_PREVIEW_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
