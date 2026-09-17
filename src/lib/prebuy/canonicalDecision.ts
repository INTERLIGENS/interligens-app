// ─── BUILD 12 · S2 — LA DÉCISION CANONIQUE, ET ELLE EST UNIQUE ─────────────
//
// ██  REFLEX est l'autorité. Le reste projette.                            ██
//
// ─── Ce qu'il y avait : QUATRE tables de seuils ───────────────────────────
//
// La même règle métier était réécrite à quatre endroits :
//
//   · publicScore/computeVerdict.ts        toVerdict        70 / 35
//   · api/v1/score/route.ts                en ligne, ×2     70 / 35
//   · partner/v1/transaction-check         toVerdict        70 / 35
//                                          toRecommendation 70 / 40   ← 40
//   · partner/v1/score-lite, batch-score   toVerdict/toTier 70 / 35
//
// Le `40` n'est pas une coquille : c'est la conséquence mécanique d'avoir
// quatre copies. Dans la bande 35–39, une SEULE réponse de transaction-check
// portait `verdict_to: "WARNING"` ET `recommendation: "ALLOW"` — le verdict et
// l'action divergeaient à l'intérieur d'un même objet. T2 l'a épinglé.
//
// Ce fichier est désormais le seul endroit où un état devient une décision.
// Les quatre surfaces PROJETTENT depuis lui. La divergence n'est pas corrigée :
// elle devient inexprimable.
//
// ─── Sur les nombres ──────────────────────────────────────────────────────
//
// AUCUN seuil nouveau. Les bornes 70 et 35 sont celles déjà en production,
// déplacées, pas choisies — et le 40 disparaît parce qu'il était la duplication
// elle-même. BUILD 12 n'ajoute aucune méthodologie ni aucun scoring.

import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type { ReflexVerdict } from "@/lib/reflex/types";
import type { IdentityResolution } from "./identity";

/**
 * Les bornes LEGACY, à un seul endroit. Elles ne sont pas rejouées ailleurs.
 * `SEUIL_ACTION` n'existe plus : c'était le 40 de `toRecommendation`.
 */
export const SEUIL_CRITIQUE = 70;
export const SEUIL_ELEVE = 35;

/** Un manque, sur l'axe MESURE. Jamais un état de publication. */
export interface ManqueMesure {
  engine: string;
  reason: MeasurementState;
  detail?: string;
}

export interface FaitsDeMesure {
  /** Ce que le contrat demandait POUR CETTE requête. */
  expected: number;
  /** Ceux des attendus qui ont abouti. */
  expectedMeasured: number;
  /** Les manquants, avec leur cause exacte — hors contrat compris. */
  missing: readonly ManqueMesure[];
}

export interface EntreeDecision {
  /**
   * Le verdict REFLEX quand REFLEX a tourné. C'est l'AUTORITÉ : quand il est
   * présent, aucune borne n'est consultée.
   */
  reflexVerdict?: ReflexVerdict;
  /**
   * Le score legacy, quand REFLEX n'a pas tourné sur cette surface.
   * `null` = non mesuré. Jamais `0` : zéro est un score mesuré à zéro.
   */
  score: number | null;
  measurement: FaitsDeMesure;
  identity: IdentityResolution;
}

export interface DecisionCanonique {
  verdict: ReflexVerdict;
  /** D'où vient le verdict. Un lecteur doit pouvoir le savoir. */
  verdictSource: "REFLEX" | "LEGACY_SCORE" | "NO_MEASUREMENT";
  /** Le contrat de mesure attendue est-il satisfait (cf. BUILD 11.1). */
  expectedContractSatisfied: boolean;
  /** `true` UNIQUEMENT quand une capacité ATTENDUE manque. */
  degraded: boolean;
  coverage: FaitsDeMesure;
  identityResolved: boolean;
}

/**
 * Les états de mesure qui sont HORS CONTRAT : leur absence est normale et ne
 * dégrade rien. Repris tel quel de BUILD 11.1 — pas redéfini ici.
 */
const HORS_CONTRAT: readonly MeasurementState[] = [
  "NOT_APPLICABLE",
  "NOT_REQUESTED_BY_CONTRACT",
];

/**
 * Le contrat de mesure attendue est satisfait quand tous les attendus ont
 * abouti — et qu'il y en avait. `expected === 0` n'est pas une couverture
 * parfaite : c'est l'absence de contrat, donc rien à quoi adosser une
 * conclusion.
 */
export function contratSatisfait(m: FaitsDeMesure): boolean {
  return m.expected > 0 && m.expectedMeasured >= m.expected;
}

/**
 * `degraded` ne s'allume QUE sur un manque ATTENDU. Un moteur non applicable
 * ou non demandé par le contrat ne fabrique pas de dégradation — c'est la
 * sur-correction que BUILD 11.1 a fermée, et elle ne se rouvre pas ici.
 */
export function estDegrade(m: FaitsDeMesure): boolean {
  if (m.expectedMeasured < m.expected) return true;
  return m.missing.some((x) => !HORS_CONTRAT.includes(x.reason));
}

/**
 * L'unique passage d'un état mesuré à un verdict.
 *
 * Ordre d'autorité :
 *   1. REFLEX, quand il a tourné ;
 *   2. le score legacy, quand il y en a un — bornes DÉPLACÉES, pas choisies ;
 *   3. une GRAVITÉ ÉTABLIE de niveau BLOCK, qu'aucune couverture manquante ne
 *      relâche (CC-OFFLINE-282) ;
 *   4. rien de mesuré → INSUFFICIENT_COVERAGE. L'absence de mesure n'est pas
 *      une mesure d'absence.
 *
 * LA COUVERTURE EST UN PORTAIL DE PERMISSION, PAS UN RÉDUCTEUR DE GRAVITÉ.
 */
export function canonicalPreBuyDecision(e: EntreeDecision): DecisionCanonique {
  const coverage = e.measurement;
  const base = {
    expectedContractSatisfied: contratSatisfait(coverage),
    degraded: estDegrade(coverage),
    coverage,
    identityResolved: e.identity.resolved,
  };

  if (e.reflexVerdict !== undefined) {
    return { ...base, verdict: e.reflexVerdict, verdictSource: "REFLEX" };
  }

  if (e.score === null) {
    return { ...base, verdict: "INSUFFICIENT_COVERAGE", verdictSource: "NO_MEASUREMENT" };
  }

  // ── CC-OFFLINE-282 — LA GRAVITÉ PRÉCÈDE LE REFUS DE COUVERTURE ──────────
  //
  // ██  LA COUVERTURE PEUT RESTREINDRE UNE PERMISSION.                    ██
  // ██  LA COUVERTURE NE DOIT JAMAIS RÉDUIRE UNE GRAVITÉ ÉTABLIE.         ██
  //
  // Le portail `expectedMeasured === 0` était testé AVANT les bornes de score.
  // Mesuré : un score de 95 y perdait son `STOP` au profit de
  // `INSUFFICIENT_COVERAGE`, et la projection rendait `WARN` là où elle rendait
  // `BLOCK` — une gravité établie DILUÉE par une ignorance.
  //
  // Ce n'est pas une méthodologie de risque nouvelle : c'est la composition de
  // DEUX contrats déjà ratifiés, qui se contredisaient dans cet ordre-ci.
  //
  //   1 · « un STOP reste un BLOCK » — écrit dans `projectPreBuy`, pour le cas
  //       jumeau de l'identité non résolue. On ne relâche pas une gravité
  //       mesurée parce qu'il manque autre chose.
  //   2 · « une couverture requise insuffisante ne peut pas produire ALLOW ».
  //
  // La composition ferme les DEUX directions de défaillance : l'ignorance ne
  // peut pas autoriser, ET l'ignorance ne peut pas diluer.
  //
  // ⛔ SEUL cet ordre change. Aucune autre préséance n'est déplacée : REFLEX
  //    reste l'autorité première, `score === null` reste une absence de mesure,
  //    et les bornes elles-mêmes sont intactes.
  const graviteEtablie = e.score >= SEUIL_CRITIQUE;

  // Rien n'a été mesuré du tout : un score existe, mais aucune capacité
  // attendue n'a abouti. Le score ne repose alors sur rien de gouverné — SAUF
  // s'il établit une gravité de niveau BLOCK, qu'aucune ignorance ne dilue.
  if (!graviteEtablie && coverage.expected > 0 && coverage.expectedMeasured === 0) {
    return { ...base, verdict: "INSUFFICIENT_COVERAGE", verdictSource: "NO_MEASUREMENT" };
  }

  const verdict: ReflexVerdict =
    graviteEtablie
      ? "STOP"
      : e.score >= SEUIL_ELEVE
        ? // La bande élevée demande une VÉRIFICATION, pas une attente : le
          // libellé legacy est « proceed with caution ». WAIT reste réservé à
          // ce que REFLEX seul sait établir (convergence, coordination), et
          // les deux ne se confondent pas — la projection préserve lequel.
          "VERIFY"
        : "NO_CRITICAL_SIGNAL";

  return { ...base, verdict, verdictSource: "LEGACY_SCORE" };
}
