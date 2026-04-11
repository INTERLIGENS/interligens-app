/**
 * Retail Vision V2.1 — KolTokenInvolvement populator.
 *
 * Alimente la table pivot KOL↔token à partir des données existantes :
 *   - KolProceedsEvent  (sells / cex deposits observés on-chain)
 *   - KolPromotionMention (si dispo — sinon firstPromotionAt reste null)
 *   - KolWallet         (pour résoudre walletId)
 *
 * Règles :
 *   - upsert idempotent sur (kolHandle, chain, tokenMint)
 *   - conservateur : pas d'invention, null si la donnée manque
 *   - dry-run par défaut. Pour écrire en DB :
 *       SEED_INVOLVEMENT=1 pnpm tsx src/scripts/seed/kolTokenInvolvement.ts
 *
 * Limites connues (V2.1) :
 *   - KolProceedsEvent ne contient que des sells/deposits → firstBuyAt reste null
 *   - Si KolPromotionMention est vide → firstPromotionAt / isPromoted / avgDumpDelay restent null/false
 *   - Le corrélateur promo-to-dump (Phase 2) viendra enrichir ces champs
 */
import { prisma } from "@/lib/prisma";

interface EventRow {
  kolHandle: string;
  walletAddress: string;
  chain: string;
  tokenAddress: string;
  eventDate: Date;
  amountUsd: number | null;
  ambiguous: boolean;
  eventType: string;
}

interface MentionRow {
  kolHandle: string;
  walletId: string | null;
  chain: string;
  tokenMint: string;
  postedAt: Date;
}

interface Aggregate {
  kolHandle: string;
  chain: string;
  tokenMint: string;
  walletAddress: string | null;
  firstSellAt: Date | null;
  proceedsUsd: number;
  sellCount: number;
}

const SELL_TYPES = new Set(["dex_sell", "cex_deposit"]);

function aggKey(h: string, c: string, m: string) {
  return `${h}::${c.toUpperCase()}::${m}`;
}

async function main() {
  const dryRun = process.env.SEED_INVOLVEMENT !== "1";
  console.log(`[seed-involvement] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const events = await prisma.$queryRawUnsafe<EventRow[]>(`
    SELECT "kolHandle", "walletAddress", chain, "tokenAddress",
           "eventDate", "amountUsd", ambiguous, "eventType"
      FROM "KolProceedsEvent"
     WHERE "tokenAddress" IS NOT NULL AND "tokenAddress" <> ''
  `);
  console.log(`[seed-involvement] loaded ${events.length} proceeds events`);

  const mentions = await prisma.$queryRawUnsafe<MentionRow[]>(`
    SELECT "kolHandle", "walletId", chain, "tokenMint", "postedAt"
      FROM "KolPromotionMention"
  `);
  console.log(`[seed-involvement] loaded ${mentions.length} promotion mentions`);

  const wallets = await prisma.kolWallet.findMany({
    select: { id: true, address: true, chain: true, kolHandle: true },
  });
  const walletByAddr = new Map<string, string>();
  for (const w of wallets) {
    walletByAddr.set(`${w.kolHandle}::${w.chain.toUpperCase()}::${w.address}`, w.id);
  }

  const aggs = new Map<string, Aggregate>();
  for (const e of events) {
    const chain = (e.chain || "").toUpperCase();
    if (!chain || !e.tokenAddress) continue;
    const k = aggKey(e.kolHandle, chain, e.tokenAddress);
    let a = aggs.get(k);
    if (!a) {
      a = {
        kolHandle: e.kolHandle,
        chain,
        tokenMint: e.tokenAddress,
        walletAddress: e.walletAddress ?? null,
        firstSellAt: null,
        proceedsUsd: 0,
        sellCount: 0,
      };
      aggs.set(k, a);
    }
    if (SELL_TYPES.has(e.eventType)) {
      const d = new Date(e.eventDate);
      if (!a.firstSellAt || d < a.firstSellAt) a.firstSellAt = d;
      a.sellCount += 1;
      if (!e.ambiguous && typeof e.amountUsd === "number" && e.amountUsd > 0) {
        a.proceedsUsd += e.amountUsd;
      }
    }
  }

  const firstPromoByKey = new Map<string, Date>();
  const walletIdByKey = new Map<string, string>();
  for (const m of mentions) {
    const k = aggKey(m.kolHandle, m.chain, m.tokenMint);
    const d = new Date(m.postedAt);
    const prev = firstPromoByKey.get(k);
    if (!prev || d < prev) firstPromoByKey.set(k, d);
    if (m.walletId && !walletIdByKey.has(k)) walletIdByKey.set(k, m.walletId);
  }

  console.log(`[seed-involvement] derived ${aggs.size} involvement rows`);

  let written = 0;
  for (const a of aggs.values()) {
    const k = aggKey(a.kolHandle, a.chain, a.tokenMint);
    const firstPromotionAt = firstPromoByKey.get(k) ?? null;

    let walletId: string | null = walletIdByKey.get(k) ?? null;
    if (!walletId && a.walletAddress) {
      walletId = walletByAddr.get(`${a.kolHandle}::${a.chain}::${a.walletAddress}`) ?? null;
    }

    let avgDumpDelayMinutes: number | null = null;
    let isFrontRun = false;
    if (firstPromotionAt && a.firstSellAt) {
      if (a.firstSellAt < firstPromotionAt) {
        // Front-running: KOL sold BEFORE publishing the promo tweet.
        // avgDumpDelayMinutes is non-applicable in this case (would be negative).
        isFrontRun = true;
        console.warn("[seed-involvement] FRONT-RUNNING DETECTED", {
          kolHandle: a.kolHandle,
          tokenMint: a.tokenMint,
          firstSellAt: a.firstSellAt.toISOString(),
          firstPromotionAt: firstPromotionAt.toISOString(),
          leadMinutes: Math.round(
            (firstPromotionAt.getTime() - a.firstSellAt.getTime()) / 60_000
          ),
        });
      } else {
        avgDumpDelayMinutes = Math.round(
          (a.firstSellAt.getTime() - firstPromotionAt.getTime()) / 60_000
        );
      }
    }

    const proceedsUsd = Number(a.proceedsUsd.toFixed(2));
    const isPromoted = firstPromotionAt !== null;

    const summary = {
      kolHandle: a.kolHandle,
      chain: a.chain,
      tokenMint: a.tokenMint.slice(0, 10) + "…",
      walletId: walletId ? walletId.slice(0, 8) + "…" : null,
      firstPromotionAt: firstPromotionAt?.toISOString() ?? null,
      firstSellAt: a.firstSellAt?.toISOString() ?? null,
      avgDumpDelayMinutes,
      isFrontRun,
      proceedsUsd,
      isPromoted,
      sellCount: a.sellCount,
    };
    console.log("[seed-involvement]", summary);

    if (dryRun) continue;

    await prisma.kolTokenInvolvement.upsert({
      where: {
        kolHandle_chain_tokenMint: {
          kolHandle: a.kolHandle,
          chain: a.chain,
          tokenMint: a.tokenMint,
        },
      },
      create: {
        kolHandle: a.kolHandle,
        chain: a.chain,
        tokenMint: a.tokenMint,
        walletId: walletId ?? undefined,
        firstPromotionAt: firstPromotionAt ?? undefined,
        firstBuyAt: undefined,
        firstSellAt: a.firstSellAt ?? undefined,
        avgDumpDelayMinutes: avgDumpDelayMinutes ?? undefined,
        proceedsUsd: proceedsUsd,
        isPromoted,
        isFrontRun,
        lastComputedAt: new Date(),
      },
      update: {
        walletId: walletId ?? undefined,
        firstPromotionAt: firstPromotionAt ?? undefined,
        firstSellAt: a.firstSellAt ?? undefined,
        avgDumpDelayMinutes: isFrontRun ? null : (avgDumpDelayMinutes ?? undefined),
        proceedsUsd: proceedsUsd,
        isPromoted,
        isFrontRun,
        lastComputedAt: new Date(),
      },
    });
    written += 1;
  }

  console.log(`[seed-involvement] done — rows ${dryRun ? "previewed" : "written"}: ${dryRun ? aggs.size : written}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[seed-involvement] fatal", e);
  process.exit(1);
});
