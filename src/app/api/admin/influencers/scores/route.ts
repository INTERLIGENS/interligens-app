/**
 * src/app/api/admin/influencers/scores/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const scores = await prisma.$queryRaw<any[]>`
    SELECT s.*, i.handle
    FROM influencer_scores s
    JOIN influencers i ON i.id = s."influencerId"
    ORDER BY s.score DESC
    LIMIT 100
  `;

  return NextResponse.json({ scores, count: scores.length });
}
