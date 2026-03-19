/**
 * src/lib/surveillance/signals/recidivismScore.ts
 * Calcule et stocke le score de récidive par influenceur
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const SCORE_WEIGHTS = { BLATANT: 3, PROBABLE: 2, POSSIBLE: 1 };

export function computeScore(blatant: number, probable: number, possible: number): number {
  return blatant * SCORE_WEIGHTS.BLATANT + probable * SCORE_WEIGHTS.PROBABLE + possible * SCORE_WEIGHTS.POSSIBLE;
}

export function getScoreLabel(score: number): string {
  if (score === 0) return "CLEAN";
  if (score <= 2) return "WATCH";
  if (score <= 5) return "SUSPICIOUS";
  return "CONFIRMED_PATTERN";
}

export async function updateRecidivismScore(influencerId: string, periodDays = 30) {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const counts = await prisma.$queryRaw<
    { windowBucket: string; count: bigint }[]
  >`
    SELECT "windowBucket", COUNT(*) as count
    FROM signals
    WHERE "influencerId" = ${influencerId}
      AND "createdAt" >= ${since}
      AND type = 'SELL_WHILE_SHILLING'
    GROUP BY "windowBucket"
  `;

  const blatant = Number(counts.find((c) => c.windowBucket === "BLATANT")?.count ?? 0);
  const probable = Number(counts.find((c) => c.windowBucket === "PROBABLE")?.count ?? 0);
  const possible = Number(counts.find((c) => c.windowBucket === "POSSIBLE")?.count ?? 0);
  const score = computeScore(blatant, probable, possible);

  await prisma.$executeRaw`
    INSERT INTO influencer_scores (
      id, "influencerId", "periodDays", score,
      "blatantCount", "probableCount", "possibleCount", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${influencerId}, ${periodDays},
      ${score}, ${blatant}, ${probable}, ${possible}, NOW()
    )
    ON CONFLICT ("influencerId") DO UPDATE SET
      score = ${score},
      "blatantCount" = ${blatant},
      "probableCount" = ${probable},
      "possibleCount" = ${possible},
      "updatedAt" = NOW()
  `;

  return { influencerId, score, label: getScoreLabel(score), blatant, probable, possible };
}

export async function updateAllScores(periodDays = 30) {
  const influencers = await prisma.influencer.findMany({
    select: { id: true },
  });

  const results = [];
  for (const inf of influencers) {
    const result = await updateRecidivismScore(inf.id, periodDays);
    results.push(result);
  }
  return results;
}
