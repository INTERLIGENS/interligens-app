// --- BUILD 7 / @v2 — LE CONSTRUCTEUR D'OBSERVATION ------------------------
//
// PUR. Le seul chemin par lequel une caractéristique entre dans le comparateur
// @v2. Il reprend tous les refus de @v1 et en ajoute quatre, un par priorité.

import { EmptyObservationError, assertPositiveContent } from "../invariants";
import { magnitudeIsDefinitional } from "./aggregate";
import { specForV2 } from "./registry";
import {
  assertAttributionCoherent,
  assertNoFabricatedInstant,
  InadmissibleDowngradedError,
  MajorityVoteError,
  ScopeLaunderedError,
  UnattributedIdentityError,
} from "./invariants";
import type {
  AggregationDetail,
  AttributionDetail,
  EvidenceRef,
  FeatureCoverage,
  FeatureMethod,
  FeatureObservationV2,
  FeatureValue,
  InadmissibilityDetail,
  ObservedSideStateV2,
  TemporalDetail,
} from "./types";

export class MalformedObservationV2Error extends Error {
  constructor(featureKey: string, detail: string, where: string) {
    super(
      `[similarity/v2] observation « ${featureKey} » mal formée (${where}) : ${detail}. ` +
        `Le constructeur REFUSE plutôt qu'il ne dégrade.`,
    );
    this.name = "MalformedObservationV2Error";
  }
}

export interface BuildFeatureObservationV2Input {
  featureKey: string;
  state: ObservedSideStateV2;
  value?: FeatureValue | null;
  stateReason?: string | null;
  method: FeatureMethod;
  coverage: FeatureCoverage;
  evidence?: readonly EvidenceRef[];
  /** Requis SI ET SEULEMENT SI `state === "INADMISSIBLE"`. */
  inadmissibility?: InadmissibilityDetail | null;
  /** Requis pour les features agrégées ; sinon `NOT_AGGREGATED` est posé d'office. */
  aggregation?: AggregationDetail | null;
  /** Requis SI ET SEULEMENT SI le registre déclare `requiresAttribution`. */
  attribution?: AttributionDetail | null;
  temporal?: TemporalDetail | null;
}

function normalizeSet(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()))].sort();
}

export function buildFeatureObservationV2(
  input: BuildFeatureObservationV2Input,
  where = "buildFeatureObservationV2",
): FeatureObservationV2 {
  const spec = specForV2(input.featureKey, where);
  const state = input.state;
  const fail = (d: string) => {
    throw new MalformedObservationV2Error(spec.key, d, where);
  };

  // ── L'état gouverne le reste (repris de @v1) ────────────────────────────
  if (state === "OBSERVED") {
    if (input.stateReason) fail("un motif d'état accompagne un état OBSERVED");
  } else {
    if (input.value) fail(`état « ${state} » accompagné d'une valeur`);
    if (!input.stateReason?.trim()) fail(`état « ${state} » sans motif`);
  }

  // ── P1 — INADMISSIBLE exige sa cause, et personne d'autre ne l'a ────────
  if (state === "INADMISSIBLE") {
    const d = input.inadmissibility;
    if (!d) {
      throw new InadmissibleDowngradedError(
        where,
        `« ${spec.key} » INADMISSIBLE sans cause : l'état seul ne dit pas si c'est la ` +
          `nature, la provenance ou la méthode qui bloque`,
      );
    }
    if (!d.found.trim() || !d.required.trim()) {
      fail("inadmissibilité sans `found` ni `required` — un refus doit rester contestable");
    }
  } else if (input.inadmissibility) {
    throw new InadmissibleDowngradedError(
      where,
      `« ${spec.key} » porte une cause d'inadmissibilité sous l'état « ${state} »`,
    );
  }

  // ── Couverture, méthode (repris de @v1) ────────────────────────────────
  if (state === "CENSORED" && input.coverage.complete) {
    fail("état CENSORED alors que la couverture se déclare complète");
  }
  if (!input.coverage.complete && !input.coverage.censoredBy?.trim()) {
    fail("couverture incomplète sans dire ce qui a coupé");
  }
  if (input.coverage.complete && input.coverage.censoredBy) {
    fail("couverture complète ET censurée");
  }
  if (!input.method.ruleVersion.trim()) fail("ruleVersion vide");
  for (const p of spec.requiredParameters) {
    if (!(p in input.method.parameters)) fail(`paramètre de méthode « ${p} » manquant`);
  }

  // ── P0 — l'agrégation est déclarée, et elle doit dire la vérité ─────────
  const aggregation: AggregationDetail = input.aggregation ?? {
    rule: spec.aggregation,
    scope: "NOT_AGGREGATED",
    groupsConsidered: 0,
    groupsWithValue: 0,
    perGroup: [],
    distinctValues: [],
  };
  if (aggregation.rule !== spec.aggregation) {
    throw new ScopeLaunderedError(
      where,
      `« ${spec.key} » agrégée sous « ${aggregation.rule} » alors que le registre ` +
        `déclare « ${spec.aggregation} »`,
    );
  }
  if (spec.aggregation === "SUBJECT_LEVEL" && aggregation.scope !== "NOT_AGGREGATED") {
    throw new ScopeLaunderedError(
      where,
      `« ${spec.key} » est de niveau sujet et ne peut porter la portée « ${aggregation.scope} »`,
    );
  }
  if (state === "OBSERVED") {
    if (aggregation.distinctValues.length > 1) {
      throw new MajorityVoteError(
        where,
        `« ${spec.key} » OBSERVED alors que les groupes démontrent ` +
          `${aggregation.distinctValues.length} valeurs distinctes ` +
          `(${aggregation.distinctValues.join(", ")})`,
      );
    }
    if (aggregation.scope === "CONFLICTING_GROUPS") {
      throw new MajorityVoteError(where, `« ${spec.key} » OBSERVED sous CONFLICTING_GROUPS`);
    }
    if (spec.aggregation === "PER_GROUP_MAGNITUDE" && !magnitudeIsDefinitional(aggregation)) {
      throw new ScopeLaunderedError(
        where,
        `« ${spec.key} » est une grandeur définie PAR GROUPE et le sujet en agrège ` +
          `${aggregation.groupsConsidered} : il n'y a pas de valeur sujet, et la résumer ` +
          `fabriquerait une grandeur que rien n'a mesurée`,
      );
    }
    if (spec.aggregation === "ALL_OR_NOTHING" && aggregation.scope !== "ALL_GROUPS") {
      throw new ScopeLaunderedError(
        where,
        `« ${spec.key} » sous ALL_OR_NOTHING avec la portée « ${aggregation.scope} »`,
      );
    }
  }

  // ── P2 — aucune heure fabriquée ────────────────────────────────────────
  assertNoFabricatedInstant(input.temporal ?? null, `${where}/${spec.key}`);

  // ── P3 — l'attribution, exigée exactement où le registre la demande ────
  const attribution = input.attribution ?? null;
  if (spec.requiresAttribution && !attribution) {
    throw new UnattributedIdentityError(
      where,
      `« ${spec.key} » compare une adresse et ne déclare aucune attribution`,
    );
  }
  if (!spec.requiresAttribution && attribution) {
    throw new UnattributedIdentityError(
      where,
      `« ${spec.key} » ne compare pas d'adresse et porte pourtant une attribution`,
    );
  }
  assertAttributionCoherent(attribution, `${where}/${spec.key}`);

  // ── La valeur (repris de @v1) ──────────────────────────────────────────
  let value: FeatureValue | null = null;
  if (state === "OBSERVED") {
    const raw = input.value;
    if (!raw) throw new EmptyObservationError(where, `« ${spec.key} » OBSERVED sans valeur`);
    if (raw.kind !== spec.kind) fail(`valeur de sorte « ${raw.kind} » contre « ${spec.kind} »`);
    value = raw.kind === "SET" ? { kind: "SET", values: normalizeSet(raw.values) } : raw;
    assertPositiveContent(value, `${where}/${spec.key}`);
    if (raw.kind === "ORDINAL" && raw.unit !== spec.unit) {
      fail(`unité « ${raw.unit} » contre « ${String(spec.unit)} » au registre`);
    }
    if (spec.allowedValues) {
      const offenders =
        value.kind === "CATEGORICAL"
          ? spec.allowedValues.includes(value.value) ? [] : [value.value]
          : value.kind === "SET"
            ? value.values.filter((v) => !spec.allowedValues!.includes(v))
            : [];
      if (offenders.length > 0) fail(`valeur(s) hors vocabulaire : ${offenders.join(", ")}`);
    }
  }

  const evidence = input.evidence ?? [];
  if (state === "OBSERVED") {
    if (evidence.length === 0 || evidence.some((e) => e.refs.length === 0 || !e.kind.trim())) {
      fail("OBSERVED sans preuve opposable");
    }
  }

  return {
    featureKey: spec.key,
    family: spec.family,
    kind: spec.kind,
    state,
    value,
    stateReason: state === "OBSERVED" ? null : (input.stateReason ?? null),
    nature: spec.nature,
    experimental: spec.experimental,
    nominative: spec.nominative,
    method: {
      methodRef: input.method.methodRef,
      ruleVersion: input.method.ruleVersion,
      parameters: { ...input.method.parameters },
    },
    coverage: {
      complete: input.coverage.complete,
      censoredBy: input.coverage.censoredBy ?? null,
      upstream: input.coverage.upstream,
    },
    evidence: evidence.map((e) => ({ kind: e.kind, refs: [...e.refs] })),
    inadmissibility: state === "INADMISSIBLE" ? input.inadmissibility! : null,
    aggregation,
    attribution,
    temporal: input.temporal ?? null,
  };
}

/** Une adresse dont rien d'auditable ne dit ce qu'elle est. Le cas par défaut. */
export const UNATTRIBUTED: AttributionDetail = Object.freeze({
  status: "UNATTRIBUTED",
  label: null,
  provenance: null,
});

/** Un nom RAPPORTÉ par la source (programme d'indexeur). Jamais vérifié. */
export function declaredBySource(label: string): AttributionDetail {
  return { status: "DECLARED_BY_SOURCE", label, provenance: null };
}
