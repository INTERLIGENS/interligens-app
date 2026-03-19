/**
 * src/app/api/admin/social/watchlist/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const watchlist = await prisma.socialWatchlist.findMany({
    orderBy: { createdAt: "desc" },
    
  });

  return NextResponse.json({ watchlist, count: watchlist.length });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { handle, provider = "nitter_rss" } = await req.json();
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const influencer = await prisma.influencer.upsert({
    where: { handle },
    create: { handle, platform: "x" },
    update: {},
  });

  const entry = await prisma.socialWatchlist.upsert({
    where: { influencerId: influencer.id },
    create: {
      id: randomUUID(),
      influencerId: influencer.id,
      handle,
      provider,
      status: "active",
    },
    update: { status: "active", provider },
  });

  return NextResponse.json(entry, { status: 201 });
}
