// src/app/api/admin/pdf/list/route.ts
// Admin list endpoint used by /admin/pdf — returns one row per KolProfile with
// current PDF state and last Helius scan timestamp.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = requireAdminApi(req);
  if (guard) return guard;

  const profiles = await prisma.kolProfile.findMany({
    select: {
      handle: true,
      tier: true,
      publishStatus: true,
      pdfUrl: true,
      pdfGeneratedAt: true,
      pdfScore: true,
      pdfVersion: true,
      lastHeliusScan: true,
    },
    orderBy: [{ publishStatus: "asc" }, { handle: "asc" }],
  });

  return NextResponse.json({ rows: profiles });
}
