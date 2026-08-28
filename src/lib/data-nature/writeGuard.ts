// ─── S6-2 / S6-4 — le CHOKEPOINT d'écriture d'une nature ───────────────────
//
// ██  GARDE-FOU CRITIQUE, à lire avant d'ajouter quoi que ce soit ici.     ██
//
// Ce module garde les ÉCRITURES, jamais les lectures. Le produit porte une
// dette historique assumée — 41 EvidenceItem UNCLASSIFIED, 453 KolWallet et
// 4 KolCase sans nature — et cette dette doit rester LISIBLE, donc lisible.
// Poser requireNature sur un chemin de lecture transformerait S6 en panne
// générale et ferait disparaître la dette au lieu de la montrer.
//
// La règle, exactement : après S6, aucune NOUVELLE affirmation Data Nature ne
// peut être créée ou publiée sans nature. L'historique non classé continue
// d'être lu tel quel, et n'est JAMAIS promu implicitement.
//
// Trois refus, et rien d'autre :
//   1. écrire une nature absente ou invalide          → requireNatureValue
//   2. écrire ESTIMATE sans méthode ni basis auditable → assertEstimateAuditable
//   3. écrire une nature GLOBALE sur un artefact mixte → MixedArtifactNatureError
//   4. faire remonter une nature dans l'échelle        → assertTransition (I1)

import {
  requireNatureValue,
  assertTransition,
  UNCLASSIFIED,
  type NatureValue,
} from "./nature";
import { isValidMethodRef } from "./methodRef";
import {
  isMixedAssertionArtifact,
  MIXED_ASSERTION_REASON,
  MIXED_ASSERTION_DETAIL,
} from "./mixedArtifacts";

export class MixedArtifactNatureError extends Error {
  constructor(where: string, ref: string) {
    super(
      `[data-nature] écriture de nature refusée (${where}) : ${ref} appartient au ` +
        `corpus ${MIXED_ASSERTION_REASON} / ${MIXED_ASSERTION_DETAIL}. ` +
        "Un artefact qui porte des affirmations de natures hétérogènes ne peut pas " +
        "recevoir une nature globale : la lui donner mentirait sur les autres. " +
        "Un rapport généré n'est jamais preuve primaire de ses propres conclusions.",
    );
    this.name = "MixedArtifactNatureError";
  }
}

export class UnauditableEstimateError extends Error {
  constructor(where: string) {
    super(
      `[data-nature] écriture d'ESTIMATE refusée (${where}) : ni methodRef valide ` +
        "ni natureBasis. Une estimation dont on ne peut relire ni la méthode ni les " +
        "entrées est infalsifiable (Q5).",
    );
    this.name = "UnauditableEstimateError";
  }
}

/**
 * Une ESTIMATE est auditable par SA MÉTHODE ou par SON BASIS.
 *
 * La disjonction n'est pas un assouplissement : W2 a produit une ESTIMATE
 * légitime — la valeur notionnelle de sortie — qu'AUCUNE méthodologie gelée ne
 * couvre, et dont l'auditabilité repose entièrement sur son natureBasis
 * (quantité tierce, prix de référence, fenêtre, formule). Exiger un methodRef
 * l'aurait poussée à en inventer un : exactement ce que W2 interdit.
 */
export function assertEstimateAuditable(
  nature: NatureValue,
  carrier: { methodRef?: unknown; natureBasis?: unknown },
  where: string,
): void {
  if (nature !== "ESTIMATE") return;
  const hasMethod = isValidMethodRef(carrier.methodRef);
  const hasBasis =
    carrier.natureBasis != null &&
    typeof carrier.natureBasis === "object" &&
    Object.keys(carrier.natureBasis as object).length > 0;
  if (!hasMethod && !hasBasis) throw new UnauditableEstimateError(where);
}

export interface NatureWriteTarget {
  /** Identité de la ligne visée — sert à reconnaître le corpus mixte. */
  readonly id?: string | null;
  readonly sha256?: string | null;
  /** Référence lisible, pour le message d'erreur. */
  readonly ref?: string | null;
  /** Nature actuellement portée, si la ligne en a une. */
  readonly currentNature?: NatureValue | null;
}

export interface NatureWriteInput {
  readonly nature: unknown;
  readonly methodRef?: unknown;
  readonly natureBasis?: unknown;
  /** Écrit-on une nature de LIGNE (globale) ou d'un champ précis ? */
  readonly scope?: "row" | "field";
}

/**
 * LE chokepoint. Toute écriture de nature passe par ici, ou n'est pas une
 * écriture sanctionnée.
 *
 * Ne lève JAMAIS pour une lecture : la fonction n'est appelée que sur un
 * chemin d'écriture, et une ligne legacy qu'on relit ne la traverse pas.
 */
export function assertNatureWritable(
  target: NatureWriteTarget,
  input: NatureWriteInput,
  where: string,
): NatureValue {
  // 1. Une nature absente ou invalide n'est pas une écriture.
  const next = requireNatureValue(input.nature, where);

  // 2. Le corpus mixte refuse toute nature GLOBALE — y compris UNCLASSIFIED,
  //    qu'il porte déjà : on ne le "réécrit" pas non plus.
  if ((input.scope ?? "row") === "row" && isMixedAssertionArtifact(target)) {
    throw new MixedArtifactNatureError(where, target.ref ?? target.id ?? target.sha256 ?? "?");
  }

  // 3. Une ESTIMATE doit rester auditable.
  assertEstimateAuditable(next, { methodRef: input.methodRef, natureBasis: input.natureBasis }, where);

  // 4. I1 — la nature ne remonte jamais l'échelle d'autorité. Une INFERENCE ne
  //    devient pas PRIMARY_OBSERVATION par héritage.
  if (target.currentNature != null && target.currentNature !== UNCLASSIFIED) {
    assertTransition(target.currentNature, next, where);
  }

  return next;
}
