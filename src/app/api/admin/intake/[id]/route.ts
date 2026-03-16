import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const { id } = await params;

  const record = await prisma.intakeRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const extracted = JSON.parse(record.extracted || "{}");
  const warnings  = JSON.parse(record.extractWarnings || "[]");
  const provenance = JSON.parse(record.provenance || "{}");

  return NextResponse.json({
    ...record,
    extracted: {
      ...extracted,
      addresses: (extracted.addresses ?? []).slice(0, 20), // sample
      handles:   (extracted.handles   ?? []).slice(0, 20),
      domains:   (extracted.domains   ?? []).slice(0, 10),
      txHashes:  (extracted.txHashes  ?? []).slice(0, 10),
      addressCount: (extracted.addresses ?? []).length,
      handleCount:  (extracted.handles   ?? []).length,
    },
    warnings,
    provenance,
    rawText: undefined, // never expose rawText in list
  });
}
