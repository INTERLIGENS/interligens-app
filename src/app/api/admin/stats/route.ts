import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const [sources, labels, batches] = await Promise.all([
    prisma.sourceRegistry.count({ where: { status: "active" } }),
    prisma.addressLabel.count(),
    prisma.ingestionBatch.count(),
  ]);

  return NextResponse.json({ sources, labels, batches });
}
