/**
 * src/app/api/admin/casefiles/[id]/route.ts
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

  const casefile = await prisma.$queryRaw<any[]>`
    SELECT c.*, s."t0PostUrl", s."windowBucket", s.severity,
           i.handle
    FROM casefiles c
    JOIN signals s ON s.id = c."signalId"
    JOIN influencers i ON i.id = s."influencerId"
    WHERE c.id = ${id}
    LIMIT 1
  `;

  if (!casefile[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(casefile[0]);
}
