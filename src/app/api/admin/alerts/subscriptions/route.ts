/**
 * src/app/api/admin/alerts/subscriptions/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const subs = await prisma.alertSubscription.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ subscriptions: subs, count: subs.length });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { email, webhookUrl, handles = [], severityThreshold = "PROBABLE" } = await req.json();

  if (!email && !webhookUrl) {
    return NextResponse.json({ error: "email or webhookUrl required" }, { status: 400 });
  }

  const sub = await prisma.alertSubscription.create({
    data: {
      id: randomUUID(),
      email: email ?? null,
      webhookUrl: webhookUrl ?? null,
      handles: JSON.stringify(handles),
      severityThreshold,
      status: "active",
    },
  });

  return NextResponse.json(sub, { status: 201 });
}
