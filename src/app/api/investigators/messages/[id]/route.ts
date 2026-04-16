import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSession(req: NextRequest) {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;
  return validateSession(token);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId: id, accessId: session.accessId },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          readBy: { where: { accessId: session.accessId } },
        },
      },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      status: conversation.status,
      participants: conversation.participants.map((p) => ({
        accessId: p.accessId,
        joinedAt: p.joinedAt,
      })),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        senderAccessId: m.senderAccessId,
        senderName: m.senderName,
        body: m.body,
        priority: m.priority,
        kind: m.kind,
        createdAt: m.createdAt,
        isRead: m.readBy.length > 0,
      })),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const unread = await prisma.message.findMany({
    where: {
      conversationId: id,
      senderAccessId: { not: session.accessId },
      readBy: { none: { accessId: session.accessId } },
    },
    select: { id: true },
  });

  if (unread.length > 0) {
    await prisma.messageRead.createMany({
      data: unread.map((m) => ({
        messageId: m.id,
        accessId: session.accessId,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.conversationParticipant.updateMany({
    where: { conversationId: id, accessId: session.accessId },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ success: true, markedRead: unread.length });
}
