/**
 * KolAlert builder — pure module shared by:
 *   - GET /api/token/[chain]/[address]/kol-alert  (public endpoint)
 *   - POST /api/mobile/v1/scan                    (iOS embedding)
 *
 * No NextRequest / NextResponse / rate-limit logic here. Callers wrap.
 *
 * Always returns a KolAlertPayload with `hasAlert` defined. Never throws
 * on data issues — fail soft to `{ hasAlert: false }`. Real exceptions
 * (DB unreachable etc.) propagate; callers decide whether to swallow them.
 */
import { prisma } from "@/lib/prisma";
import { isKolPublic } from "@/lib/kol/publishGate";
import {
  tigerScoreToLabel,
  dumpDelayToLabel,
  proceedsToLabel,
  concentrationToLabel,
  frontRunToLabel,
} from "@/lib/retail/labels";

export interface KolAlertKol {
  handle: string;
  displayName: string;
  tigerScore: number;
  tier: string;
  retailLabel: string;
  proceedsUsd: number;
  proceedsLabel: string;
  avgDumpDelayMinutes: number;
  avgDumpDelayLabel: string;
  isFrontRun: boolean;
  frontRunLabel: string;
  isPromoted: boolean;
  isFundedByProject: boolean;
  fundedByLabel: string;
  firstPromotionAt: string | null;
  firstSellAt: string | null;
}

export interface KolAlertLaunchMetric {
  top3Pct: number | null;
  top10Pct: number | null;
  holderCount: number | null;
  concentrationScore: number | null;
  concentrationLabel: string;
  computedAt: string | null;
}

export interface KolAlertPayload {
  hasAlert: boolean;
  chain: string;
  tokenAddress: string;
  kols: KolAlertKol[];
  summary: string;
  launchMetric: KolAlertLaunchMetric | null;
}

function emptyAlert(chain: string, tokenAddress: string): KolAlertPayload {
  return {
    hasAlert: false,
    chain,
    tokenAddress,
    kols: [],
    summary: "",
    launchMetric: null,
  };
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

export async function buildKolAlert(
  chainRaw: string,
  address: string
): Promise<KolAlertPayload> {
  const chain = (chainRaw || "").toUpperCase();
  if (!chain || !address) return emptyAlert(chain, address);

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
      launchMetric: {
        select: {
          top3Pct: true,
          top10Pct: true,
          holderCount: true,
          concentrationScore: true,
          computedAt: true,
        },
      },
    },
  });

  const published = involvements.filter((i) => i.kol && isKolPublic(i.kol));

  if (published.length === 0) return emptyAlert(chain, address);

  const kols: KolAlertKol[] = published.map((i) => {
    const tigerScore = deriveTigerScore(i.kol?.rugCount ?? 0, Number(i.proceedsUsd ?? 0));
    const tier = tigerScoreToLabel(tigerScore);
    const avgDelay = i.avgDumpDelayMinutes ?? 0;
    const proceedsUsd = Number(i.proceedsUsd ?? 0);
    const isFrontRun = i.isFrontRun;
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
      isFrontRun,
      frontRunLabel: frontRunToLabel(isFrontRun, i.avgDumpDelayMinutes),
      isPromoted: i.isPromoted,
      isFundedByProject: i.isFundedByProject,
      fundedByLabel: i.isFundedByProject ? "payé par le projet avant la promo" : "",
      firstPromotionAt: i.firstPromotionAt?.toISOString() ?? null,
      firstSellAt: i.firstSellAt?.toISOString() ?? null,
    };
  });

  const worst = kols.reduce((a, b) => (a.tigerScore >= b.tigerScore ? a : b));
  const hasFrontRunner = kols.some((k) => k.isFrontRun);
  const summary = hasFrontRunner
    ? "⚠️ FRONT-RUNNING DÉTECTÉ — un promoteur a vendu avant son tweet"
    : buildSummary(kols.length, worst);

  const launch = published.find((i) => i.launchMetric)?.launchMetric ?? null;
  const launchMetric: KolAlertLaunchMetric | null = launch
    ? {
        top3Pct: launch.top3Pct != null ? Number(launch.top3Pct) : null,
        top10Pct: launch.top10Pct != null ? Number(launch.top10Pct) : null,
        holderCount: launch.holderCount ?? null,
        concentrationScore: launch.concentrationScore ?? null,
        concentrationLabel: concentrationToLabel(
          launch.concentrationScore ?? null,
          launch.top3Pct != null ? Number(launch.top3Pct) : null
        ),
        computedAt: launch.computedAt?.toISOString() ?? null,
      }
    : null;

  return {
    hasAlert: true,
    chain,
    tokenAddress: address,
    kols,
    summary,
    launchMetric,
  };
}

/**
 * Wrap buildKolAlert with full fail-soft semantics. Used by callers
 * (e.g. mobile scan) that must never let an alert error break the
 * primary response. Always returns an empty alert on failure.
 */
export async function buildKolAlertSafe(
  chain: string,
  address: string
): Promise<KolAlertPayload> {
  try {
    return await buildKolAlert(chain, address);
  } catch (err) {
    console.warn("[kolAlert] fail-soft", {
      chain,
      address,
      err: err instanceof Error ? err.message : String(err),
    });
    return emptyAlert((chain || "").toUpperCase(), address);
  }
}
