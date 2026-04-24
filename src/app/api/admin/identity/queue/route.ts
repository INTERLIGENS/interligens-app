// src/app/api/admin/identity/queue/route.ts
// GET /api/admin/identity/queue
// Returns all pending identity.review_required events with candidate matches.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewPayload = {
  address?: string;
  chain?: string;
  confidence?: string;
  evidence?: string[];
};

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const events = await prisma.domainEvent.findMany({
    where: { type: "identity.review_required", status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // For each event, find nearby KolWallet candidates on same chain
  const enriched = await Promise.all(
    events.map(async (ev) => {
      const p = ev.payload as ReviewPayload;
      const address = p.address ?? "";
      const chain = p.chain ?? "";

      // Candidate matches: wallets on same chain whose address shares a prefix
      // (first 6 chars) — cheap heuristic to surface likely clusters
      const prefix = address.slice(0, 6).toLowerCase();
      const candidates = address
        ? await prisma.kolWallet.findMany({
            where: {
              chain: { equals: chain, mode: "insensitive" },
              status: "active",
              address: { startsWith: prefix, mode: "insensitive" },
            },
            select: {
              kolHandle: true,
              address: true,
              label: true,
              confidence: true,
              attributionStatus: true,
            },
            take: 5,
          })
        : [];

      return {
        eventId: ev.id,
        address,
        chain,
        confidence: p.confidence ?? "unresolved",
        evidence: p.evidence ?? [],
        candidateMatches: candidates,
        createdAt: ev.createdAt,
        ageMs: Date.now() - new Date(ev.createdAt).getTime(),
      };
    })
  );

  return NextResponse.json({
    total: enriched.length,
    items: enriched,
  });
}
