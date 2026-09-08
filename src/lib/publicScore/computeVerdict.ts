import { isValidEvmAddress } from "./schema";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { prisma } from "@/lib/prisma";
import type { SwapVerdict } from "@/lib/safe-swap/types";
import { degraded, type MeasuredVerdict } from "@/lib/risk/degradation";

function toVerdict(score: number): SwapVerdict {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

// ─── BUILD 10 · P0 — « la base a échoué » ≠ « aucune lignée » ──────────────
//
// Le `catch` rendait "NONE", c'est-à-dire la valeur FAVORABLE : une base
// injoignable et un jeton sans lignée de scam produisaient la même sortie, et
// le verdict ne portait aucune trace de la différence.
//
// La valeur passée au scoreur reste "NONE" — changer ce qui entre dans le
// calcul serait modifier le scoring, ce que P0 s'interdit explicitement. Ce
// qui change, c'est qu'on SAIT désormais que c'est un défaut de mesure, et que
// le verdict le porte.
type ScamLineage = "CONFIRMED" | "REFERENCED" | "NONE";

async function getScamLineage(
  mint: string,
): Promise<{ lineage: ScamLineage; measured: boolean }> {
  try {
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: mint },
      include: { nodes: { select: { flagged: true } } },
    });
    if (!graphCase) return { lineage: "NONE", measured: true };
    const flaggedNodes = graphCase.nodes.filter((n) => n.flagged);
    return {
      lineage: flaggedNodes.length > 0 ? "CONFIRMED" : "NONE",
      measured: true,
    };
  } catch {
    // `measured: false` est toute la correction. La valeur ne bouge pas.
    return { lineage: "NONE", measured: false };
  }
}

/**
 * BUILD 10 · P0 — le verdict, ET ce sur quoi il n'a PAS pu s'appuyer.
 *
 * `computeVerdict` conserve sa signature : aucun appelant n'est cassé, et le
 * calcul est identique au caractère près. Ce qui est ajouté est un canal
 * PARALLÈLE — les champs dont la mesure a échoué — pour que la surface puisse
 * dire à son lecteur qu'un verdict a été rendu sur données partielles.
 */
export async function computeVerdictMeasured(
  mint: string,
): Promise<MeasuredVerdict<SwapVerdict>> {
  const isEvm = isValidEvmAddress(mint);

  if (isEvm) {
    const normalized = mint.toLowerCase();
    const knownBad = isKnownBadEvm(normalized);
    const intel = await computeTigerScoreWithIntel(
      { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false },
      normalized,
    );
    // Chemin EVM : aucune des deux entrées dégradables n'est consultée ici.
    return { verdict: toVerdict(intel.finalScore), degraded: [] };
  }

  const [caseFile, market, scamLineageResult] = await Promise.all([
    Promise.resolve(loadCaseByMint(mint)),
    getMarketSnapshot("solana", mint),
    getScamLineage(mint),
  ]);

  const tigerScan = computeTigerScoreFromScan({
    chain: "SOL",
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: mint,
    market_url: market.url,
    pair_age_days: market.pair_age_days,
    liquidity_usd: market.liquidity_usd,
    fdv_usd: market.fdv_usd,
    volume_24h_usd: market.volume_24h_usd,
    scam_lineage: scamLineageResult.lineage,
    signals: {
      confirmedCriticalClaims:
        (caseFile?.claims ?? []).filter(
          (cl) =>
            cl.severity === "CRITICAL" &&
            (cl.status === "CONFIRMED" || cl.status === "DISPUTED"),
        ).length,
      knownBadAddresses: 0,
    },
  });

  const intel = await computeTigerScoreWithIntel(
    { chain: "SOL", scan_type: "token", no_casefile: !caseFile, mint_address: mint },
    mint,
  );

  // Les entrées non mesurées sont NOMMÉES — un champ, jamais une valeur.
  const manquants = [
    ...(scamLineageResult.measured ? [] : [degraded("scam_lineage", "PROVIDER_UNAVAILABLE")]),
    ...(market.data_unavailable ? [degraded("market", "PROVIDER_UNAVAILABLE")] : []),
  ];
  return {
    verdict: toVerdict(Math.max(tigerScan.score, intel.finalScore)),
    degraded: manquants,
  };
}

/**
 * Le verdict seul. Signature d'origine, comportement d'origine.
 *
 * Conservée telle quelle : les appelants existants ne changent pas, et la
 * dégradation reste disponible pour qui la demande. Un appelant qui rend ce
 * verdict à un utilisateur devrait préférer `computeVerdictMeasured` — c'est
 * ce que P1/P2 auront à instruire, surface par surface.
 */
export async function computeVerdict(mint: string): Promise<SwapVerdict> {
  return (await computeVerdictMeasured(mint)).verdict;
}
