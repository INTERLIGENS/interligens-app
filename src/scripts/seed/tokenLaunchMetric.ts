/**
 * Retail Vision V2.3 — TokenLaunchMetric populator.
 *
 * Pour chaque mint distinct présent dans KolTokenInvolvement, on appelle
 * src/lib/token/supplyConcentration.ts pour calculer :
 *   top3Pct, top10Pct, concentrationScore
 * (holderCount reste null en V2.3 — limite documentée).
 *
 * Puis :
 *   - upsert TokenLaunchMetric sur (chain, tokenMint)
 *   - update KolTokenInvolvement.launchMetricId pour les rows associées
 *
 * Idempotent. Dry-run par défaut. Pour écrire :
 *   SEED_LAUNCH=1 pnpm tsx src/scripts/seed/tokenLaunchMetric.ts
 *
 * Limites connues (V2.3) :
 *   - Top-N utilise getTokenLargestAccounts brut. LP/CEX/burn non filtrés,
 *     peut sur-estimer la concentration sur tokens avec gros pool addresses.
 *   - holderCount = null : getProgramAccounts complet est trop lourd pour ce
 *     sprint. À ouvrir en V2.4 si budget Helius autorise.
 *   - concentrationScore = 0.6 * top3Pct + 0.4 * top10Pct (borné 0-100).
 */
import { prisma } from "@/lib/prisma";
import { computeSupplyConcentration } from "@/lib/token/supplyConcentration";

async function main() {
  const dryRun = process.env.SEED_LAUNCH !== "1";
  console.log(`[seed-launch] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  if (!process.env.HELIUS_API_KEY) {
    console.error("[seed-launch] HELIUS_API_KEY not set — aborting");
    process.exit(1);
  }

  const mints = await prisma.$queryRawUnsafe<Array<{ chain: string; tokenMint: string }>>(
    `SELECT DISTINCT chain, "tokenMint"
       FROM "KolTokenInvolvement"
      WHERE "tokenMint" IS NOT NULL AND "tokenMint" <> \'\'
      ORDER BY chain, "tokenMint"`
  );
  console.log(`[seed-launch] found ${mints.length} distinct mint(s) in KolTokenInvolvement`);

  let upserted = 0, linked = 0, failed = 0;

  for (const { chain, tokenMint } of mints) {
    if (chain.toUpperCase() !== "SOL") {
      console.log(`[seed-launch] skip non-SOL chain=${chain} mint=${tokenMint}`);
      continue;
    }

    console.log(`[seed-launch] computing ${tokenMint}…`);
    const res = await computeSupplyConcentration(tokenMint);

    const summary = {
      mint: tokenMint,
      totalSupply: res.totalSupply,
      top3Pct: res.top3Pct,
      top10Pct: res.top10Pct,
      concentrationScore: res.concentrationScore,
      error: res.error,
      largestPreview: res.largest.slice(0, 3).map((h) => ({ addr: h.address.slice(0, 8) + "…", pct: h.pct })),
    };
    console.log("[seed-launch] result", summary);

    if (res.error || res.top3Pct == null) {
      failed += 1;
      continue;
    }

    if (dryRun) continue;

    try {
      const upserted_row = await prisma.tokenLaunchMetric.upsert({
        where: { chain_tokenMint: { chain: "SOL", tokenMint } },
        create: {
          chain: "SOL",
          tokenMint,
          totalSupply: res.totalSupply ?? undefined,
          top3Pct: res.top3Pct ?? undefined,
          top10Pct: res.top10Pct ?? undefined,
          holderCount: res.holderCount ?? undefined,
          concentrationScore: res.concentrationScore ?? undefined,
          source: res.source,
          raw: { largest: res.largest } as any,
        },
        update: {
          totalSupply: res.totalSupply ?? undefined,
          top3Pct: res.top3Pct ?? undefined,
          top10Pct: res.top10Pct ?? undefined,
          holderCount: res.holderCount ?? undefined,
          concentrationScore: res.concentrationScore ?? undefined,
          source: res.source,
          computedAt: new Date(),
          raw: { largest: res.largest } as any,
        },
      });
      upserted += 1;

      const upd = await prisma.kolTokenInvolvement.updateMany({
        where: { chain: "SOL", tokenMint },
        data: { launchMetricId: upserted_row.id },
      });
      linked += upd.count;
      console.log(`[seed-launch] linked ${upd.count} involvement row(s) to launchMetricId=${upserted_row.id}`);
    } catch (err) {
      failed += 1;
      console.warn("[seed-launch] upsert failed (soft)", {
        mint: tokenMint,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("[seed-launch] summary", {
    mintsProcessed: mints.length,
    upserted: dryRun ? `(preview)` : upserted,
    involvementLinked: dryRun ? `(preview)` : linked,
    failed,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[seed-launch] fatal", e);
  process.exit(1);
});
