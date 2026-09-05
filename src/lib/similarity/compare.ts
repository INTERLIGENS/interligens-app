// --- BUILD 7 / S2 — LE COMPARATEUR ----------------------------------------
//
// PUR, DÉTERMINISTE. Aucun réseau, aucune base, aucun aléa, aucun horodatage :
// deux appels sur les mêmes entrées rendent le même objet, toujours.
//
// ██ CE QUE LE COMPARATEUR REND, ET CE QU'IL NE REND JAMAIS ██
//
//   IL REND     un verdict par caractéristique, dans un vocabulaire FERMÉ de
//               quatre valeurs, chacun accompagné de sa base : ce qui a été
//               comparé, les valeurs des deux côtés, les preuves, les natures,
//               la couverture, et pourquoi cet état précisément.
//
//   IL NE REND  aucun nombre agrégé, aucun classement, aucun seuil, aucune
//               lecture de coordination, d'opérateur commun ou de faute. Ces
//               lectures sont des INTERPRÉTATIONS ; elles se produisent
//               ailleurs, sur une base traçable, et jamais automatiquement.
//
// ─── L'ORDRE D'ÉVALUATION EST UNE RÈGLE, PAS UN DÉTAIL ───────────────────
//
//   1. observabilité   un côté non observé arrête tout — INV-2
//   2. méthode         deux méthodes différentes ne se comparent pas — INV-9
//   3. sorte ORDINAL   une grandeur n'est pas jugée sans seuil ratifié — INV-8
//   4. valeurs         égalité / recouvrement
//   5. censure         un négatif candidat est RETIRÉ, jamais affirmé — INV-4
//
// À chaque embranchement, c'est la lecture la plus FAIBLE qui l'emporte. Un
// ordre qui pencherait dans l'autre sens produirait des ressemblances et des
// différences par construction — et c'est exactement ce dont un lecteur ne
// pourrait plus se défendre, puisque tout serait bien formé.

import { leastAuthoritative, type DataNature } from "@/lib/data-nature/nature";
import { specFor, SIMILARITY_FEATURE_KEYS } from "./registry";
import { assertComparisonInvariants, assertNoAggregateScore } from "./invariants";
import {
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_CONTRACT_VERSION,
  type ComparisonReasonCode,
  type ComparisonResult,
  type ComparisonSide,
  type ComparisonVerdict,
  type FeatureObservation,
  type FeatureValue,
  type SetOverlap,
  type SubjectComparison,
  type SubjectFeatureSet,
} from "./types";

/**
 * Les réserves portées par CHAQUE comparaison, sans exception.
 *
 * Elles ne sont pas décoratives : c'est par elles qu'un résultat extrait de
 * son contexte — copié dans un rapport, lu six mois plus tard — continue de
 * dire ce qu'il ne prouve pas.
 */
export const SIMILARITY_RESERVATIONS: readonly string[] = [
  "SIMILARITY IS NOT A VERDICT — no guilt, scam, coordination, shared-operator or fraud finding is produced by this comparison.",
  "NO AGGREGATE SCORE — feature results are never reduced to a number, a ranking or a risk level.",
  "ABSENCE OF EVIDENCE IS NEVER A DIFFERENCE — an unobserved, unmeasurable, censored or missing side yields NOT_COMPARABLE.",
  "SHARED IDENTIFIERS ARE CO-OCCURRENCES — the same address or handle appearing in two cases is a fact about the data, not about an actor.",
  // ── La réserve « METHODOLOGY ARTIFACT NOT FROZEN » a été RETIRÉE ici le
  //    2026-09-05, et son retrait n'est pas un choix : le tripwire de
  //    __tests__/contract.test.ts affirmait que le ref NE résolvait PAS ; il a
  //    rougi au gel de content/methodologies/similarity/v1.md, et exige
  //    désormais l'inverse — que le ref résolve, et que le sha concorde.
  //    Garder une réserve devenue fausse l'aurait transformée en bruit, et un
  //    bruit ne protège personne.
  "METHOD IS FROZEN AND CITABLE — similarity/compare@v1 resolves against a frozen methodology artifact; a result produced under another version does not compare with this one.",
];

const EXPERIMENTAL_RESERVATION =
  "EXPERIMENTAL INPUT — at least one side comes from an experimental engine (PRE-SHILL front-run: 600 s window, 8 occasions over 3 KOL). It does not become a canonical fact by being compared.";

const FLOOR_RESERVATION =
  "COVERAGE CENSORED — at least one side rests on a bounded collection. Every result here is a FLOOR, never a demonstrated identity nor a demonstrated difference.";

const NOMINATIVE_RESERVATION =
  "NOMINATIVE CO-OCCURRENCE — the compared identifiers name accounts. Never retail-visible, never a claim about a person.";

const MISSING_REASON =
  "la caractéristique n'a jamais été extraite pour ce sujet — ce n'est ni une absence observée, ni une limite de collecte";

function sideFrom(subjectRef: string, obs: FeatureObservation | null): ComparisonSide {
  if (!obs) {
    return {
      subjectRef,
      state: "MISSING",
      value: null,
      stateReason: MISSING_REASON,
      nature: null,
      method: null,
      coverage: null,
      evidence: [],
      experimental: false,
      nominative: false,
    };
  }
  return {
    subjectRef,
    state: obs.state,
    value: obs.value,
    stateReason: obs.stateReason,
    nature: obs.nature,
    method: obs.method,
    coverage: obs.coverage,
    evidence: obs.evidence,
    experimental: obs.experimental,
    nominative: obs.nominative,
  };
}

function methodSignature(side: ComparisonSide): string {
  const m = side.method;
  if (!m) return "";
  const params = Object.keys(m.parameters)
    .sort()
    .map((k) => `${k}=${String(m.parameters[k])}`)
    .join(";");
  return `${m.methodRef ?? "-"}|${m.ruleVersion}|${params}`;
}

function render(value: FeatureValue | null): string {
  if (!value) return "—";
  if (value.kind === "CATEGORICAL") return value.value;
  if (value.kind === "SET") return value.values.join(", ");
  return `${value.value} ${value.unit}`;
}

function overlapOf(a: readonly string[], b: readonly string[]): SetOverlap {
  const sa = new Set(a);
  const sb = new Set(b);
  return {
    shared: a.filter((v) => sb.has(v)),
    onlyLeft: a.filter((v) => !sb.has(v)),
    onlyRight: b.filter((v) => !sa.has(v)),
  };
}

/**
 * COMPARE UNE CARACTÉRISTIQUE entre deux sujets.
 *
 * `null` d'un côté signifie MISSING : la caractéristique n'a jamais été
 * extraite pour ce sujet. Ce n'est PAS la même chose que « le moteur a regardé
 * et n'a rien vu » (NOT_OBSERVED), ni que « la grandeur ne se mesure pas »
 * (NOT_MEASURABLE), ni que « la collecte a été coupée » (CENSORED).
 */
export function compareFeature(
  featureKey: string,
  left: { subjectRef: string; observation: FeatureObservation | null },
  right: { subjectRef: string; observation: FeatureObservation | null },
  where = "compareFeature",
): ComparisonResult {
  const spec = specFor(featureKey, where);
  for (const [side, label] of [
    [left.observation, "left"],
    [right.observation, "right"],
  ] as const) {
    if (side && side.featureKey !== spec.key) {
      throw new Error(
        `[similarity] ${where} : l'observation ${label} porte « ${side.featureKey} » ` +
          `alors qu'on compare « ${spec.key} ». Comparer deux caractéristiques ` +
          `différentes rendrait un verdict parfaitement bien formé et entièrement faux.`,
      );
    }
  }

  const l = sideFrom(left.subjectRef, left.observation);
  const r = sideFrom(right.subjectRef, right.observation);

  const censored =
    (l.coverage !== null && !l.coverage.complete) || (r.coverage !== null && !r.coverage.complete);
  const experimental = l.experimental || r.experimental;
  const nominative = l.nominative || r.nominative;

  let verdict: ComparisonVerdict;
  let reasonCode: ComparisonReasonCode;
  let reason: string;
  let overlap: SetOverlap | null = null;

  // ── 1. OBSERVABILITÉ — INV-2 ────────────────────────────────────────────
  if (l.state !== "OBSERVED" || r.state !== "OBSERVED") {
    verdict = "NOT_COMPARABLE";
    reasonCode = "SIDE_NOT_OBSERVABLE";
    reason =
      `côté « ${l.subjectRef} » : ${l.state}` +
      (l.stateReason ? ` (${l.stateReason})` : "") +
      ` ; côté « ${r.subjectRef} » : ${r.state}` +
      (r.stateReason ? ` (${r.stateReason})` : "") +
      `. Une absence n'établit rien : ni ressemblance, ni différence.`;
  }
  // ── 2. MÉTHODE — INV-9 ──────────────────────────────────────────────────
  else if (methodSignature(l) !== methodSignature(r)) {
    verdict = "NOT_COMPARABLE";
    reasonCode = "METHOD_MISMATCH";
    reason =
      `méthodes divergentes — « ${methodSignature(l)} » contre « ${methodSignature(r)} ». ` +
      `Rien dans les valeurs ne l'aurait signalé : les deux sont bien formées.`;
  }
  // ── 3. GRANDEURS — INV-8 ────────────────────────────────────────────────
  else if (spec.kind === "ORDINAL") {
    verdict = "NOT_COMPARABLE";
    reasonCode = "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD";
    reason =
      `grandeurs transportées, non jugées — ${render(l.value)} contre ${render(r.value)}. ` +
      `Dire « proche » ou « éloigné » demanderait une coupure qu'aucune règle ratifiée ` +
      `ne pose ; le comparateur s'abstient et rend les deux valeurs au lecteur.`;
  }
  // ── 4. VALEURS ──────────────────────────────────────────────────────────
  else if (spec.kind === "CATEGORICAL") {
    const lv = (l.value as { kind: "CATEGORICAL"; value: string }).value;
    const rv = (r.value as { kind: "CATEGORICAL"; value: string }).value;
    if (lv === rv) {
      verdict = "MATCH";
      reasonCode = "EQUAL_VALUE";
      reason = `même valeur des deux côtés : « ${lv} ».`;
    } else {
      verdict = "DIFFERENT";
      reasonCode = "VALUE_DIFFERS";
      reason = `valeurs distinctes : « ${lv} » contre « ${rv} ».`;
    }
  } else {
    const lv = (l.value as { kind: "SET"; values: readonly string[] }).values;
    const rv = (r.value as { kind: "SET"; values: readonly string[] }).values;
    overlap = overlapOf(lv, rv);
    if (overlap.onlyLeft.length === 0 && overlap.onlyRight.length === 0) {
      verdict = "MATCH";
      reasonCode = "IDENTICAL_SET";
      reason = `mêmes ${overlap.shared.length} identifiant(s) démontré(s) des deux côtés.`;
    } else if (overlap.shared.length > 0) {
      verdict = "PARTIAL_MATCH";
      reasonCode = "SET_OVERLAP_PARTIAL";
      reason =
        `${overlap.shared.length} identifiant(s) présent(s) des deux côtés ; ` +
        `${overlap.onlyLeft.length} propre(s) à « ${l.subjectRef} », ` +
        `${overlap.onlyRight.length} propre(s) à « ${r.subjectRef} ».`;
    } else {
      verdict = "DIFFERENT";
      reasonCode = "SET_DISJOINT";
      reason =
        `aucun identifiant commun — ${overlap.onlyLeft.length} à gauche, ` +
        `${overlap.onlyRight.length} à droite.`;
    }
  }

  // ── 5. LA CENSURE RETIRE LE NÉGATIF — INV-4 ─────────────────────────────
  //
  // Elle ne touche PAS aux positifs. Un identifiant partagé reste partagé,
  // quelle que soit la borne de collecte : ce qui est démontré des deux côtés
  // l'est encore. C'est l'asymétrie du raisonnement, et elle est réelle —
  // seul le NÉGATIF dépend de ce qu'on n'a pas vu.
  if (verdict === "DIFFERENT" && censored) {
    const before = reasonCode;
    verdict = "NOT_COMPARABLE";
    reasonCode = "COVERAGE_CENSORED_NEGATIVE_WITHHELD";
    reason =
      `un écart était constaté (${before}), mais la couverture est bornée ` +
      `(« ${l.subjectRef} » : ${l.coverage?.censoredBy ?? "complète"} ; ` +
      `« ${r.subjectRef} » : ${r.coverage?.censoredBy ?? "complète"}). ` +
      `Ce qui manque d'un côté peut vivre entièrement hors de l'échantillon : ` +
      `l'écart n'est donc pas affirmé.`;
  }

  const resultNature: DataNature | null =
    l.nature === null || r.nature === null ? null : leastAuthoritative(l.nature, r.nature);

  const result: ComparisonResult = {
    verdict,
    resultNature,
    basis: {
      featureKey: spec.key,
      family: spec.family,
      kind: spec.kind,
      comparedOn: `« ${spec.key} » — ${spec.kind}, famille ${spec.family}`,
      meaning: spec.meaning,
      left: l,
      right: r,
      overlap,
      resultIsFloor: censored,
      reasonCode,
      reason,
      experimental,
      nominative,
      ruleVersion: SIMILARITY_COMPARE_RULE_VERSION,
    },
    reservations: [
      ...SIMILARITY_RESERVATIONS,
      ...(experimental ? [EXPERIMENTAL_RESERVATION] : []),
      ...(censored ? [FLOOR_RESERVATION] : []),
      ...(nominative ? [NOMINATIVE_RESERVATION] : []),
    ],
  };

  // Le calcul vient d'avoir lieu ; le CONTRÔLE est une seconde écriture,
  // indépendante, de la même règle. Voir l'en-tête de ./invariants.
  assertComparisonInvariants(
    result,
    {
      leftSubjectRef: left.subjectRef,
      rightSubjectRef: right.subjectRef,
      left: left.observation,
      right: right.observation,
    },
    where,
  );

  return result;
}

/**
 * COMPARE DEUX SUJETS sur TOUT le registre.
 *
 * ██ UNE ENTRÉE PAR FEATURE DÉCLARÉE, MÊME ABSENTE DES DEUX CÔTÉS. ██
 * Ne rendre que les features présentes donnerait une sortie dont la longueur
 * varie avec l'ignorance : deux sujets mal couverts sembleraient avoir « peu
 * de différences ». Ici, ce qui n'a pas été comparé se lit, et se compte.
 */
export function compareSubjects(
  left: SubjectFeatureSet,
  right: SubjectFeatureSet,
  where = "compareSubjects",
): SubjectComparison {
  const index = (s: SubjectFeatureSet) => {
    const m = new Map<string, FeatureObservation>();
    for (const o of s.observations) {
      if (m.has(o.featureKey)) {
        throw new Error(
          `[similarity] ${where} : « ${s.subjectRef} » porte deux observations pour ` +
            `« ${o.featureKey} ». Laquelle serait comparée ? Choisir en silence ` +
            `rendrait le résultat dépendant de l'ordre d'insertion.`,
        );
      }
      m.set(o.featureKey, o);
    }
    return m;
  };
  const li = index(left);
  const ri = index(right);

  const results = SIMILARITY_FEATURE_KEYS.map((key) =>
    compareFeature(
      key,
      { subjectRef: left.subjectRef, observation: li.get(key) ?? null },
      { subjectRef: right.subjectRef, observation: ri.get(key) ?? null },
      where,
    ),
  );

  const out: SubjectComparison = {
    contractVersion: SIMILARITY_CONTRACT_VERSION,
    ruleVersion: SIMILARITY_COMPARE_RULE_VERSION,
    leftSubjectRef: left.subjectRef,
    rightSubjectRef: right.subjectRef,
    results,
  };
  // Dernière ligne de défense : rien de ce qui sort d'ici ne porte d'agrégat.
  assertNoAggregateScore(out, where);
  return out;
}
