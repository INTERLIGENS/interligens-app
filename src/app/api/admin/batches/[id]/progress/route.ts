import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
