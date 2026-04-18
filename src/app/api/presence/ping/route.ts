/**
 * POST /api/presence/ping
 *
 * Investigator-only heartbeat. validateSession bumps InvestigatorSession.lastSeenAt
 * (fire-and-forget); we also bump InvestigatorProfile.lastActiveAt — both columns
 * already exist in schema, no migration needed.
 *
 * Rate-limited in-memory to 1 req per 10s per session to prevent spam.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  hashSHA256,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 10_000;
const lastPing = new Map<string, number>();

export async function POST(req: NextRequest) {
  const token = getSessionTokenFromReq(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const session = await validateSession(token);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = hashSHA256(session.sessionId);
  const now = Date.now();
  const prev = lastPing.get(key) ?? 0;
  if (now - prev < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, throttled: true });
  }
  lastPing.set(key, now);

  // Bump profile-level last-active (used by presence list). Silent on failure —
  // profile may not exist for every access; presence is best-effort.
  prisma.investigatorProfile
    .updateMany({
      where: { accessId: session.accessId },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
