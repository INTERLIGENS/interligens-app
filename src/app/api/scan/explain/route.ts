// src/app/api/scan/explain/route.ts
// RBAC: admin token required. Never returns entityName in retail mode.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/intel-vault/auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const address = searchParams.get("address");

  if (!chain || !address) {
    return NextResponse.json({ error: "chain et address requis" }, { status: 400 });
  }

  const labels = await prisma.addressLabel.findMany({
    where: { chain: chain as never, address },
    orderBy: { lastSeenAt: "desc" },
  });

  if (labels.length === 0) {
    return NextResponse.json({ match: false, chain, address });
  }

  const actorToken = req.headers.get("x-admin-token") ?? "admin";
  const isAdmin = actorToken === process.env.ADMIN_TOKEN;

  await prisma.auditLog.create({
    data: {
      action: "explain_request",
      actorId: actorToken.slice(0, 12),
      meta: JSON.stringify({ chain, address }),
    },
  });

  return NextResponse.json({
    match: true,
    chain,
    address,
    entries: labels.map(l => ({
      labelType: l.labelType,
      label: l.label,
      confidence: l.confidence,
      sourceName: l.sourceName,
      sourceUrl: l.sourceUrl,
      evidence: l.evidence,
      firstSeenAt: l.firstSeenAt,
      lastSeenAt: l.lastSeenAt,
      visibility: l.visibility,
      // entityName ONLY for admin, never retail
      ...(isAdmin && l.entityName ? { entityName: l.entityName } : {}),
    })),
  });
}
