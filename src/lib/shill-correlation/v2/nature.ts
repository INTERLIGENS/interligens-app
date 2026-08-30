// --- Nature de la sortie : INFERENCE, toujours ----------------------------
//
// DOCTRINE (docs/prep/BUILD2_DATA_NATURE_SPEC_2026-08-27.md, Q3) :
// la nature d'une sortie est celle de la DERNIERE OPERATION, pas de ses
// entrees. Ce moteur calcule ; il n'observe pas. Sa sortie est donc une
// INFERENCE, et `natureBasis` retient de quoi elle est tiree - sans quoi une
// inference sur observation directe serait indiscernable d'une inference sur
// flux tiers.
//
// La nature ne remonte jamais l'echelle (I1) : aucun chemin de ce module ne
// peut produire PRIMARY_OBSERVATION.
//
// NOTE - TACHE C, NON LIVREE ICI. La persistance de cette enveloppe sur
// ShillCorrelationCandidate (colonnes nature / natureBasis / naturePolicyVersion,
// ecriture via assertNatureWritable) attend le DDL. Ce module produit la
// valeur ; il ne l'ecrit nulle part.

import type { DataNature } from "@/lib/data-nature/nature";
import { BASELINE_MEASURED_STATES, type InferenceEnvelope, type OccasionRecord } from "./types";
import type { EnginePolicy } from "./policy";

/**
 * Version de politique sous laquelle une inference a ete produite.
 *
 * Elle change des qu'un seuil a effet produit change : deux candidats scores
 * sous deux versions ne sont pas comparables, et sans ce champ rien ne le
 * dirait. Le suffixe `non-ratifie` reste tant que policy.AWAITING_RATIFICATION
 * n'est pas vide.
 */
export const ENGINE_POLICY_VERSION = "shill-v2-non-ratifie-2026-08-30";

export class InferenceOnlyViolation extends Error {
  constructor(attempted: string) {
    super(
      `[shill-v2] sortie de nature ${attempted} refusee : ce moteur ne produit ` +
        "que des INFERENCE. Il calcule, il n'observe pas (Q3, invariant I1).",
    );
    this.name = "InferenceOnlyViolation";
  }
}

/**
 * Construit l'enveloppe. Les natures d'entree sont celles des sources reelles :
 *   - les achats on-chain (observation ET temoin) sont des PRIMARY_OBSERVATION,
 *     le produit les a lus lui-meme ;
 *   - la resolution du token est elle-meme une INFERENCE (resolveur V3).
 *
 * Le temoin entre au meme titre que l'observation : il est lu on-chain par le
 * meme collecteur. Le distinguer dans `natureBasis` n'aurait pas de sens - ce
 * sont les MEMES achats, lus dans une autre fenetre. Ce que `basisRefs`
 * distingue, en revanche, ce sont les VOLUMES : une inference tiree de 400
 * observations et 0 achat temoin n'a pas la meme assise qu'une tiree de 400 et
 * 400, et l'enveloppe doit permettre de le voir sans relire le moteur.
 */
export function buildInferenceEnvelope(
  records: readonly OccasionRecord[],
  policy: EnginePolicy,
  extraBasis: readonly DataNature[] = [],
): InferenceEnvelope {
  if (!policy.outputIsInferenceOnly) throw new InferenceOnlyViolation("configuree hors INFERENCE");

  const basis = new Set<DataNature>(["PRIMARY_OBSERVATION", ...extraBasis]);
  // Le token a ete identifie par le resolveur canonique : c'est un calcul.
  if (records.some((r) => r.resolved != null)) basis.add("INFERENCE");

  return {
    nature: "INFERENCE",
    natureBasis: [...basis].sort(),
    basisRefs: {
      occasionIds: records.map((r) => r.occasion.occasionId),
      observationCount: records.reduce((s, r) => s + r.observations.length, 0),
      baselineBuyCount: records.reduce(
        (s, r) => s + (BASELINE_MEASURED_STATES.includes(r.baselineState) ? r.baselineBuys.length : 0),
        0,
      ),
    },
    policyVersion: ENGINE_POLICY_VERSION,
  };
}

/** Garde-fou appelable par un consommateur avant toute persistance. */
export function assertInferenceOnly(env: { nature: string }): void {
  if (env.nature !== "INFERENCE") throw new InferenceOnlyViolation(env.nature);
}
