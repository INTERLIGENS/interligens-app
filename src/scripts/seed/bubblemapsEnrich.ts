/**
 * Retail Vision Phase 6C — Bubblemaps enricher.
 *
 * Pour chaque (chain, tokenMint) distinct dans KolTokenInvolvement :
 *   1. Fetch Bubblemaps top holders (fail-soft)
 *   2. Cross-reference avec KolWallet existants (same chain, address match)
 *   3. Si un ou plusieurs KolWallet sont dans le top-10 → signal coordination
 *   4. Enrichir TokenLaunchMetric.raw.bubblemaps si la row existe déjà
 *
 * Dry-run par défaut. Pour écrire :
 *   SEED_BUBBLEMAPS=1 pnpm tsx src/scripts/seed/bubblemapsEnrich.ts
 *
 * Log-only sinon. Ne crée aucune TokenLaunchMetric — seulement update des rows
 * existantes (tokenLaunchMetric.ts est responsable de la création initiale).
 */
import { prisma } from "@/lib/prisma";
import {
  fetchBubblemaps,
  findKolWalletsInTop10,
  mapChain,
  type BubblemapsChain,
} from "@/lib/token/bubblemaps";

interface Summary {
  tokensScanned: number;
  tokensWithData: number;
  tokensWithKolHolder: number;
  tokensEnriched: number;
  errors: number;
}

async function main() {
  const dryRun = process.env.SEED_BUBBLEMAPS !== "1";
  console.log(`[bubblemaps] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const rows = await prisma.$queryRawUnsafe<Array<{ chain: string; tokenMint: string }>>(
    `SELECT DISTINCT chain, "tokenMint"
       FROM "KolTokenInvolvement"
      WHERE "tokenMint" IS NOT NULL AND "tokenMint" <> ''
      ORDER BY chain, "tokenMint"`
  );
  console.log(`[bubblemaps] ${rows.length} distinct mint(s) in KolTokenInvolvement`);

  const walletRows = await prisma.kolWallet.findMany({
    where: { status: "active" },
    select: { address: true, chain: true, kolHandle: true },
  });

  const walletMapByChain = new Map<BubblemapsChain, Map<string, string>>();
  for (const w of walletRows) {
    const c = mapChain(w.chain);
    if (!c) continue;
    const inner = walletMapByChain.get(c) ?? new Map<string, string>();
    inner.set(w.address.toLowerCase(), w.kolHandle);
    walletMapByChain.set(c, inner);
  }

  const summary: Summary = {
    tokensScanned: 0,
    tokensWithData: 0,
    tokensWithKolHolder: 0,
    tokensEnriched: 0,
    errors: 0,
  };

  for (const { chain, tokenMint } of rows) {
    const bm = mapChain(chain);
    if (!bm) {
      console.log(`[bubblemaps] skip unsupported chain=${chain} mint=${tokenMint}`);
      continue;
    }
    summary.tokensScanned += 1;

    try {
      const result = await fetchBubblemaps(bm, tokenMint);
      if (result.error || result.top.length === 0) {
        console.log(`[bubblemaps]   ${chain} ${tokenMint.slice(0, 10)}… no data (${result.error ?? "empty"})`);
        continue;
      }
      summary.tokensWithData += 1;

      const walletMap = walletMapByChain.get(bm) ?? new Map();
      const signal = findKolWalletsInTop10(result, walletMap);
      if (signal.kolWalletsInTop10.length > 0) {
        summary.tokensWithKolHolder += 1;
        console.log(
          `[bubblemaps] 🎯 ${chain} ${tokenMint.slice(0, 10)}… ` +
            `top10Pct=${signal.top10Pct}% linked=${signal.linked} ` +
            `kolHolders=${signal.kolWalletsInTop10.length}`
        );
        for (const hit of signal.kolWalletsInTop10) {
          console.log(
            `          rank#${hit.rank} ${hit.kolHandle} ${hit.walletAddress.slice(0, 10)}… ${hit.pct}%`
          );
        }
      } else {
        console.log(
          `[bubblemaps]   ${chain} ${tokenMint.slice(0, 10)}… top10Pct=${signal.top10Pct}% (no KOL holder)`
        );
      }

      if (dryRun) continue;

      const existing = await prisma.tokenLaunchMetric.findUnique({
        where: { chain_tokenMint: { chain: chain.toUpperCase(), tokenMint } },
        select: { id: true, raw: true },
      });
      if (!existing) continue;

      const prevRaw =
        existing.raw && typeof existing.raw === "object" && !Array.isArray(existing.raw)
          ? (existing.raw as Record<string, unknown>)
          : {};

      const nextRaw = {
        ...prevRaw,
        bubblemaps: {
          fetchedAt: result.fetchedAt,
          source: result.source,
          top10Pct: signal.top10Pct,
          linked: signal.linked,
          kolWalletsInTop10: signal.kolWalletsInTop10,
          top10: result.top.slice(0, 10),
        },
      };

      await prisma.tokenLaunchMetric.update({
        where: { id: existing.id },
        data: { raw: nextRaw as never },
      });
      summary.tokensEnriched += 1;
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[bubblemaps] soft-fail ${chain} ${tokenMint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("[bubblemaps] summary", summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[bubblemaps] fatal", e);
  process.exit(1);
});
