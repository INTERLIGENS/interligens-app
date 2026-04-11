/**
 * Retail Vision Phase 6D — Chainabuse enricher.
 *
 * Pour chaque KolWallet actif, interroge chainabuse.com et, si >=3 reports,
 * crée/maj une KolEvidence de type VICTIM_REPORT.
 *
 * ⚠️ RÈGLE ÉDITORIALE ABSOLUE ⚠️
 * Chainabuse est un signal INTERNE UNIQUEMENT. Ne jamais exposer cette
 * evidence en UI retail sans corroboration on-chain indépendante. Toutes
 * les rows écrites par ce script portent `displaySafety=INTERNAL_ONLY`
 * dans `rawJson` et `type="victim_report_internal"`.
 *
 * Schéma cible : KolEvidence (cf. prisma/schema.prod.prisma).
 *   Pas de colonne `evidenceType`, `source`, `confidence`, `displaySafety`
 *   dans le schema actuel — on les encode dans `rawJson` pour rester
 *   strictement additif et éviter une migration SQL.
 *
 * Mapping :
 *   type          = "victim_report_internal"
 *   label         = "Chainabuse — {N} reports publics"
 *   description   = catégories + date first/last
 *   sourceUrl     = "https://www.chainabuse.com/address/{addr}"
 *   wallets       = JSON.stringify([address])
 *   dedupKey      = "chainabuse:{address}"
 *   rawJson       = {
 *                     source: "chainabuse",
 *                     confidence: "MEDIUM",
 *                     displaySafety: "INTERNAL_ONLY",
 *                     fetchedAt, reportCount, categories, firstSeen, lastSeen
 *                   }
 *
 * Dry-run par défaut. Pour écrire :
 *   SEED_CHAINABUSE=1 pnpm tsx src/scripts/seed/chainabuseEnrich.ts
 */
import { prisma } from "@/lib/prisma";
import { fetchChainabuseReports, isActionable } from "@/lib/chains/chainabuse";

interface Summary {
  walletsScanned: number;
  walletsWithReports: number;
  walletsActionable: number;
  evidenceUpserted: number;
  errors: number;
}

async function main() {
  const dryRun = process.env.SEED_CHAINABUSE !== "1";
  console.log(`[chainabuse] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const wallets = await prisma.kolWallet.findMany({
    where: { status: "active" },
    select: { id: true, address: true, chain: true, kolHandle: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`[chainabuse] ${wallets.length} active KolWallet to scan`);

  const summary: Summary = {
    walletsScanned: 0,
    walletsWithReports: 0,
    walletsActionable: 0,
    evidenceUpserted: 0,
    errors: 0,
  };

  for (const w of wallets) {
    summary.walletsScanned += 1;
    try {
      const result = await fetchChainabuseReports(w.address);
      if (result.error) {
        console.log(`[chainabuse]   ${w.kolHandle} ${w.address.slice(0, 10)}… err=${result.error}`);
        continue;
      }
      if (result.reportCount > 0) summary.walletsWithReports += 1;

      const actionable = isActionable(result);
      if (!actionable) {
        console.log(
          `[chainabuse]   ${w.kolHandle} ${w.address.slice(0, 10)}… reports=${result.reportCount} (below threshold)`
        );
        continue;
      }

      summary.walletsActionable += 1;
      console.log(
        `[chainabuse] 🚨 ${w.kolHandle} ${w.address.slice(0, 10)}… reports=${result.reportCount} categories=${result.categories.join(",")}`
      );

      if (dryRun) continue;

      const dedupKey = `chainabuse:${w.address.toLowerCase()}`;
      const label = `Chainabuse — ${result.reportCount} reports publics [INTERNE]`;
      const description = [
        result.categories.length ? `Catégories: ${result.categories.join(", ")}` : null,
        result.firstSeen ? `First: ${result.firstSeen.slice(0, 10)}` : null,
        result.lastSeen ? `Last: ${result.lastSeen.slice(0, 10)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const rawJson = JSON.stringify({
        source: "chainabuse",
        confidence: "MEDIUM",
        displaySafety: "INTERNAL_ONLY",
        editorialWarning:
          "Do not surface in retail UI without independent on-chain corroboration.",
        fetchedAt: result.fetchedAt,
        reportCount: result.reportCount,
        categories: result.categories,
        firstSeen: result.firstSeen,
        lastSeen: result.lastSeen,
        reports: result.reports.slice(0, 20),
      });

      const existing = await prisma.kolEvidence.findFirst({
        where: { kolHandle: w.kolHandle, dedupKey },
        select: { id: true },
      });

      if (existing) {
        await prisma.kolEvidence.update({
          where: { id: existing.id },
          data: {
            type: "victim_report_internal",
            label,
            description,
            wallets: JSON.stringify([w.address]),
            sourceUrl: `https://www.chainabuse.com/address/${w.address}`,
            dateFirst: result.firstSeen ? new Date(result.firstSeen) : null,
            dateLast: result.lastSeen ? new Date(result.lastSeen) : null,
            rawJson,
          },
        });
      } else {
        await prisma.kolEvidence.create({
          data: {
            kolHandle: w.kolHandle,
            type: "victim_report_internal",
            label,
            description,
            wallets: JSON.stringify([w.address]),
            sourceUrl: `https://www.chainabuse.com/address/${w.address}`,
            dateFirst: result.firstSeen ? new Date(result.firstSeen) : null,
            dateLast: result.lastSeen ? new Date(result.lastSeen) : null,
            dedupKey,
            rawJson,
          },
        });
      }
      summary.evidenceUpserted += 1;
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[chainabuse] soft-fail ${w.kolHandle} ${w.address}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("[chainabuse] summary", summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[chainabuse] fatal", e);
  process.exit(1);
});
