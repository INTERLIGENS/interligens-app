/**
 * src/app/api/admin/influencers/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json();
  const { handle, platform = "x", metadata, wallets = [] } = body;

  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const influencer = await prisma.influencer.upsert({
    where: { handle },
    create: { handle, platform, metadata: metadata ?? {} },
    update: { metadata: metadata ?? {}, updatedAt: new Date() },
  });

  for (const w of wallets) {
    await prisma.wallet.upsert({
      where: { address_chain: { address: w.address.toLowerCase(), chain: w.chain ?? "ethereum" } },
      create: {
        address: w.address.toLowerCase(),
        chain: w.chain ?? "ethereum",
        influencerId: influencer.id,
        verifiedMethod: w.verifiedMethod ?? "MANUAL",
        verifiedAt: new Date(),
        confidence: w.confidence ?? 1.0,
        ensName: w.ensName ?? null,
      },
      update: { influencerId: influencer.id, confidence: w.confidence ?? 1.0 },
    });
  }

  return NextResponse.json(
    { influencer, walletsCount: wallets.length },
    { status: 201 }
  );
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const influencers = await prisma.influencer.findMany({
    include: {
      wallets: true,
      _count: { select: { socialPosts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ influencers, count: influencers.length });
}
