import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const deny = requireAdminApi(req);
  if (deny) return deny;

  const batch = await prisma.ingestionBatch.findUnique({
    where: { id: (await params).id },
    select: { status: true, processedRows: true, totalRows: true,
              processingStartedAt: true, processingEndedAt: true, errorMessage: true },
  });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pct = batch.totalRows > 0
    ? Math.round((batch.processedRows / batch.totalRows) * 100)
    : 0;

  return NextResponse.json({ ...batch, pct });
}
