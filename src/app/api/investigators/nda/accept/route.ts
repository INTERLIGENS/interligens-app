import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLegalDoc, type LegalDocLanguage } from "@/lib/investigators/legalDocs";
import { getInvestigatorSessionContext } from "@/lib/investigators/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Legacy beta NDA acceptance (distinct from `/onboarding/nda` which writes
 * the vault-scoped `VaultNdaAcceptance` once a workspace exists).
 *
 * IDOR hotfix: `profileId` and `betaCodeId` are now derived from the signed
 * investigator_session cookie, never from the request body. Same pattern as
 * `/terms/accept` — keeps the onboarding path working (session with no
 * profile yet → both fields null, matches legacy behaviour) while closing
 * the spoof vector where an attacker forged an NDA acceptance on behalf of
 * another investigator.
 */
export async function POST(req: NextRequest) {
  const ctx = await getInvestigatorSessionContext(req);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const suppliedProfileId =
    typeof body.profileId === "string" ? body.profileId : null;
  const signerName =
    typeof body.signerName === "string" ? body.signerName.trim() : "";
  const ndaVersion =
    typeof body.ndaVersion === "string" ? body.ndaVersion : "1.0";
  const ndaLanguage = (
    typeof body.ndaLanguage === "string" ? body.ndaLanguage : "en"
  ) as LegalDocLanguage;
  const ndaDocHash =
    typeof body.ndaDocHash === "string" ? body.ndaDocHash : "";
  const accepted = body.accepted === true;

  // If the client supplies a profileId it must match the session's derived
  // profile. Generic 403 — no hint that another profile exists.
  if (suppliedProfileId && suppliedProfileId !== ctx.profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!accepted) {
    return NextResponse.json(
      { error: "Acceptance must be explicit" },
      { status: 400 }
    );
  }
  if (!signerName) {
    return NextResponse.json({ error: "signerName required" }, { status: 400 });
  }
  if (!ndaDocHash) {
    return NextResponse.json({ error: "ndaDocHash required" }, { status: 400 });
  }
  if (!["en", "fr"].includes(ndaLanguage)) {
    return NextResponse.json({ error: "Invalid ndaLanguage" }, { status: 400 });
  }

  // Integrity check: compute server-side hash of the exact document file,
  // compare against the client-submitted hash computed on the displayed text.
  let serverDoc;
  try {
    serverDoc = await getLegalDoc("nda", ndaLanguage, ndaVersion);
  } catch {
    return NextResponse.json(
      { error: "NDA document version not found" },
      { status: 404 }
    );
  }

  if (serverDoc.hash !== ndaDocHash) {
    return NextResponse.json(
      { error: "Document integrity check failed — hash mismatch" },
      { status: 400 }
    );
  }

  try {
    const acceptance = await prisma.investigatorNdaAcceptance.create({
      data: {
        // Always derive from session. Legacy testers with no profile row
        // store null here, matching the pre-hotfix behaviour for that path.
        profileId: ctx.profileId,
        betaCodeId: ctx.accessId,
        signerName,
        ndaVersion,
        ndaLanguage,
        ndaDocHash,
        accepted: true,
        ipAddress: getClientIp(req),
      },
    });

    await prisma.investigatorProgramAuditLog.create({
      data: {
        profileId: ctx.profileId,
        event: "NDA_SIGNED",
        metadata: {
          ndaVersion,
          ndaLanguage,
          ndaDocHash: ndaDocHash.slice(0, 16) + "...",
          signerName,
        },
      },
    });

    // TODO: send NDA confirmation email via Resend once the template is ready.
    console.log(`[investigators/nda] signed by ${signerName} (${ndaLanguage} v${ndaVersion})`);

    return NextResponse.json({
      success: true,
      signedAt: acceptance.signedAt,
    });
  } catch (err) {
    console.error("[investigators/nda] create failed", err);
    return NextResponse.json({ error: "Acceptance failed" }, { status: 500 });
  }
}
