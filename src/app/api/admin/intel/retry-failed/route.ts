import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const result = await prisma.founderIntelItem.updateMany({
    where: {
      summaryDone: false,
      summaryAttempts: { gte: 3 },
    },
    data: {
      summaryAttempts: 0,
      lastSummaryError: null,
    },
  });

  return NextResponse.json({ ok: true, reset: result.count });
}
