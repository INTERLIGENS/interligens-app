// --- BUILD 7 / @v2 — LE COMPARATEUR ---------------------------------------
//
// PUR, DÉTERMINISTE. Les MÊMES quatre verdicts que @v1, la même interdiction de
// score et de seuil, les mêmes neuf invariants — plus quatre.
//
// ─── L'ORDRE D'ÉVALUATION, ET CE QUE @v2 Y INSÈRE ────────────────────────
//
//   1. ADMISSIBILITÉ   un côté INADMISSIBLE arrête tout, sous son PROPRE motif
//                      — INV-10, nouveau
//   2. observabilité   un côté non observé arrête tout — INV-2
//   3. méthode         deux méthodes différentes ne se comparent pas — INV-9
//   4. RÉSOLUTION      une comparaison plus fine que la source est refusée
//                      — INV-12, nouveau
//   5. sorte ORDINAL   une grandeur n'est pas jugée sans seuil ratifié — INV-8
//   6. valeurs         égalité / recouvrement
//   7. censure         un négatif candidat est RETIRÉ, jamais affirmé — INV-4
//
// L'admissibilité passe AVANT l'observabilité, et ce n'est pas un détail : une
// donnée refusée pour sa nature n'est pas une donnée absente, et l'ordre
// inverse la ferait disparaître sous le motif générique.

import { leastAuthoritative, type DataNature } from "@/lib/data-nature/nature";
import { assertNoAggregateScore } from "../invariants";
import { specForV2, SIMILARITY_FEATURE_KEYS_V2 } from "./registry";
import {
  SCOPE_RESERVATION,
  UNATTRIBUTED_RESERVATION,
  assertComparisonInvariantsV2,
} from "./invariants";
import {
  SIMILARITY_COMPARE_V2_RULE_VERSION,
  SIMILARITY_CONTRACT_V2_VERSION,
  type ComparisonReasonCodeV2,
  type ComparisonResultV2,
  type ComparisonSideV2,
  type ComparisonVerdictV2,
  type FeatureObservationV2,
  type FeatureValue,
  type SetOverlap,
  type SubjectComparisonV2,
  type SubjectFeatureSetV2,
} from "./types";

export const SIMILARITY_RESERVATIONS_V2: readonly string[] = [
  "SIMILARITY IS NOT A VERDICT — no guilt, scam, coordination, shared-operator or fraud finding is produced by this comparison.",
  "NO AGGREGATE SCORE — feature results are never reduced to a number, a ranking or a risk level.",
  "ABSENCE OF EVIDENCE IS NEVER A DIFFERENCE — an unobserved, unmeasurable, censored, inadmissible or missing side yields NOT_COMPARABLE.",
  "SHARED IDENTIFIERS ARE CO-OCCURRENCES — the same address or handle appearing in two cases is a fact about the data, not about an actor.",
  "METHOD IS FROZEN AND CITABLE — similarity/compare@v2 resolves against a frozen methodology artifact; a result produced under another version, @v1 included, does not compare with this one.",
];

const EXPERIMENTAL_RESERVATION =
  "EXPERIMENTAL INPUT — at least one side comes from an experimental engine (PRE-SHILL front-run: 600 s window, 8 occasions over 3 KOL). It does not become a canonical fact by being compared.";

const FLOOR_RESERVATION =
  "COVERAGE CENSORED — at least one side rests on a bounded collection. Every result here is a FLOOR, never a demonstrated identity nor a demonstrated difference.";

const NOMINATIVE_RESERVATION =
  "NOMINATIVE CO-OCCURRENCE — the compared identifiers name accounts. Never retail-visible, never a claim about a person.";

const MISSING_REASON =
  "la caractéristique n'a jamais été extraite pour ce sujet — ce n'est ni une absence observée, ni une limite de collecte, ni un refus d'admissibilité";

function sideFrom(subjectRef: string, obs: FeatureObservationV2 | null): ComparisonSideV2 {
  if (!obs) {
    return {
      subjectRef, state: "MISSING", value: null, stateReason: MISSING_REASON,
      nature: null, method: null, coverage: null, evidence: [],
      experimental: false, nominative: false,
      inadmissibility: null, aggregation: null, attribution: null, temporal: null,
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
    inadmissibility: obs.inadmissibility,
    aggregation: obs.aggregation,
    attribution: obs.attribution,
    temporal: obs.temporal,
  };
}

function methodSignature(side: ComparisonSideV2): string {
  const m = side.method;
  if (!m) return "";
  const p = Object.keys(m.parameters).sort().map((k) => `${k}=${String(m.parameters[k])}`).join(";");
  return `${m.methodRef ?? "-"}|${m.ruleVersion}|${p}`;
}

function render(value: FeatureValue | null): string {
  if (!value) return "—";
  if (value.kind === "CATEGORICAL") return value.value;
  if (value.kind === "SET") return value.values.join(", ");
  return `${value.value} ${value.unit}`;
}

/** La portée, dite en clair pour entrer dans le motif. */
function scopePhrase(side: ComparisonSideV2): string {
  const a = side.aggregation;
  if (!a || a.scope === "NOT_AGGREGATED") return "";
  if (a.scope === "SOME_GROUPS") {
    return ` (démontré par ${a.groupsWithValue} groupe(s) sur ${a.groupsConsidered})`;
  }
  if (a.scope === "ALL_GROUPS") return ` (démontré par les ${a.groupsConsidered} groupe(s))`;
  return "";
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

export function compareFeatureV2(
  featureKey: string,
  left: { subjectRef: string; observation: FeatureObservationV2 | null },
  right: { subjectRef: string; observation: FeatureObservationV2 | null },
  where = "compareFeatureV2",
): ComparisonResultV2 {
  const spec = specForV2(featureKey, where);
  for (const [o, label] of [
    [left.observation, "left"],
    [right.observation, "right"],
  ] as const) {
    if (o && o.featureKey !== spec.key) {
      throw new Error(
        `[similarity/v2] ${where} : l'observation ${label} porte « ${o.featureKey} » ` +
          `alors qu'on compare « ${spec.key} ».`,
      );
    }
  }

  const l = sideFrom(left.subjectRef, left.observation);
  const r = sideFrom(right.subjectRef, right.observation);

  const censored =
    (l.coverage !== null && !l.coverage.complete) || (r.coverage !== null && !r.coverage.complete);
  const experimental = l.experimental || r.experimental;
  const nominative = l.nominative || r.nominative;

  let verdict: ComparisonVerdictV2;
  let reasonCode: ComparisonReasonCodeV2;
  let reason: string;
  let overlap: SetOverlap | null = null;

  const stateOf = (s: ComparisonSideV2) =>
    `côté « ${s.subjectRef} » : ${s.state}` + (s.stateReason ? ` (${s.stateReason})` : "");

  // ── 1. ADMISSIBILITÉ — INV-10, et elle passe en premier ────────────────
  if (l.state === "INADMISSIBLE" || r.state === "INADMISSIBLE") {
    verdict = "NOT_COMPARABLE";
    reasonCode = "SIDE_INADMISSIBLE";
    const detail = (s: ComparisonSideV2) =>
      s.inadmissibility
        ? ` [${s.inadmissibility.cause} — trouvé : ${s.inadmissibility.found} ; exigé : ${s.inadmissibility.required}]`
        : "";
    reason =
      `${stateOf(l)}${detail(l)} ; ${stateOf(r)}${detail(r)}. ` +
      `La donnée existe et ne peut pas soutenir cette caractéristique : collecter ` +
      `davantage de la même chose n'y changerait rien.`;
  }
  // ── 2. OBSERVABILITÉ — INV-2 ───────────────────────────────────────────
  else if (l.state !== "OBSERVED" || r.state !== "OBSERVED") {
    verdict = "NOT_COMPARABLE";
    reasonCode = "SIDE_NOT_OBSERVABLE";
    reason = `${stateOf(l)} ; ${stateOf(r)}. Une absence n'établit rien : ni ressemblance, ni différence.`;
  }
  // ── 3. MÉTHODE — INV-9 ─────────────────────────────────────────────────
  else if (methodSignature(l) !== methodSignature(r)) {
    verdict = "NOT_COMPARABLE";
    reasonCode = "METHOD_MISMATCH";
    reason =
      `méthodes divergentes — « ${methodSignature(l)} » contre « ${methodSignature(r)} ». ` +
      `Rien dans les valeurs ne l'aurait signalé.`;
  }
  // ── 4. RÉSOLUTION TEMPORELLE — INV-12 ──────────────────────────────────
  else if (
    spec.requiresTemporalResolution === "INSTANT" &&
    (l.temporal?.resolution === "DAY" || r.temporal?.resolution === "DAY")
  ) {
    verdict = "NOT_COMPARABLE";
    reasonCode = "TEMPORAL_RESOLUTION_INSUFFICIENT";
    reason =
      `cette comparaison exige une résolution à l'INSTANT ; au moins un côté n'est ` +
      `daté qu'au JOUR (« ${l.temporal?.value ?? "—"} » contre « ${r.temporal?.value ?? "—"} »). ` +
      `Aucune heure n'est fabriquée pour combler l'écart.`;
  }
  // ── 5. GRANDEURS — INV-8 ───────────────────────────────────────────────
  else if (spec.kind === "ORDINAL") {
    verdict = "NOT_COMPARABLE";
    reasonCode = "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD";
    reason =
      `grandeurs transportées, non jugées — ${render(l.value)} contre ${render(r.value)}. ` +
      `Dire « proche » ou « éloigné » demanderait une coupure qu'aucune règle ratifiée ne pose.`;
  }
  // ── 6. VALEURS ─────────────────────────────────────────────────────────
  else if (spec.kind === "CATEGORICAL") {
    const lv = (l.value as { kind: "CATEGORICAL"; value: string }).value;
    const rv = (r.value as { kind: "CATEGORICAL"; value: string }).value;
    if (lv === rv) {
      verdict = "MATCH";
      reasonCode = "EQUAL_VALUE";
      reason = `même valeur des deux côtés : « ${lv} »${scopePhrase(l)}${scopePhrase(r)}.`;
    } else {
      verdict = "DIFFERENT";
      reasonCode = "VALUE_DIFFERS";
      reason = `valeurs distinctes : « ${lv} »${scopePhrase(l)} contre « ${rv} »${scopePhrase(r)}.`;
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

  // ── 7. LA CENSURE RETIRE LE NÉGATIF — INV-4 ────────────────────────────
  if (verdict === "DIFFERENT" && censored) {
    const before = reasonCode;
    verdict = "NOT_COMPARABLE";
    reasonCode = "COVERAGE_CENSORED_NEGATIVE_WITHHELD";
    reason =
      `un écart était constaté (${before}), mais la couverture est bornée ` +
      `(« ${l.subjectRef} » : ${l.coverage?.censoredBy ?? "complète"} ; ` +
      `« ${r.subjectRef} » : ${r.coverage?.censoredBy ?? "complète"}). L'écart n'est pas affirmé.`;
  }

  const scopeRestricted =
    (l.state === "OBSERVED" && l.aggregation?.scope === "SOME_GROUPS") ||
    (r.state === "OBSERVED" && r.aggregation?.scope === "SOME_GROUPS");
  const unattributedIdentifier =
    (l.state === "OBSERVED" && l.attribution?.status === "UNATTRIBUTED") ||
    (r.state === "OBSERVED" && r.attribution?.status === "UNATTRIBUTED");

  const resultNature: DataNature | null =
    l.nature === null || r.nature === null ? null : leastAuthoritative(l.nature, r.nature);

  const result: ComparisonResultV2 = {
    verdict,
    resultNature,
    basis: {
      featureKey: spec.key,
      family: spec.family,
      kind: spec.kind,
      comparedOn: `« ${spec.key} » — ${spec.kind}, famille ${spec.family}, agrégation ${spec.aggregation}`,
      meaning: spec.meaning,
      left: l,
      right: r,
      overlap,
      resultIsFloor: censored,
      scopeRestricted,
      unattributedIdentifier,
      reasonCode,
      reason,
      experimental,
      nominative,
      ruleVersion: SIMILARITY_COMPARE_V2_RULE_VERSION,
    },
    reservations: [
      ...SIMILARITY_RESERVATIONS_V2,
      ...(experimental ? [EXPERIMENTAL_RESERVATION] : []),
      ...(censored ? [FLOOR_RESERVATION] : []),
      ...(nominative ? [NOMINATIVE_RESERVATION] : []),
      ...(scopeRestricted ? [SCOPE_RESERVATION] : []),
      ...(unattributedIdentifier ? [UNATTRIBUTED_RESERVATION] : []),
    ],
  };

  assertComparisonInvariantsV2(
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

export function compareSubjectsV2(
  left: SubjectFeatureSetV2,
  right: SubjectFeatureSetV2,
  where = "compareSubjectsV2",
): SubjectComparisonV2 {
  const index = (s: SubjectFeatureSetV2) => {
    const m = new Map<string, FeatureObservationV2>();
    for (const o of s.observations) {
      if (m.has(o.featureKey)) {
        throw new Error(
          `[similarity/v2] ${where} : « ${s.subjectRef} » porte deux observations pour ` +
            `« ${o.featureKey} ».`,
        );
      }
      m.set(o.featureKey, o);
    }
    return m;
  };
  const li = index(left);
  const ri = index(right);

  const out: SubjectComparisonV2 = {
    contractVersion: SIMILARITY_CONTRACT_V2_VERSION,
    ruleVersion: SIMILARITY_COMPARE_V2_RULE_VERSION,
    leftSubjectRef: left.subjectRef,
    rightSubjectRef: right.subjectRef,
    results: SIMILARITY_FEATURE_KEYS_V2.map((key) =>
      compareFeatureV2(
        key,
        { subjectRef: left.subjectRef, observation: li.get(key) ?? null },
        { subjectRef: right.subjectRef, observation: ri.get(key) ?? null },
        where,
      ),
    ),
  };
  assertNoAggregateScore(out, where);
  return out;
}
