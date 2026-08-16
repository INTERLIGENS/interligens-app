import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  isProceedsPublished,
  PROCEEDS_WITHDRAWN_CODE,
  PROCEEDS_WITHDRAWN_DETAIL,
} from "@/lib/kol/proceedsGate";

const prisma = new PrismaClient();

/**
 * P0 containment — cette route est celle qui composait le document
 * auto-contradictoire : `totalProceedsUsd` venait de KolProfile.totalDocumented
 * tandis que `proceedsByYear`, `eventCount`, `pricingQuality` et `computedAt`
 * venaient de KolProceedsSummary. Pour bkokoski, cela publiait 210 900 $ en
 * total et 900,06 $ dans sa propre ventilation — un facteur 234, estampillé
 * `pricingQuality: "high"`.
 *
 * On rend donc aussi l'état de publication : si le chiffre est retiré, la route
 * ne sert plus rien du tout. Servir la ventilation sans le total serait publier
 * un second chiffre à la place du premier.
 */
async function getCanonicalProceeds(
  handle: string,
): Promise<{ totalDocumented: number | null; proceedsPublication: string } | null> {
  const row = await prisma.kolProfile.findFirst({
    where: { handle: { equals: handle, mode: "insensitive" } },
    select: { totalDocumented: true, proceedsPublication: true },
  });
  return row ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  try {
    // P0 containment — la decision de retrait precede TOUTE lecture. Servir la
    // ventilation sans le total reviendrait a publier un second chiffre a la
    // place du premier ; on ne sert donc rien.
    // 409 et pas 404 : un 404 dirait « cette personne n'existe pas ». Le 409 dit
    // ce qui s'est reellement passe et reste vrai pour un auditeur. La donnee
    // sous-jacente est conservee en base.
    const canonical = await getCanonicalProceeds(handle);
    if (!isProceedsPublished(canonical)) {
      return NextResponse.json(
        {
          found: false,
          handle,
          code: PROCEEDS_WITHDRAWN_CODE,
          detail: PROCEEDS_WITHDRAWN_DETAIL,
        },
        { status: 409 },
      );
    }

    const summary = await prisma.$queryRaw`
      SELECT
        "kolHandle", "totalProceedsUsd", "proceedsByYear",
        "topWalletLabel", "topWalletProceedsUsd",
        "topTokenSymbol", "topTokenProceedsUsd",
        "largestEventUsd", "largestEventDate",
        "walletCount", "caseCount", "eventCount",
        confidence, "methodologyVersion", "computedAt",
        "coverageStatus", "coverageNote", "pricingQuality",
        "rolling24hUsd", "rolling7dUsd", "rolling30dUsd", "rolling365dUsd",
        "lastFlowComputedAt"
      FROM "KolProceedsSummary"
      WHERE "kolHandle" = ${handle}
      AND "reviewStatus" = 'published'
      LIMIT 1
    ` as any[];

    if (!summary.length) {
      return NextResponse.json({ found: false, handle, reason: "No published proceeds summary available" });
    }

    const s = summary[0];
    const toNum = (v: any) => (v == null ? 0 : Number(v));
    // Pin totalProceedsUsd to KolProfile.totalDocumented (authoritative Writer A value).
    // KolProceedsSummary may lag if computeProceedsForHandle ran while summary was stale.
    const canonicalTotal = canonical?.totalDocumented ?? null;
    return NextResponse.json({
      found: true,
      handle,
      totalProceedsUsd: canonicalTotal ?? s.totalProceedsUsd,
      proceedsByYear: typeof s.proceedsByYear === 'string' ? JSON.parse(s.proceedsByYear) : s.proceedsByYear,
      topWalletLabel: s.topWalletLabel ?? null,
      topWalletProceedsUsd: s.topWalletProceedsUsd ?? null,
      topTokenSymbol: s.topTokenSymbol ?? null,
      topTokenProceedsUsd: s.topTokenProceedsUsd ?? null,
      largestEventUsd: s.largestEventUsd ?? null,
      largestEventDate: s.largestEventDate ?? null,
      walletCount: Number(s.walletCount),
      caseCount: Number(s.caseCount),
      eventCount: Number(s.eventCount),
      confidence: s.confidence,
      methodologyVersion: s.methodologyVersion,
      computedAt: s.computedAt,
      coverageStatus: s.coverageStatus,
      coverageNote: s.coverageNote ?? null,
      pricingQuality: s.pricingQuality ?? null,
      summary: {
        rolling24hUsd: toNum(s.rolling24hUsd),
        rolling7dUsd: toNum(s.rolling7dUsd),
        rolling30dUsd: toNum(s.rolling30dUsd),
        rolling365dUsd: toNum(s.rolling365dUsd),
        lastFlowComputedAt: s.lastFlowComputedAt ?? null,
      },
    });
  } catch (err: any) {
    console.error("[proceeds/public]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
