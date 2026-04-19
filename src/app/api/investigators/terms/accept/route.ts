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
 * Beta-terms acceptance.
 *
 * IDOR hotfix: `profileId` and `betaCodeId` are derived from the signed
 * investigator_session cookie, never from the request body. If the body
 * still carries a `profileId` (legacy clients) it must match the session's
 * profile; mismatch is rejected with a generic 403. An attacker can no
 * longer accept terms on behalf of another investigator by forging a
 * body value.
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
  const termsVersion =
    typeof body.termsVersion === "string" ? body.termsVersion : "1.0";
  const termsLanguage = (
    typeof body.termsLanguage === "string" ? body.termsLanguage : "en"
  ) as LegalDocLanguage;
  const termsDocHash =
    typeof body.termsDocHash === "string" ? body.termsDocHash : "";
  const accepted = body.accepted === true;

  // If the caller supplies a profileId, it must match the session's
  // derived profile. A null session profile (legacy onboarding) can only
  // accept if the body also omits profileId — we never take a body value
  // when we have none to compare against.
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
  if (!termsDocHash) {
    return NextResponse.json({ error: "termsDocHash required" }, { status: 400 });
  }
  if (!["en", "fr"].includes(termsLanguage)) {
    return NextResponse.json({ error: "Invalid termsLanguage" }, { status: 400 });
  }

  let serverDoc;
  try {
    serverDoc = await getLegalDoc("terms", termsLanguage, termsVersion);
  } catch {
    return NextResponse.json(
      { error: "Terms document version not found" },
      { status: 404 }
    );
  }

  if (serverDoc.hash !== termsDocHash) {
    return NextResponse.json(
      { error: "Document integrity check failed — hash mismatch" },
      { status: 400 }
    );
  }

  try {
    const acceptance = await prisma.investigatorBetaTermsAcceptance.create({
      data: {
        // Always derive from session. Legacy testers with no profile row
        // get `null` here, matching the pre-hotfix behaviour for that path.
        profileId: ctx.profileId,
        betaCodeId: ctx.accessId,
        signerName,
        termsVersion,
        termsLanguage,
        termsDocHash,
        accepted: true,
        ipAddress: getClientIp(req),
      },
    });

    await prisma.investigatorProgramAuditLog.create({
      data: {
        profileId: ctx.profileId,
        event: "BETA_TERMS_ACCEPTED",
        metadata: {
          termsVersion,
          termsLanguage,
          termsDocHash: termsDocHash.slice(0, 16) + "...",
          signerName,
        },
      },
    });

    return NextResponse.json({
      success: true,
      acceptedAt: acceptance.acceptedAt,
    });
  } catch (err) {
    console.error("[investigators/terms] create failed", err);
    return NextResponse.json({ error: "Acceptance failed" }, { status: 500 });
  }
}
