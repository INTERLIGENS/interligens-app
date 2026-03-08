
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

import { DANGER_TYPES } from "@/lib/community/validate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json();
  const { action, adminNotes } = body;

  const sub = await prisma.communitySubmission.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sub.status !== "pending" && sub.status !== "needs_info") {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }

  if (action === "reject" || action === "needs_info") {
    await prisma.communitySubmission.update({
      where: { id },
      data: { status: action, adminNotes: adminNotes ?? null },
    });
    await prisma.auditLog.create({ data: {
      action: action === "reject" ? "SUBMISSION_REJECT" : "SUBMISSION_NEEDS_INFO",
      actorId: "admin", meta: adminNotes ?? "",
    }});
    return NextResponse.json({ ok: true, status: action });
  }

  if (action === "approve") {
    // Upsert AddressLabel
    await prisma.addressLabel.upsert({
      where: { dedup_key: { chain: sub.chain, address: sub.address, labelType: sub.labelType, label: sub.label ?? sub.labelType, sourceUrl: `community:${id}` } },
      create: {
        address: sub.address, chain: sub.chain,
        labelType: sub.labelType, label: sub.label ?? sub.labelType,
        confidence: "low", sourceName: "community",
        sourceUrl: `community:${id}`,
        evidence: sub.txHash ?? sub.evidenceUrl ?? sub.message ?? "community",
        isActive: true,
      },
      update: {
        labelType: sub.labelType, label: sub.label ?? sub.labelType,
        isActive: true,
        evidence: sub.txHash ?? sub.evidenceUrl ?? sub.message ?? "community",
      },
    });
    await prisma.communitySubmission.update({
      where: { id },
      data: { status: "approved", adminNotes: adminNotes ?? null, linkedBatchId: null },
    });
    await prisma.riskSummaryCache.deleteMany({ where: { address: sub.address, chain: sub.chain } });
    await prisma.auditLog.create({ data: { action: "SUBMISSION_APPROVE", actorId: "admin", meta: `${sub.chain}:${sub.address}` }});
    return NextResponse.json({ ok: true, status: "approved" });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
