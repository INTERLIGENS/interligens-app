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
// TACHE C, LIVREE. L'enveloppe est persistee sur ShillCorrelationCandidate
// (colonnes rowNature / natureBasis / naturePolicyVersion) par l'upsert
// d'aggregate.ts, via buildCandidateNatureWrite -> assertNatureWritable.
// Ce module produit la valeur ; persistence.ts la valide ; aggregate.ts l'ecrit.
// Aucun des trois ne peut ecrire une nature sans traverser les deux autres.

import { buildInferenceEnvelope as buildCommonEnvelope } from "@/lib/data-nature/inferenceEnvelope";
import { SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";
import {
  ACTIVITY_LIFT_RESERVATIONS,
  BASELINE_MEASURED_STATES,
  type InferenceEnvelope,
  type OccasionRecord,
} from "./types";
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
): InferenceEnvelope {
  if (!policy.outputIsInferenceOnly) throw new InferenceOnlyViolation("configuree hors INFERENCE");

  const observationCount = records.reduce((s, r) => s + r.observations.length, 0);
  const baselineBuyCount = records.reduce(
    (s, r) => s + (BASELINE_MEASURED_STATES.includes(r.baselineState) ? r.baselineBuys.length : 0),
    0,
  );
  const resolvedSome = records.some((r) => r.resolved != null);

  // B4.2 - LA RESOLUTION EST DECRITE, PAS APLATIE EN JETON DE NATURE.
  // Le code d'avant ajoutait "INFERENCE" au basis des que le resolveur avait
  // tranche pour un token. C'etait vrai qu'une etape amont etait un calcul, et
  // faux de l'ecrire ainsi : le basis disait « fondee sur une inference »,
  // sans dire laquelle.
  const env = buildCommonEnvelope(
    {
      primaryObservations: [
        {
          kind: "shill_occasion",
          refs: { occasionIds: records.map((r) => r.occasion.occasionId) },
          count: records.length,
        },
        {
          kind: "onchain_buy",
          refs: { observed: observationCount, baseline: baselineBuyCount },
          count: observationCount + baselineBuyCount,
        },
      ],
      methodology: {
        methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
        outcome: { engine: "shill-v2", occasions: records.length },
      },
      ...(resolvedSome
        ? {
            resolution: {
              status: "resolved_by_canonical_resolver",
              evidence: "au moins une occasion porte un token resolu (resolveur V3)",
            },
          }
        : {}),
      reservations: ACTIVITY_LIFT_RESERVATIONS,
      policyVersion: ENGINE_POLICY_VERSION,
    },
    "shill-v2/buildInferenceEnvelope",
  );

  return {
    nature: "INFERENCE",
    basis: env.basis,
    basisRefs: {
      occasionIds: records.map((r) => r.occasion.occasionId),
      observationCount,
      baselineBuyCount,
    },
    policyVersion: ENGINE_POLICY_VERSION,
  };
}

/**
 * L'ENVELOPPE DU CHEMIN v1 (`aggregate.ts`).
 *
 * v1 n'a pas d'`OccasionRecord` : il agrege des `ShillBuyerObservation` et ne
 * collecte AUCUNE fenetre temoin - c'est precisement ce que la tache D doit
 * construire. `buildInferenceEnvelope` lui est donc inapplicable, et lui
 * fabriquer de faux `OccasionRecord` pour le contourner reviendrait a inventer
 * les donnees que l'enveloppe est censee decrire.
 *
 * Ce constructeur prend donc les MEMES faits, comptes par l'appelant :
 *
 *   `baselineBuyCount` vaut 0 sur ce chemin, et ce zero est une MESURE, pas un
 *   defaut de remplissage : v1 n'a pas de collecteur temoin, donc aucune de ses
 *   inferences n'a de denominateur. Une enveloppe qui tairait ce zero laisserait
 *   croire a une inference adossee a un temoin. Le lift de ces candidats est
 *   NON MESURE, et l'enveloppe doit le dire.
 *
 *   `tokenResolutionWasInferred` : la resolution ticker -> mint est un CALCUL
 *   (resolve.ts) des lors qu'elle a fallu passer par CA_MAP ou par le texte du
 *   tweet. `resolved_direct` n'est pas une inference - le mint etait deja la.
 *   Reprendre ce fait ici evite de sur-declarer un basis.
 *
 * Meme version de politique, meme garde `outputIsInferenceOnly`, meme nature :
 * il n'existe pas deux facons de produire une INFERENCE dans ce produit.
 */
export function buildAggregateInferenceEnvelope(
  input: {
    occasionIds: readonly string[];
    observationCount: number;
    baselineBuyCount: number;
    tokenResolutionWasInferred: boolean;
  },
  policy: Pick<EnginePolicy, "outputIsInferenceOnly">,
): InferenceEnvelope {
  if (!policy.outputIsInferenceOnly) throw new InferenceOnlyViolation("configuree hors INFERENCE");

  // Meme primitive que le chemin v2 : une seule forme d'enveloppe.
  const env = buildCommonEnvelope(
    {
      primaryObservations: [
        {
          kind: "shill_occasion",
          refs: { occasionIds: [...input.occasionIds] },
          count: input.occasionIds.length,
        },
        {
          kind: "onchain_buy",
          refs: { observed: input.observationCount, baseline: input.baselineBuyCount },
          count: input.observationCount + input.baselineBuyCount,
        },
      ],
      methodology: {
        methodRef: SOCIAL_PROMOTION_QUALIFY_V1,
        outcome: { engine: "shill-v1-aggregate" },
      },
      ...(input.tokenResolutionWasInferred
        ? {
            resolution: {
              status: "resolved_by_canonical_resolver",
              evidence: "ticker resolu par CA_MAP ou par le texte du tweet (resolve.ts)",
            },
          }
        : {}),
      reservations: ACTIVITY_LIFT_RESERVATIONS,
      policyVersion: ENGINE_POLICY_VERSION,
    },
    "shill-v1/buildAggregateInferenceEnvelope",
  );

  return {
    nature: "INFERENCE",
    basis: env.basis,
    basisRefs: {
      occasionIds: [...input.occasionIds],
      observationCount: input.observationCount,
      baselineBuyCount: input.baselineBuyCount,
    },
    policyVersion: ENGINE_POLICY_VERSION,
  };
}

/** Garde-fou appelable par un consommateur avant toute persistance. */
export function assertInferenceOnly(env: { nature: string }): void {
  if (env.nature !== "INFERENCE") throw new InferenceOnlyViolation(env.nature);
}
