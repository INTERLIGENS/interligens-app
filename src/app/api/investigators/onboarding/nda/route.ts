import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultAccess, logAudit } from "@/lib/vault/auth.server";

export async function POST(request: NextRequest) {
  const ctx = await getVaultAccess(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { signerName, ndaVersion, ndaDocHash, accepted } = body as {
    signerName?: string;
    ndaVersion?: string;
    ndaDocHash?: string;
    accepted?: boolean;
  };

  if (accepted !== true) {
    return NextResponse.json({ error: "must_accept" }, { status: 400 });
  }
  if (!signerName || typeof signerName !== "string" || !signerName.trim()) {
    return NextResponse.json({ error: "signer_required" }, { status: 400 });
  }
  if (ndaVersion !== "v1.0") {
    return NextResponse.json({ error: "unsupported_version" }, { status: 400 });
  }
  if (!ndaDocHash || !/^[a-f0-9]{64}$/.test(ndaDocHash)) {
    return NextResponse.json({ error: "bad_doc_hash" }, { status: 400 });
  }

  // Idempotence — pivot on investigatorAccessId, not profileId
  const existing = await prisma.vaultNdaAcceptance.findUnique({
    where: { investigatorAccessId: ctx.access.id },
  });
  if (existing) {
    return NextResponse.json({ success: true, alreadySigned: true });
  }

  const xff = request.headers.get("x-forwarded-for");
  const rawIp = xff ? xff.split(",")[0]?.trim() : null;

  await prisma.vaultNdaAcceptance.create({
    data: {
      investigatorAccessId: ctx.access.id,
      profileId: null, // linked during workspace creation
      ndaVersion,
      ndaDocHash,
      signerName: signerName.trim(),
      ipAddress: rawIp,
    },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: null,
    workspaceId: null,
    action: "NDA_SIGNED",
    actor: ctx.access.label,
    request,
    metadata: { ndaVersion, ndaDocHash },
  });

  return NextResponse.json({ success: true });
}
