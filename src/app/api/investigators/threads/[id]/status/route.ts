/**
 * PATCH /api/investigators/threads/[id]/status
 *
 * Update a thread's status. Investigator must be a participant.
 * Body: { status: "open" | "waiting_on_founder" | "waiting_on_investigator" | "resolved" }
 *
 * The same four values are auto-set by /api/investigators/messages (POST) and
 * /api/admin/messages (POST) — this endpoint is for manual overrides
 * (e.g. "Mark as resolved").
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const THREAD_STATUSES = [
  "open",
  "waiting_on_founder",
  "waiting_on_investigator",
  "resolved",
] as const;

type ThreadStatus = (typeof THREAD_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const token = getSessionTokenFromReq(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = await validateSession(token);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const status = body?.status as string | undefined;
  if (!status || !(THREAD_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "invalid_status", accepted: THREAD_STATUSES },
      { status: 400 },
    );
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId: id, accessId: session.accessId },
    select: { id: true },
  });
  if (!participant) {
    return NextResponse.json({ error: "not_a_participant" }, { status: 403 });
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { status: status as ThreadStatus },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json({ conversation: updated });
}
