/**
 * Retail Vision Phase 6F-1 — RugCheck enricher.
 *
 * Pour chaque tokenMint distinct dans KolTokenInvolvement :
 *   1. fetchRugCheck(mint)
 *   2. upsert TokenLaunchMetric :
 *      - source = "rugcheck"
 *      - concentrationScore (si dispo) sinon inchangé
 *      - raw.rugcheck = données brutes normalisées
 *   3. Si isSerialRugger → upsert KolEvidence VICTIM / SERIAL_RUGGER
 *      (mais on n'a pas de KOL directement lié au creator — on attache
 *      l'evidence aux KolProfile qui avaient une involvement sur ce
 *      mint, en INTERNAL_ONLY).
 *
 * Dry-run par défaut. SEED_RUGCHECK=1 pour écrire.
 *
 * NB: SERIAL_RUGGER = créateur avec >= 2 tokens rugpullés dans son
 * historique. Signal interne uniquement (le KOL peut être victime, pas
 * complice) — c'est au human review de décider.
 */
import { prisma } from "@/lib/prisma";
import { fetchRugCheck, hasInsiders, type RugCheckResult } from "@/lib/token/rugcheck";

interface Summary {
  tokensScanned: number;
  tokensWithReport: number;
  tokensWithInsiders: number;
  serialRuggers: number;
  tokenLaunchMetricUpserts: number;
  evidenceUpserts: number;
  errors: number;
}

function toLaunchMetricPayload(r: RugCheckResult) {
  return {
    source: "rugcheck",
    concentrationScore: r.score ?? undefined,
    raw: {
      rugcheck: {
        fetchedAt: r.fetchedAt,
        source: r.source,
        score: r.score,
        rawScore: r.rawScore,
        creator: r.creator,
        risks: r.risks,
        insiders: r.insiders,
        creatorHistory: r.creatorHistory,
        isSerialRugger: r.isSerialRugger,
      },
    } as never,
  };
}

async function main() {
  const dryRun = process.env.SEED_RUGCHECK !== "1";
  console.log(`[rugcheck] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const rows = await prisma.$queryRawUnsafe<Array<{ chain: string; tokenMint: string }>>(
    `SELECT DISTINCT chain, "tokenMint"
       FROM "KolTokenInvolvement"
      WHERE "tokenMint" IS NOT NULL AND "tokenMint" <> ''
      ORDER BY chain, "tokenMint"`
  );

  // RugCheck est Solana-only.
  const solMints = rows.filter((r) => r.chain.toUpperCase() === "SOL");
  console.log(
    `[rugcheck] ${rows.length} total mint(s), ${solMints.length} on SOL (RugCheck supported)`
  );

  const summary: Summary = {
    tokensScanned: 0,
    tokensWithReport: 0,
    tokensWithInsiders: 0,
    serialRuggers: 0,
    tokenLaunchMetricUpserts: 0,
    evidenceUpserts: 0,
    errors: 0,
  };

  for (const { tokenMint } of solMints) {
    summary.tokensScanned += 1;
    try {
      const result = await fetchRugCheck(tokenMint);
      if (result.error) {
        console.log(`[rugcheck]   ${tokenMint.slice(0, 10)}… err=${result.error}`);
        continue;
      }
      summary.tokensWithReport += 1;

      const insiders = hasInsiders(result);
      if (insiders) summary.tokensWithInsiders += 1;
      if (result.isSerialRugger) summary.serialRuggers += 1;

      console.log(
        `[rugcheck]   ${tokenMint.slice(0, 10)}… score=${result.score} insiders=${result.insiders.length} serialRugger=${result.isSerialRugger} creator=${(result.creator ?? "").slice(0, 10)}`
      );

      if (dryRun) continue;

      const payload = toLaunchMetricPayload(result);
      const existing = await prisma.tokenLaunchMetric.findUnique({
        where: { chain_tokenMint: { chain: "SOL", tokenMint } },
        select: { id: true, raw: true, concentrationScore: true },
      });

      const mergedRaw = {
        ...(existing?.raw && typeof existing.raw === "object" && !Array.isArray(existing.raw)
          ? (existing.raw as Record<string, unknown>)
          : {}),
        ...(payload.raw as Record<string, unknown>),
      };

      if (existing) {
        await prisma.tokenLaunchMetric.update({
          where: { id: existing.id },
          data: {
            source: "rugcheck",
            concentrationScore:
              payload.concentrationScore ?? existing.concentrationScore ?? undefined,
            raw: mergedRaw as never,
            computedAt: new Date(),
          },
        });
      } else {
        await prisma.tokenLaunchMetric.create({
          data: {
            chain: "SOL",
            tokenMint,
            source: "rugcheck",
            concentrationScore: payload.concentrationScore ?? undefined,
            raw: mergedRaw as never,
          },
        });
      }
      summary.tokenLaunchMetricUpserts += 1;

      if (result.isSerialRugger) {
        const involvements = await prisma.kolTokenInvolvement.findMany({
          where: { chain: "SOL", tokenMint },
          select: { kolHandle: true },
        });
        const handles = Array.from(new Set(involvements.map((i) => i.kolHandle)));
        for (const kolHandle of handles) {
          const dedupKey = `rugcheck:serial_rugger:${tokenMint}:${kolHandle}`;
          const rawJson = JSON.stringify({
            source: "rugcheck",
            evidenceType: "serial_rugger",
            confidence: "MEDIUM",
            displaySafety: "INTERNAL_ONLY",
            editorialWarning:
              "Signal interne uniquement — le créateur du token promu a un historique de rugs. Le KOL peut être victime ou complice ; human review requise avant exposition retail.",
            creator: result.creator,
            history: result.creatorHistory,
          });
          const existingEv = await prisma.kolEvidence.findFirst({
            where: { kolHandle, dedupKey },
            select: { id: true },
          });
          if (existingEv) {
            await prisma.kolEvidence.update({
              where: { id: existingEv.id },
              data: {
                type: "serial_rugger_internal",
                label: `RugCheck — créateur avec historique de rugs [INTERNE]`,
                description: `${result.creatorHistory.length} tokens déployés par ${result.creator?.slice(0, 10)}…`,
                token: tokenMint,
                sourceUrl: `https://rugcheck.xyz/tokens/${tokenMint}`,
                rawJson,
              },
            });
          } else {
            await prisma.kolEvidence.create({
              data: {
                kolHandle,
                type: "serial_rugger_internal",
                label: `RugCheck — créateur avec historique de rugs [INTERNE]`,
                description: `${result.creatorHistory.length} tokens déployés par ${result.creator?.slice(0, 10)}…`,
                token: tokenMint,
                sourceUrl: `https://rugcheck.xyz/tokens/${tokenMint}`,
                dedupKey,
                rawJson,
              },
            });
          }
          summary.evidenceUpserts += 1;
        }
      }
    } catch (err) {
      summary.errors += 1;
      console.warn(
        `[rugcheck] soft-fail ${tokenMint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("[rugcheck] summary", summary);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[rugcheck] fatal", e);
  process.exit(1);
});
