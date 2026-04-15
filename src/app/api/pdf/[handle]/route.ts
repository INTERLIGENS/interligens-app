// src/app/api/pdf/[handle]/route.ts
//
// Signed proxy for R2-hosted KOL dossier PDFs.
//
//   GET /api/pdf/:handle
//     → 302 redirect to a short-lived R2 signed URL for reports/<handle>/latest.pdf
//
// Auth: admin token (x-admin-token / cookie) OR valid investigator session.
// Returns 401 if neither is present.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminApi } from "@/lib/security/adminAuth";
import { getSessionTokenFromReq, validateSession } from "@/lib/security/investigatorAuth";
import { getSignedDownloadUrl, isStorageEnabled } from "@/lib/storage/pdfStorage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (isAdminApi(req)) return true;
  const sessionToken = getSessionTokenFromReq(req);
  if (!sessionToken) return false;
  const session = await validateSession(sessionToken);
  return session !== null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ handle: string }> }
): Promise<NextResponse> {
  const { handle: rawHandle } = await ctx.params;
  const handle = decodeURIComponent(rawHandle);

  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const authorized = await isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.kolProfile.findUnique({
    where: { handle },
    select: { handle: true, pdfUrl: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (!profile.pdfUrl) {
    return NextResponse.json({ error: "No PDF generated for this profile" }, { status: 404 });
  }

  if (!isStorageEnabled()) {
    return NextResponse.json({ error: "R2 storage disabled" }, { status: 503 });
  }

  const key = `reports/${handle}/latest.pdf`;
  const signedUrl = await getSignedDownloadUrl(key);
  if (!signedUrl) {
    return NextResponse.json({ error: "Failed to sign PDF URL" }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl, { status: 302 });
}
