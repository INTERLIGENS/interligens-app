import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const batch = await prisma.ingestionBatch.findUnique({ where: { id: (await params).id } });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (batch.status === "approved") {
    return NextResponse.json({ error: "Cannot reject an approved batch" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.ingestionBatch.update({
      where: { id: (await params).id },
      data: { status: "rejected", updatedAt: new Date() },
    }),
    prisma.rawDocument.updateMany({
      where: { batchId: (await params).id },
      data: { deleted: true } as never,
    }),
    prisma.auditLog.create({
      data: {
        action: "BATCH_REJECT",
        actorId: "admin",
        batchId: (await params).id,
        meta: JSON.stringify({ batchId: (await params).id }),
      },
    }),
  ]);

  return NextResponse.json({ rejected: true, id: (await params).id });
}
