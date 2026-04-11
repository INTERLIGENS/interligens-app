/**
 * Retail Vision Phase 6F-3 — MetaSleuth enricher.
 *
 * Pour tous les KolWallet ETH/BSC/TRON actifs, appelle MetaSleuth par
 * batch de 50. Si un label de risque (SCAMMER/PHISHING/MIXER/...) est
 * retourné, upsert KolEvidence en INTERNAL_ONLY.
 *
 * ⚠️ INTERNE UNIQUEMENT. Jamais affiché en retail sans corroboration.
 *
 * Dry-run par défaut. SEED_METASLEUTH=1 pour écrire.
 * Abort propre si METASLEUTH_API_KEY n'est pas défini.
 */
import { prisma } from "@/lib/prisma";
import {
  fetchBatchLabels,
  hasApiKey,
  isRisky,
  type MetasleuthChain,
} from "@/lib/chains/metasleuth";

interface Summary {
  walletsScanned: number;
  labelsFound: number;
  risky: number;
  evidenceUpserts: number;
  errors: number;
}

const SUPPORTED: MetasleuthChain[] = ["ETH", "BSC", "TRON"];

async function main() {
  const dryRun = process.env.SEED_METASLEUTH !== "1";
  console.log(`[metasleuth] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  if (!hasApiKey()) {
    console.error("[metasleuth] METASLEUTH_API_KEY not set — abort");
    console.error(
      "[metasleuth] Le module est câblé et prêt ; pose la clé dans Vercel UI puis relance."
    );
    process.exit(0);
  }

  const summary: Summary = {
    walletsScanned: 0,
    labelsFound: 0,
    risky: 0,
    evidenceUpserts: 0,
    errors: 0,
  };

  for (const chain of SUPPORTED) {
    const wallets = await prisma.kolWallet.findMany({
      where: { status: "active", chain },
      select: { id: true, address: true, kolHandle: true },
    });
    console.log(`[metasleuth] ${chain}: ${wallets.length} active wallets`);
    if (wallets.length === 0) continue;
    summary.walletsScanned += wallets.length;

    // Build chain-keyed map from lowercase addr → (kolHandle, address)
    const byAddr = new Map<string, { kolHandle: string; address: string }>();
    for (const w of wallets) {
      byAddr.set(w.address.toLowerCase(), { kolHandle: w.kolHandle, address: w.address });
    }

    try {
      const result = await fetchBatchLabels(chain, Array.from(byAddr.keys()));
      if (!result.ok) {
        console.warn(`[metasleuth] ${chain} batch failed: ${result.error ?? "unknown"}`);
        continue;
      }
      summary.labelsFound += result.labels.length;

      for (const label of result.labels) {
        const match = byAddr.get(label.address.toLowerCase());
        if (!match) continue;

        console.log(
          `[metasleuth]   ${chain} ${match.kolHandle} ${label.address.slice(0, 10)}… entity=${label.mainEntity ?? "-"} attrs=[${label.attributes.join(",")}]`
        );

        if (!isRisky(label)) continue;
        summary.risky += 1;
        console.log(
          `[metasleuth] 🚨 risky ${match.kolHandle} ${label.address} riskAttrs=[${label.riskAttributes.join(",")}]`
        );

        if (dryRun) continue;

        const dedupKey = `metasleuth:${chain}:${label.address.toLowerCase()}`;
        const rawJson = JSON.stringify({
          source: "metasleuth_blocksec",
          evidenceType: "metasleuth_label",
          confidence: "MEDIUM",
          displaySafety: "INTERNAL_ONLY",
          editorialWarning:
            "MetaSleuth = signal interne uniquement. Ne jamais exposer en retail sans corroboration on-chain indépendante.",
          chain,
          mainEntity: label.mainEntity,
          nameTag: label.nameTag,
          attributes: label.attributes,
          riskAttributes: label.riskAttributes,
          raw: label.raw,
        });

        const existing = await prisma.kolEvidence.findFirst({
          where: { kolHandle: match.kolHandle, dedupKey },
          select: { id: true },
        });
        const labelStr = `MetaSleuth — ${label.mainEntity ?? label.nameTag ?? label.riskAttributes.join("/")} [INTERNE]`;
        const description = `Tags: ${label.riskAttributes.join(", ")}`;

        if (existing) {
          await prisma.kolEvidence.update({
            where: { id: existing.id },
            data: {
              type: "metasleuth_label_internal",
              label: labelStr,
              description,
              wallets: JSON.stringify([label.address]),
              rawJson,
            },
          });
        } else {
          await prisma.kolEvidence.create({
            data: {
              kolHandle: match.kolHandle,
              type: "metasleuth_label_internal",
              label: labelStr,
              description,
              wallets: JSON.stringify([label.address]),
              dedupKey,
              rawJson,
            },
          });
        }
        summary.evidenceUpserts += 1;
      }
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[metasleuth] soft-fail chain=${chain}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log("[metasleuth] summary", summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[metasleuth] fatal", e);
  process.exit(1);
});
