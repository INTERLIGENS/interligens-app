import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = await prisma.ingestionBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (batch.status === "approved") {
    return NextResponse.json({ error: "Cannot reject an approved batch" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.ingestionBatch.update({
      where: { id: params.id },
      data: { status: "rejected", updatedAt: new Date() },
    }),
    prisma.rawDocument.updateMany({
      where: { batchId: params.id },
      data: { deleted: true } as never,
    }),
    prisma.auditLog.create({
      data: {
        action: "BATCH_REJECT",
        actorId: "admin",
        batchId: params.id,
        meta: JSON.stringify({ batchId: params.id }),
      },
    }),
  ]);

  return NextResponse.json({ rejected: true, id: params.id });
}
