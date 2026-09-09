// ─── BUILD 12 · S2 — computeVerdict N'EST PLUS UNE AUTORITÉ ────────────────
//
// ██  Elle mesure. Elle ne décide plus.                                    ██
//
// Ce fichier portait sa propre table de seuils :
//
//   function toVerdict(score) { if (score >= 70) return "RED";
//                               if (score >= 35) return "ORANGE";
//                               return "GREEN"; }
//
// Trois autres copies de la même règle vivaient dans api/v1/score et dans les
// routes partenaires — dont une qui basculait à 40 au lieu de 35, ce qui
// faisait diverger le verdict et l'action à l'intérieur d'un seul objet.
//
// La table a été DÉPLACÉE dans `src/lib/prebuy/canonicalDecision.ts`, à un
// seul endroit. Ici il ne reste que la MESURE : quelles capacités ont été
// demandées, lesquelles ont abouti, et ce qui atteste l'identité de la cible.
// Le verdict rendu est désormais une PROJECTION de la décision canonique.
//
// Aucun seuil nouveau : 70 et 35 sont ceux d'avant, déplacés, pas choisis.

import { isValidEvmAddress, isValidMint } from "./schema";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { prisma } from "@/lib/prisma";
import type { SwapVerdict } from "@/lib/safe-swap/types";
import { degraded, type MeasuredVerdict } from "@/lib/risk/degradation";
import {
  canonicalPreBuyDecision,
  type DecisionCanonique,
  type FaitsDeMesure,
  type ManqueMesure,
} from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity, type IdentityAttestation } from "@/lib/prebuy/identity";
import {
  probeCanonicalTokenIdentity,
  PREBUY_EVM_CHAINS,
} from "@/lib/prebuy/canonicalTokenIdentity";
import { projectPreBuy, toSwapTier, type PreBuyProjection } from "@/lib/prebuy/projection";

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
 * Le résultat complet d'une mesure pré-achat : la décision canonique, sa
 * projection, et les nombres bruts pour les surfaces qui les publient.
 */
export interface PreBuyMeasurement {
  decision: DecisionCanonique;
  projection: PreBuyProjection;
  /** Le score legacy, publié tel quel par les contrats qui l'exposent. */
  score: number;
  signalsCount: number;
}

/**
 * Le contrat de mesure ATTENDUE, par famille de cible.
 *
 * SOL : marché, tigerscore et lignée de scam sont demandés — les trois.
 * EVM : seul tigerscore est demandé ; le marché et la lignée ne sont pas
 *       consultés sur ce chemin, donc ils sont NOT_REQUESTED_BY_CONTRACT et
 *       ne dégradent rien. C'est la distinction de BUILD 11.1, réutilisée et
 *       non redéfinie.
 */
const HORS_CONTRAT_EVM: ManqueMesure[] = [
  { engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" },
  { engine: "scam_lineage", reason: "NOT_REQUESTED_BY_CONTRACT" },
];

/** L'unique chemin de mesure pré-achat. Tout le reste en dérive. */
export async function measurePreBuy(target: string): Promise<PreBuyMeasurement> {
  const isEvm = isValidEvmAddress(target);
  const syntacticallyValid = isEvm || isValidMint(target);

  if (isEvm) {
    const normalized = target.toLowerCase();
    const knownBad = isKnownBadEvm(normalized);
    const intel = await computeTigerScoreWithIntel(
      { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false },
      normalized,
    );

    const measurement: FaitsDeMesure = {
      expected: 1,
      expectedMeasured: 1,
      missing: HORS_CONTRAT_EVM,
    };
    // AL — l'identité canonique, sondée. Avant, les deux seules attestations
    // EVM étaient `knownBad` et `intelligence_match` : la seule façon d'être
    // attesté était d'être connu comme MAUVAIS, donc un actif propre ne
    // pouvait structurellement pas résoudre.
    const canonique = await probeCanonicalTokenIdentity({
      address: normalized,
      chainHint: "ETH",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    const attestations: IdentityAttestation[] = [
      { source: "knownBad", attests: knownBad !== null },
      { source: "intelligence_match", attests: intel.intelligence != null },
      { source: "canonical_token_resolution", attests: canonique.attested },
    ];
    const decision = canonicalPreBuyDecision({
      score: intel.finalScore,
      measurement,
      identity: resolveTokenIdentity({ syntacticallyValid, attestations }),
    });
    return {
      decision,
      projection: projectPreBuy(decision),
      score: intel.finalScore,
      signalsCount: intel.drivers.length,
    };
  }

  const [caseFile, market, scamLineageResult] = await Promise.all([
    Promise.resolve(loadCaseByMint(target)),
    getMarketSnapshot("solana", target),
    getScamLineage(target),
  ]);

  const tigerScan = computeTigerScoreFromScan({
    chain: "SOL",
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: target,
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
    { chain: "SOL", scan_type: "token", no_casefile: !caseFile, mint_address: target },
    target,
  );

  // Les capacités attendues qui ont échoué sont NOMMÉES — un champ, jamais
  // une valeur substituée.
  const manquants: ManqueMesure[] = [
    ...(scamLineageResult.measured
      ? []
      : [{ engine: "scam_lineage", reason: "FAILURE" as const }]),
    ...(market.data_unavailable
      ? [{ engine: "market", reason: "FAILURE" as const }]
      : []),
  ];
  const measurement: FaitsDeMesure = {
    expected: 3,
    expectedMeasured: 3 - manquants.length,
    missing: manquants,
  };

  const attestations: IdentityAttestation[] = [
    { source: "casefile", attests: caseFile != null },
    { source: "market_pair", attests: !market.data_unavailable && Boolean(market.url) },
    { source: "intelligence_match", attests: intel.intelligence != null },
  ];

  const score = Math.max(tigerScan.score, intel.finalScore);
  const decision = canonicalPreBuyDecision({
    score,
    measurement,
    identity: resolveTokenIdentity({ syntacticallyValid, attestations }),
  });

  return {
    decision,
    projection: projectPreBuy(decision),
    score,
    signalsCount:
      tigerScan.drivers.length +
      intel.drivers.filter((d) => d.id === "intelligence_overlay").length,
  };
}

/**
 * ADAPTATEUR — le verdict swap, et ce sur quoi il n'a PAS pu s'appuyer.
 *
 * La signature ne change pas. Ce qui change est que le verdict n'est plus
 * calculé ici : il est projeté depuis la décision canonique.
 */
export async function computeVerdictMeasured(
  mint: string,
): Promise<MeasuredVerdict<SwapVerdict>> {
  const m = await measurePreBuy(mint);
  return {
    verdict: toSwapTier(m.projection),
    degraded: m.decision.coverage.missing
      .filter((x) => x.reason === "FAILURE")
      .map((x) => degraded(x.engine, "PROVIDER_UNAVAILABLE")),
  };
}

/**
 * ADAPTATEUR de compatibilité. Signature d'origine, conservée pour les
 * appelants qui n'ont pas besoin du canal de mesure.
 *
 * Un appelant qui rend ce verdict à un utilisateur doit préférer
 * `measurePreBuy` : il y trouve la décision ET son état de mesure.
 */
export async function computeVerdict(mint: string): Promise<SwapVerdict> {
  return (await computeVerdictMeasured(mint)).verdict;
}
