/**
 * GET /api/presence/list
 *
 * Returns active investigators with their most-recent lastActiveAt (user action)
 * and lastSeenAt (session heartbeat). Investigator-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getSessionTokenFromReq(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await validateSession(token);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const profiles = await prisma.investigatorProfile.findMany({
    where: {
      lastActiveAt: { gt: cutoff },
      accessState: "ACTIVE",
    },
    select: { handle: true, lastActiveAt: true },
    orderBy: { lastActiveAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    investigators: profiles.map((p) => ({
      handle: p.handle,
      lastSeenAt: p.lastActiveAt?.toISOString() ?? null,
    })),
    now: new Date().toISOString(),
    currentLabel: session.label,
  });
}
