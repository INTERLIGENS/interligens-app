import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLegalDoc, type LegalDocLanguage } from "@/lib/investigators/legalDocs";
import { validateOnboardingSessionForApi } from "@/lib/investigators/accessGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(req: NextRequest) {
  const session = await validateOnboardingSessionForApi();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  // profileId is now trusted to the session, not taken from the request body,
  // so attackers can't spoof acceptances for other investigators.
  const profileId = session.profileId;
  const betaCodeId = typeof body.betaCodeId === "string" ? body.betaCodeId : null;
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const termsVersion = typeof body.termsVersion === "string" ? body.termsVersion : "1.0";
  const termsLanguage = (typeof body.termsLanguage === "string" ? body.termsLanguage : "en") as LegalDocLanguage;
  const termsDocHash = typeof body.termsDocHash === "string" ? body.termsDocHash : "";
  const accepted = body.accepted === true;

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
        profileId,
        betaCodeId,
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
        profileId,
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
