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
import {
  isProceedsPublished,
  PROCEEDS_WITHDRAWN_CODE,
  PROCEEDS_WITHDRAWN_DETAIL,
} from "@/lib/kol/proceedsGate";

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
    select: { handle: true, pdfUrl: true, proceedsPublication: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (!profile.pdfUrl) {
    return NextResponse.json({ error: "No PDF generated for this profile" }, { status: 404 });
  }

  // P0 containment — reports/{handle}/latest.pdf est un objet R2 FIGE. Il porte
  // le chiffre tel qu'il etait au moment de sa generation ; aucun filtre de
  // lecture applique en base ne le modifie. Le dossier @GordonGekko du
  // 2026-08-16 affiche « CASHOUTS DOCUMENTES $580K » et « TOTAL $579 645 »,
  // dont 485 000 $ proviennent d'une seule ligne d'import CSV, sous la mention
  // « CONFIDENTIEL — usage judiciaire ».
  //
  // On CESSE DE LE SERVIR. On ne le supprime pas : les 31 archives horodatees
  // sont la seule trace de ce qui a ete affirme, et a quelle date. Elles restent
  // accessibles avec les identifiants R2, pour l'audit et pour le dossier.
  if (!isProceedsPublished(profile)) {
    return NextResponse.json(
      {
        error: PROCEEDS_WITHDRAWN_CODE,
        detail: PROCEEDS_WITHDRAWN_DETAIL,
        handle: profile.handle,
      },
      { status: 409 },
    );
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
