import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  tigerScoreToLabel,
  dumpDelayToLabel,
  proceedsToLabel,
} from "@/lib/retail/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const ipBucket = new Map<string, { count: number; windowStart: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = ipBucket.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    ipBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  b.count += 1;
  return b.count <= MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> }
) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { chain: chainRaw, address } = await params;
  const chain = chainRaw.toUpperCase();
  if (!chain || !address) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const involvements = await prisma.kolTokenInvolvement.findMany({
    where: { chain, tokenMint: address },
    include: {
      kol: {
        select: {
          handle: true,
          displayName: true,
          rugCount: true,
          totalScammed: true,
          publishable: true,
          publishStatus: true,
          riskFlag: true,
        },
      },
    },
  });

  const published = involvements.filter(
    (i) => i.kol?.publishable && i.kol?.publishStatus === "published"
  );

  if (published.length === 0) {
    return NextResponse.json({
      hasAlert: false,
      chain,
      tokenAddress: address,
    });
  }

  const kols = published.map((i) => {
    const tigerScore = deriveTigerScore(i.kol?.rugCount ?? 0, Number(i.proceedsUsd ?? 0));
    const tier = tigerScoreToLabel(tigerScore);
    const avgDelay = i.avgDumpDelayMinutes ?? 0;
    const proceedsUsd = Number(i.proceedsUsd ?? 0);
    return {
      handle: i.kolHandle,
      displayName: i.kol?.displayName ?? i.kolHandle,
      tigerScore,
      tier: tier.tier,
      retailLabel: tier.label,
      proceedsUsd,
      proceedsLabel: proceedsToLabel(proceedsUsd),
      avgDumpDelayMinutes: avgDelay,
      avgDumpDelayLabel: dumpDelayToLabel(avgDelay),
      isPromoted: i.isPromoted,
      isFundedByProject: i.isFundedByProject,
      fundedByLabel: i.isFundedByProject
        ? "payé par le projet avant la promo"
        : "",
      firstPromotionAt: i.firstPromotionAt?.toISOString() ?? null,
      firstSellAt: i.firstSellAt?.toISOString() ?? null,
    };
  });

  const worst = kols.reduce((a, b) => (a.tigerScore >= b.tigerScore ? a : b));
  const summary = buildSummary(kols.length, worst);

  return NextResponse.json({
    hasAlert: true,
    kols,
    summary,
    chain,
    tokenAddress: address,
  });
}

function deriveTigerScore(rugCount: number, proceedsUsd: number): number {
  let score = 0;
  score += Math.min(40, rugCount * 10);
  score += Math.min(40, Math.floor(proceedsUsd / 10_000));
  score += 20;
  return Math.max(0, Math.min(100, score));
}

function buildSummary(
  count: number,
  worst: { displayName: string; retailLabel: string; proceedsUsd: number }
): string {
  if (count === 1) {
    return `${worst.displayName} est impliqué sur ce token — ${worst.retailLabel}.`;
  }
  return `${count} KOLs surveillés sont impliqués sur ce token. Le plus à risque : ${worst.displayName} (${worst.retailLabel}).`;
}
