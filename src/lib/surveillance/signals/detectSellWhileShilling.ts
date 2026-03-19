/**
 * src/lib/surveillance/signals/detectSellWhileShilling.ts
 * Détecteur principal — corrèle posts X avec ventes on-chain
 */

import { prisma } from "@/lib/prisma";
import { extractTokensFromText } from "./tokenExtractor";
import { computeHoldingAtTime } from "./holdingsComputer";
import { classifyWindow } from "./windowClassifier";
import { randomUUID } from "crypto";

const HOLDING_PCT_THRESHOLD = parseFloat(process.env.HOLDING_PCT_THRESHOLD ?? "0.25");
const USD_THRESHOLD = parseFloat(process.env.USD_THRESHOLD ?? "2500");

export async function detectForInfluencer(
  influencerId: string,
  sinceDays = 30
): Promise<{ signalsCreated: number; skipped: number; errors: number }> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  // Récupérer les posts capturés avec texte
  const posts = await prisma.socialPost.findMany({
    where: {
      influencerId,
      captureStatus: "COMPLETED",
      capturedAtUtc: { gte: since },
      textExcerpt: { not: null },
    },
  });

  // Récupérer les wallets de l'influenceur
  const wallets = await prisma.wallet.findMany({
    where: { influencerId, chain: "ethereum" },
    select: { address: true },
  });

  if (wallets.length === 0 || posts.length === 0) return { signalsCreated: 0, skipped: 0, errors: 0 };

  let signalsCreated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    const t0 = post.postedAtUtc ?? post.capturedAtUtc;
    const tokens = extractTokensFromText(post.textExcerpt ?? "");

    if (tokens.length === 0) { skipped++; continue; }

    for (const { tokenAddress } of tokens) {
      for (const wallet of wallets) {
        try {
          // Vérifier que le wallet détenait le token AVANT le post
          const holdingBefore = await computeHoldingAtTime(wallet.address, tokenAddress, t0);
          if (holdingBefore <= BigInt(0)) continue;

          // Chercher une vente après le post dans les 7 jours
          const t1Max = new Date(t0.getTime() + 7 * 24 * 60 * 60 * 1000);
          const sellEvents = await prisma.$queryRaw<any[]>`
            SELECT id, "txHash", "blockNumber", "blockTimeUtc",
                   "amountRaw", direction, counterparty, "isCexDeposit", "cexName"
            FROM onchain_events
            WHERE "walletAddress" = ${wallet.address.toLowerCase()}
              AND "tokenAddress" = ${tokenAddress.toLowerCase()}
              AND direction = 'out'
              AND "blockTimeUtc" > ${t0}
              AND "blockTimeUtc" <= ${t1Max}
            ORDER BY "blockTimeUtc" ASC
            LIMIT 1
          `;

          if (sellEvents.length === 0) continue;

          const sellEvent = sellEvents[0];
          const t1 = new Date(sellEvent.blockTimeUtc);
          const window = classifyWindow(t0, t1);

          if (!window.bucket) continue;

          // Vérifier seuil de vente
          const amountRaw = BigInt(sellEvent.amountRaw ?? "0");
          const pct = holdingBefore > BigInt(0)
            ? Number((amountRaw * BigInt(10000)) / holdingBefore) / 100
            : 0;

          if (pct < HOLDING_PCT_THRESHOLD * 100) continue;

          // Dedup — éviter doublon sur même post + tx
          const existing = await prisma.$queryRaw<any[]>`
            SELECT id FROM signals
            WHERE "influencerId" = ${influencerId}
              AND "t0PostUrl" = ${post.postUrl}
              AND "t1TxHash" = ${sellEvent.txHash}
            LIMIT 1
          `;
          if (existing.length > 0) continue;

          // Créer le signal
          await prisma.$executeRaw`
            INSERT INTO signals (
              id, type, "influencerId", "walletAddress", "tokenAddress",
              "t0PostUrl", "t0PostedAtUtc", "t0CapturedAtUtc", "t0CapturedManifestSha256",
              "t0Post", "t1TxHash", "t1BlockNumber", "t1BlockTimeUtc", "t1Event",
              direction, "amountRaw", "holdingBeforeRaw", "soldPctOfHolding",
              "windowBucket", "windowMinutes", severity, confidence,
              "evidenceManifestSha256", "socialPostId", "onchainEventId",
              "evidenceRefs", notes, "createdAt"
            ) VALUES (
              ${randomUUID()}, 'SELL_WHILE_SHILLING', ${influencerId},
              ${wallet.address.toLowerCase()}, ${tokenAddress},
              ${post.postUrl}, ${post.postedAtUtc}, ${post.capturedAtUtc},
              ${post.manifestSha256}, ${t0},
              ${sellEvent.txHash}, ${sellEvent.blockNumber}, ${t1}, ${t1},
              'out', ${sellEvent.amountRaw}, ${holdingBefore.toString()}, ${pct},
              ${window.bucket}, ${window.windowMinutes}, ${window.severity}, ${window.confidence},
              ${post.manifestSha256}, ${post.id}, ${sellEvent.id},
              ${JSON.stringify({
                txExplorer: `https://etherscan.io/tx/${sellEvent.txHash}`,
                manifestSha256: post.manifestSha256,
                isCexDeposit: sellEvent.isCexDeposit,
                cexName: sellEvent.cexName,
              })}::jsonb,
              ${'Wallet sold ' + pct.toFixed(1) + '% of holdings ' + window.windowMinutes + ' min after post. Facts only — not an accusation.'},
              NOW()
            )
          `;

          signalsCreated++;
        } catch (err: any) {
          errors++;
          console.error(`[detect] error for ${wallet.address} / ${tokenAddress}: ${err.message}`);
        }
      }
    }
  }

  return { signalsCreated, skipped, errors };
}

export async function detectAllInfluencers(sinceDays = 30) {
  const influencers = await prisma.influencer.findMany({
    where: { wallets: { some: { chain: "ethereum" } } },
    select: { id: true, handle: true },
  });

  let total = { signalsCreated: 0, skipped: 0, errors: 0, influencersProcessed: 0 };

  for (const inf of influencers) {
    const result = await detectForInfluencer(inf.id, sinceDays);
    total.signalsCreated += result.signalsCreated;
    total.skipped += result.skipped;
    total.errors += result.errors;
    total.influencersProcessed++;
  }

  return total;
}
