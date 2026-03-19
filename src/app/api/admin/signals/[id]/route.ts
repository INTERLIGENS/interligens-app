/**
 * src/app/api/admin/signals/[id]/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;

  const signal = await prisma.signal.findUnique({
    where: { id },
    include: {
      influencer: { select: { handle: true, metadata: true } },
      socialPost: true,
      onchainEvent: true,
    },
  });

  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Score récidive
  const score = await prisma.$queryRaw<any[]>`
    SELECT * FROM influencer_scores WHERE "influencerId" = ${signal.influencerId} LIMIT 1
  `;

  return NextResponse.json({ signal, recidivismScore: score[0] ?? null });
}
