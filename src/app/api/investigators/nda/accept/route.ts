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
  const profileId = session.profileId;
  const betaCodeId = typeof body.betaCodeId === "string" ? body.betaCodeId : null;
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const ndaVersion = typeof body.ndaVersion === "string" ? body.ndaVersion : "1.0";
  const ndaLanguage = (typeof body.ndaLanguage === "string" ? body.ndaLanguage : "en") as LegalDocLanguage;
  const ndaDocHash = typeof body.ndaDocHash === "string" ? body.ndaDocHash : "";
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
        profileId,
        betaCodeId,
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
        profileId,
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
