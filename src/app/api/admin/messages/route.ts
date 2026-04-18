import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  const feedbackWhere: Record<string, unknown> = {};
  if (status === "unread") feedbackWhere.status = "unread";
  if (type === "feedback") feedbackWhere.type = "feedback";

  const [feedbacks, conversations, unreadCount] = await Promise.all([
    prisma.feedbackEntry.findMany({
      where: feedbackWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.conversation.findMany({
      where: {
        participants: { some: { accessId: "founder" } },
      },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: {
          select: {
            messages: {
              where: {
                senderAccessId: { not: "founder" },
                readBy: { none: { accessId: "founder" } },
              },
            },
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.feedbackEntry.count({ where: { status: "unread" } }),
  ]);

  return NextResponse.json({
    feedbacks,
    conversations: conversations.map((c) => ({
      id: c.id,
      participants: c.participants.map((p) => p.accessId),
      lastMessage: c.messages[0] ?? null,
      unreadCount: c._count.messages,
    })),
    unreadCount,
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const messageBody = typeof body.body === "string" ? body.body.slice(0, 5000).trim() : "";
  if (!messageBody) return NextResponse.json({ error: "body required" }, { status: 400 });

  const toAccessId = typeof body.toAccessId === "string" ? body.toAccessId : "";
  const priority = body.priority === "urgent" ? "urgent" : "normal";

  // Optional explicit thread status override (e.g. quick-reply template #4
  // "Thread résolu…" sets this to "resolved"). Falls back to the default
  // "waiting_on_investigator" when the founder sends a message.
  const ALLOWED_STATUSES = [
    "open",
    "waiting_on_founder",
    "waiting_on_investigator",
    "resolved",
  ] as const;
  const overrideStatus =
    typeof body.overrideStatus === "string" &&
    (ALLOWED_STATUSES as readonly string[]).includes(body.overrideStatus)
      ? (body.overrideStatus as (typeof ALLOWED_STATUSES)[number])
      : null;
  const finalStatus = overrideStatus ?? "waiting_on_investigator";

  if (body.broadcast) {
    const actives = await prisma.investigatorAccess.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const results = [];
    for (const inv of actives) {
      const conv = await prisma.conversation.create({
        data: {
          scopeType: "broadcast",
          participants: {
            create: [{ accessId: "founder" }, { accessId: inv.id }],
          },
        },
      });
      const msg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderAccessId: "founder",
          senderName: "INTERLIGENS",
          body: messageBody,
          priority,
          kind: "broadcast",
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), status: finalStatus },
      });
      results.push({ accessId: inv.id, messageId: msg.id });
    }
    return NextResponse.json({ success: true, broadcast: true, count: results.length });
  }

  if (!toAccessId) return NextResponse.json({ error: "toAccessId required" }, { status: 400 });

  const conv = await prisma.conversation.create({
    data: {
      scopeType: "direct",
      participants: {
        create: [{ accessId: "founder" }, { accessId: toAccessId }],
      },
    },
  });

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderAccessId: "founder",
      senderName: "INTERLIGENS",
      body: messageBody,
      priority,
    },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ success: true, messageId: msg.id, conversationId: conv.id });
}
