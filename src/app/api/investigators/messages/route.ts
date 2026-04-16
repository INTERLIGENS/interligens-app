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

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { accessId: session.accessId } },
    },
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          readBy: { where: { accessId: session.accessId } },
        },
      },
      _count: {
        select: {
          messages: {
            where: {
              readBy: { none: { accessId: session.accessId } },
              senderAccessId: { not: session.accessId },
            },
          },
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      participants: c.participants.map((p) => ({
        accessId: p.accessId,
        joinedAt: p.joinedAt,
      })),
      lastMessage: c.messages[0]
        ? {
            body: c.messages[0].body.slice(0, 100),
            senderName: c.messages[0].senderName,
            priority: c.messages[0].priority,
            createdAt: c.messages[0].createdAt,
          }
        : null,
      unreadCount: c._count.messages,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const messageBody = typeof body.body === "string" ? body.body.slice(0, 5000).trim() : "";
  if (!messageBody) return NextResponse.json({ error: "body required" }, { status: 400 });

  const priority = body.priority === "urgent" ? "urgent" : "normal";
  const kind = typeof body.kind === "string" ? body.kind : "message";

  let conversationId: string;

  if (body.conversationId) {
    const exists = await prisma.conversationParticipant.findFirst({
      where: { conversationId: body.conversationId, accessId: session.accessId },
    });
    if (!exists) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    conversationId = body.conversationId;
  } else {
    const toAccessId = body.toAccessId || "founder";
    const conv = await prisma.conversation.create({
      data: {
        scopeType: "direct",
        participants: {
          create: [
            { accessId: session.accessId },
            { accessId: toAccessId },
          ],
        },
      },
    });
    conversationId = conv.id;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderAccessId: session.accessId,
      senderName: session.label,
      body: messageBody,
      priority,
      kind,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ success: true, messageId: message.id, conversationId });
}
