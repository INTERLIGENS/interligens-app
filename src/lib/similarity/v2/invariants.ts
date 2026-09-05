// --- BUILD 7 / @v2 — LES INVARIANTS : LES NEUF, PLUS QUATRE ---------------
//
// PUR. Les neuf invariants de @v1 sont REPRIS À L'IDENTIQUE — @v2 corrige des
// lacunes, il n'assouplit rien. Quatre s'y ajoutent, un par priorité du pack :
//
//   INV-10  INADMISSIBLE ne se dégrade jamais en absence            (P1)
//   INV-11  aucune agrégation par vote majoritaire                  (P0)
//   INV-12  aucune heure fabriquée là où la source n'en donne pas   (P2)
//   INV-13  aucune identité sémantique sur une adresse non étiquetée (P3)
//
// Chacun a un mutant dédié dans `__tests__/mutation-v2.test.ts`, et
// `scripts/similarity/mutation-check-v2.mjs` prouve mécaniquement que sa garde
// porte — et qu'elle ne couvre que son bloc.

import { leastAuthoritative } from "@/lib/data-nature/nature";
import { isKnownMethodRef } from "@/lib/methodology/registry";
import {
  AbsenceBecameFindingError,
  CensoredNegativeError,
  EmptyObservationError,
  ExperimentalLaunderedError,
  ForbiddenConclusionError,
  MethodMismatchNotFlaggedError,
  NatureUpRankError,
  StateCollapseError,
  UnattributableComparisonError,
  assertNoAggregateScore,
  assertNoVerdictLanguage,
  assertPositiveContent,
} from "../invariants";
import { magnitudeIsDefinitional } from "./aggregate";
import { specForV2 } from "./registry";
import type {
  ComparisonReasonCodeV2,
  ComparisonResultV2,
  ComparisonSideV2,
  ComparisonVerdictV2,
  FeatureObservationV2,
} from "./types";

export {
  AbsenceBecameFindingError,
  CensoredNegativeError,
  EmptyObservationError,
  ExperimentalLaunderedError,
  ForbiddenConclusionError,
  MethodMismatchNotFlaggedError,
  NatureUpRankError,
  StateCollapseError,
  UnattributableComparisonError,
  assertNoAggregateScore,
  assertNoVerdictLanguage,
  assertPositiveContent,
};

export interface ComparisonSourcesV2 {
  leftSubjectRef: string;
  rightSubjectRef: string;
  left: FeatureObservationV2 | null;
  right: FeatureObservationV2 | null;
}

// ═══ INV-10 ═══════════════════════════════════════════════════════════════

export class InadmissibleDowngradedError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity/v2] INV-10 — une donnée INADMISSIBLE a été rendue comme une ` +
        `absence (${where}) : ${detail}. NOT_OBSERVED dit « on a regardé et il n'y ` +
        `avait rien » ; ici il y avait quelque chose, et c'est NOUS qui l'avons ` +
        `refusé. Sous NOT_OBSERVED un lecteur conclut qu'il faut collecter ` +
        `davantage ; sous INADMISSIBLE il sait que collecter la même chose ne ` +
        `changera rien. Aucun downgrade silencieux.`,
    );
    this.name = "InadmissibleDowngradedError";
  }
}

// ═══ INV-11 ═══════════════════════════════════════════════════════════════

export class MajorityVoteError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity/v2] INV-11 — agrégation par vote majoritaire (${where}) : ${detail}. ` +
        `« 5 groupes sur 6 disent X, donc le sujet est X » est un SEUIL DÉGUISÉ — ` +
        `pourquoi 5/6 et pas 4/6 ? — et il écrase le groupe qui dit autre chose. ` +
        `Quand les groupes divergent, la portée le dit (CONFLICTING_GROUPS) et ` +
        `AUCUNE valeur sujet n'est produite.`,
    );
    this.name = "MajorityVoteError";
  }
}

export class ScopeLaunderedError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity/v2] INV-11 — portée d'agrégation blanchie (${where}) : ${detail}. ` +
        `SOME_GROUPS N'EST PAS une vérité sujet-entier : une valeur démontrée par ` +
        `3 groupes sur 6 est démontrée PAR TROIS GROUPES SUR SIX, et la portée ` +
        `voyage avec elle jusque dans le résultat.`,
    );
    this.name = "ScopeLaunderedError";
  }
}

// ═══ INV-12 ═══════════════════════════════════════════════════════════════

const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class FabricatedInstantError extends Error {
  constructor(where: string, value: string) {
    super(
      `[similarity/v2] INV-12 — heure fabriquée (${where}) : « ${value} » se présente ` +
        `comme une résolution JOUR et porte pourtant une composante horaire. Minuit ` +
        `n'est pas une observation : c'est la valeur par défaut d'une colonne. ` +
        `Transporter cet instant affirmerait une minute que personne n'a mesurée, ` +
        `alors que les moteurs de ce produit mesurent des écarts de quelques secondes.`,
    );
    this.name = "FabricatedInstantError";
  }
}

/** Une preuve datée au JOUR est une DATE NUE. Jamais un instant. */
export function assertNoFabricatedInstant(
  temporal: { resolution: string; value: string } | null,
  where: string,
): void {
  if (!temporal || temporal.resolution !== "DAY") return;
  if (!BARE_DATE_RE.test(temporal.value)) {
    throw new FabricatedInstantError(where, temporal.value);
  }
}

// ═══ INV-13 ═══════════════════════════════════════════════════════════════

export class UnattributedIdentityError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity/v2] INV-13 — identité sémantique attachée à une adresse non ` +
        `étiquetée (${where}) : ${detail}. Une adresse identique est un IDENTIFIANT ` +
        `identique, et rien de plus : ni entité, ni venue, ni lecture de sortie. ` +
        `Une étiquette sans provenance auditable laisserait l'annotation d'un tiers ` +
        `décider comment INTERLIGENS lit ses propres preuves.`,
    );
    this.name = "UnattributedIdentityError";
  }
}

/** Cohérence d'une attribution, prise isolément. */
export function assertAttributionCoherent(
  attribution: { status: string; label: string | null; provenance: string | null } | null,
  where: string,
): void {
  if (!attribution) return;
  const { status, label, provenance } = attribution;
  if (status === "UNATTRIBUTED") {
    if (label !== null || provenance !== null) {
      throw new UnattributedIdentityError(
        where,
        `status UNATTRIBUTED avec label=${JSON.stringify(label)} et ` +
          `provenance=${JSON.stringify(provenance)}`,
      );
    }
    return;
  }
  if (status === "DECLARED_BY_SOURCE") {
    // Un nom RAPPORTÉ par la source. Il n'a pas de provenance auditable — c'est
    // précisément ce qui le distingue d'une attribution, et l'en doter
    // ferait passer une déclaration d'indexeur pour une vérification.
    if (!label || !label.trim()) {
      throw new UnattributedIdentityError(where, "DECLARED_BY_SOURCE sans nom déclaré");
    }
    if (provenance !== null) {
      throw new UnattributedIdentityError(
        where,
        "DECLARED_BY_SOURCE avec une provenance : un nom rapporté n'est pas vérifié",
      );
    }
    return;
  }
  if (!label?.trim() || !provenance?.trim()) {
    throw new UnattributedIdentityError(
      where,
      "ATTRIBUTED sans étiquette ET provenance auditables — non auditable ⇒ absent",
    );
  }
}

// ═══ VOCABULAIRE FERMÉ @v2 ════════════════════════════════════════════════

export const ALLOWED_VERDICT_REASONS_V2: Readonly<
  Record<ComparisonVerdictV2, readonly ComparisonReasonCodeV2[]>
> = Object.freeze({
  MATCH: ["EQUAL_VALUE", "IDENTICAL_SET"],
  PARTIAL_MATCH: ["SET_OVERLAP_PARTIAL"],
  DIFFERENT: ["VALUE_DIFFERS", "SET_DISJOINT"],
  NOT_COMPARABLE: [
    "SIDE_NOT_OBSERVABLE",
    "SIDE_INADMISSIBLE",
    "TEMPORAL_RESOLUTION_INSUFFICIENT",
    "COVERAGE_CENSORED_NEGATIVE_WITHHELD",
    "METHOD_MISMATCH",
    "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD",
  ],
});

export const UNATTRIBUTED_RESERVATION =
  "UNATTRIBUTED IDENTIFIER — at least one compared address carries no auditable label. " +
  "An identical address is an identical IDENTIFIER and nothing more: no entity, no venue, " +
  "no exchange, no cashout and no coordination may be read into it, and it carries no " +
  "probative weight.";

export const SCOPE_RESERVATION =
  "PARTIAL SCOPE — at least one side is demonstrated by only some of its groups. The result " +
  "holds for that scope and is NOT a whole-subject truth; the per-group facts travel with it.";

const sideRepr = (s: ComparisonSideV2): string => {
  if (!s.value) return s.state;
  if (s.value.kind === "CATEGORICAL") return s.value.value;
  if (s.value.kind === "SET") return s.value.values.join(",");
  return String(s.value.value);
};

const methodSignature = (s: ComparisonSideV2): string => {
  const m = s.method;
  if (!m) return "";
  const p = Object.keys(m.parameters)
    .sort()
    .map((k) => `${k}=${String(m.parameters[k])}`)
    .join(";");
  return `${m.methodRef ?? "-"}|${m.ruleVersion}|${p}`;
};

/** LES TREIZE INVARIANTS. LÈVE — ne corrige pas, ne dégrade pas. */
export function assertComparisonInvariantsV2(
  result: ComparisonResultV2,
  sources: ComparisonSourcesV2,
  where = "assertComparisonInvariantsV2",
): void {
  const b = result.basis;
  const spec = specForV2(b.featureKey, where);
  const sides: ReadonlyArray<[ComparisonSideV2, FeatureObservationV2 | null, "left" | "right"]> = [
    [b.left, sources.left, "left"],
    [b.right, sources.right, "right"],
  ];

  // ── INV-1 — transcription fidèle des SIX états ─────────────────────────
  for (const [side, obs, label] of sides) {
    const expected = obs ? obs.state : "MISSING";
    if (side.state !== expected) {
      throw new StateCollapseError(
        where,
        `côté ${label} transcrit « ${side.state} » alors que l'observation dit « ${expected} »`,
      );
    }
    if (side.state === "OBSERVED") {
      if (side.stateReason !== null) {
        throw new StateCollapseError(where, `côté ${label} OBSERVED avec un motif d'état`);
      }
    } else {
      if (side.value !== null) {
        throw new StateCollapseError(
          where,
          `côté ${label} en état « ${side.state} » porte pourtant une valeur`,
        );
      }
      if (!side.stateReason?.trim()) {
        throw new StateCollapseError(where, `côté ${label} en état « ${side.state} » sans motif`);
      }
    }
  }
  if (b.left.state !== "OBSERVED" || b.right.state !== "OBSERVED") {
    for (const [side, , label] of sides) {
      if (!b.reason.includes(side.state)) {
        throw new StateCollapseError(
          where,
          `le motif ne nomme pas l'état du côté ${label} (« ${side.state} »)`,
        );
      }
    }
  }

  // ── INV-10 — INADMISSIBLE ne se dégrade pas ────────────────────────────
  const anyInadmissible =
    b.left.state === "INADMISSIBLE" || b.right.state === "INADMISSIBLE";
  for (const [side, , label] of sides) {
    if (side.state === "INADMISSIBLE" && !side.inadmissibility) {
      throw new InadmissibleDowngradedError(
        where,
        `côté ${label} INADMISSIBLE sans cause déclarée — l'état seul ne dit pas si ` +
          `c'est la nature, la provenance ou la méthode qui bloque`,
      );
    }
    if (side.state !== "INADMISSIBLE" && side.inadmissibility) {
      throw new InadmissibleDowngradedError(
        where,
        `côté ${label} porte une cause d'inadmissibilité sous l'état « ${side.state} » — ` +
          `c'est exactement la dégradation silencieuse que INV-10 interdit`,
      );
    }
  }
  if (anyInadmissible && b.reasonCode !== "SIDE_INADMISSIBLE") {
    throw new InadmissibleDowngradedError(
      where,
      `motif « ${b.reasonCode} » alors qu'un côté est INADMISSIBLE`,
    );
  }
  if (!anyInadmissible && b.reasonCode === "SIDE_INADMISSIBLE") {
    throw new InadmissibleDowngradedError(
      where,
      "SIDE_INADMISSIBLE annoncé alors qu'aucun côté ne l'est",
    );
  }

  // ── INV-2 — l'absence ne devient jamais un constat ─────────────────────
  if (b.left.state !== "OBSERVED" || b.right.state !== "OBSERVED") {
    if (result.verdict !== "NOT_COMPARABLE") {
      throw new AbsenceBecameFindingError(
        where,
        result.verdict,
        `états ${b.left.state} / ${b.right.state}`,
      );
    }
    if (b.reasonCode !== "SIDE_NOT_OBSERVABLE" && b.reasonCode !== "SIDE_INADMISSIBLE") {
      throw new AbsenceBecameFindingError(
        where,
        result.verdict,
        `motif « ${b.reasonCode} » alors qu'un côté n'est pas observé`,
      );
    }
  }

  // ── INV-3 — contenu positif ────────────────────────────────────────────
  for (const [side, , label] of sides) {
    if (side.state === "OBSERVED") assertPositiveContent(side.value, `${where}/${label}`);
  }

  // ── INV-11 — aucun vote majoritaire, aucune portée blanchie ────────────
  for (const [side, , label] of sides) {
    const a = side.aggregation;
    if (side.state === "MISSING") {
      if (a !== null) throw new ScopeLaunderedError(where, `côté ${label} MISSING avec une agrégation`);
      continue;
    }
    if (!a) throw new ScopeLaunderedError(where, `côté ${label} sans détail d'agrégation`);
    if (a.rule !== spec.aggregation) {
      throw new ScopeLaunderedError(
        where,
        `côté ${label} agrégé sous « ${a.rule} » alors que le registre déclare ` +
          `« ${spec.aggregation} »`,
      );
    }
    if (side.state === "OBSERVED" && a.distinctValues.length > 1) {
      throw new MajorityVoteError(
        where,
        `côté ${label} OBSERVED alors que les groupes démontrent ${a.distinctValues.length} ` +
          `valeurs distinctes (${a.distinctValues.join(", ")})`,
      );
    }
    if (a.scope === "CONFLICTING_GROUPS" && side.state === "OBSERVED") {
      throw new MajorityVoteError(
        where,
        `côté ${label} OBSERVED sous une portée CONFLICTING_GROUPS`,
      );
    }
    if (a.rule === "ALL_OR_NOTHING" && side.state === "OBSERVED" && a.scope !== "ALL_GROUPS") {
      throw new ScopeLaunderedError(
        where,
        `côté ${label} sous ALL_OR_NOTHING mais avec la portée « ${a.scope} »`,
      );
    }
    if (
      a.rule === "PER_GROUP_MAGNITUDE" &&
      side.state === "OBSERVED" &&
      !magnitudeIsDefinitional(a)
    ) {
      throw new ScopeLaunderedError(
        where,
        `côté ${label} rend une valeur sujet pour une grandeur définie PAR GROUPE, ` +
          `alors que le sujet en agrège ${a.groupsConsidered}`,
      );
    }
    if (a.scope === "SOME_GROUPS") {
      if (a.groupsWithValue <= 0 || a.groupsWithValue >= a.groupsConsidered) {
        throw new ScopeLaunderedError(
          where,
          `côté ${label} déclare SOME_GROUPS avec ${a.groupsWithValue}/${a.groupsConsidered}`,
        );
      }
    }
    if (a.scope === "ALL_GROUPS" && a.groupsWithValue !== a.groupsConsidered) {
      throw new ScopeLaunderedError(
        where,
        `côté ${label} déclare ALL_GROUPS avec ${a.groupsWithValue}/${a.groupsConsidered}`,
      );
    }
  }
  const restricted = sides.some(
    ([s]) => s.state === "OBSERVED" && s.aggregation?.scope === "SOME_GROUPS",
  );
  if (b.scopeRestricted !== restricted) {
    throw new ScopeLaunderedError(
      where,
      `basis.scopeRestricted=${b.scopeRestricted} alors que les côtés donnent ${restricted}`,
    );
  }
  if (restricted && !result.reservations.includes(SCOPE_RESERVATION)) {
    throw new ScopeLaunderedError(where, "portée partielle sans la réserve correspondante");
  }

  // ── INV-12 — aucune heure fabriquée ────────────────────────────────────
  for (const [side, , label] of sides) {
    assertNoFabricatedInstant(side.temporal, `${where}/${label}`);
  }

  // ── INV-13 — pas d'identité sur une adresse non étiquetée ──────────────
  for (const [side, , label] of sides) {
    if (side.state === "MISSING") continue;
    if (spec.requiresAttribution && !side.attribution) {
      throw new UnattributedIdentityError(
        where,
        `côté ${label} compare une adresse sans déclarer d'attribution`,
      );
    }
    if (!spec.requiresAttribution && side.attribution) {
      throw new UnattributedIdentityError(
        where,
        `côté ${label} porte une attribution pour une feature qui ne compare pas d'adresse`,
      );
    }
    assertAttributionCoherent(side.attribution, `${where}/${label}`);
  }
  const unattributed = sides.some(
    ([s]) => s.state === "OBSERVED" && s.attribution?.status === "UNATTRIBUTED",
  );
  if (b.unattributedIdentifier !== unattributed) {
    throw new UnattributedIdentityError(
      where,
      `basis.unattributedIdentifier=${b.unattributedIdentifier} alors que les côtés ` +
        `donnent ${unattributed}`,
    );
  }
  if (unattributed && !result.reservations.includes(UNATTRIBUTED_RESERVATION)) {
    throw new UnattributedIdentityError(
      where,
      "adresse non étiquetée comparée sans la réserve correspondante",
    );
  }

  // ── INV-4 — la censure ne fabrique pas de négatif ──────────────────────
  const censored =
    (b.left.coverage !== null && !b.left.coverage.complete) ||
    (b.right.coverage !== null && !b.right.coverage.complete);
  if (result.verdict === "DIFFERENT" && censored) {
    throw new CensoredNegativeError(where, "verdict DIFFERENT avec couverture censurée");
  }
  if (censored && !b.resultIsFloor) {
    throw new CensoredNegativeError(where, "couverture censurée sans `resultIsFloor`");
  }

  // ── INV-5 — l'expérimental et le nominatif ne se blanchissent pas ──────
  const expExpected = (sources.left?.experimental ?? false) || (sources.right?.experimental ?? false);
  if (b.experimental !== expExpected) {
    throw new ExperimentalLaunderedError(where, `basis.experimental=${b.experimental}`);
  }
  if (b.experimental && !result.reservations.some((r) => r.includes("EXPERIMENTAL"))) {
    throw new ExperimentalLaunderedError(where, "aucune réserve EXPERIMENTAL");
  }
  const nomExpected = (sources.left?.nominative ?? false) || (sources.right?.nominative ?? false);
  if (b.nominative !== nomExpected) {
    throw new ExperimentalLaunderedError(where, `basis.nominative=${b.nominative}`);
  }

  // ── INV-6 — la nature ne remonte pas ───────────────────────────────────
  for (const [side, obs, label] of sides) {
    if (!obs) {
      if (side.nature !== null) {
        throw new NatureUpRankError(where, `côté ${label} MISSING doté d'une nature`);
      }
      continue;
    }
    if (side.nature !== spec.nature) {
      throw new NatureUpRankError(
        where,
        `côté ${label} rendu « ${side.nature} » contre « ${spec.nature} » au registre`,
      );
    }
  }
  if (b.left.nature === null || b.right.nature === null) {
    if (result.resultNature !== null) {
      throw new NatureUpRankError(where, "un côté MISSING et le résultat porte une nature");
    }
  } else {
    const expected = leastAuthoritative(b.left.nature, b.right.nature);
    if (result.resultNature !== expected) {
      throw new NatureUpRankError(where, `resultNature=${String(result.resultNature)}`);
    }
  }

  // ── INV-7 — attribuabilité ─────────────────────────────────────────────
  if (b.family !== spec.family || b.kind !== spec.kind) {
    throw new UnattributableComparisonError(where, "famille/sorte divergentes du registre");
  }
  if (!b.comparedOn.trim() || !b.reason.trim() || !b.ruleVersion.trim()) {
    throw new UnattributableComparisonError(where, "comparedOn, reason ou ruleVersion vide");
  }
  for (const [side, , label] of sides) {
    if (side.state === "MISSING") continue;
    if (!side.method?.ruleVersion.trim()) {
      throw new UnattributableComparisonError(where, `côté ${label} sans ruleVersion`);
    }
    if (side.method.methodRef !== null && !isKnownMethodRef(side.method.methodRef)) {
      throw new UnattributableComparisonError(
        where,
        `côté ${label} cite « ${side.method.methodRef} », qui ne résout sur aucun artefact gelé`,
      );
    }
    for (const p of spec.requiredParameters) {
      if (!(p in side.method.parameters)) {
        throw new UnattributableComparisonError(
          where,
          `côté ${label} sans le paramètre de méthode « ${p} »`,
        );
      }
    }
    if (!side.coverage) {
      throw new UnattributableComparisonError(where, `côté ${label} sans couverture`);
    }
    if (!side.coverage.complete && !side.coverage.censoredBy) {
      throw new UnattributableComparisonError(where, `côté ${label} incomplet sans cause`);
    }
    if (side.state === "OBSERVED") {
      if (side.evidence.length === 0 || side.evidence.some((e) => e.refs.length === 0)) {
        throw new UnattributableComparisonError(
          where,
          `côté ${label} OBSERVED sans preuve opposable`,
        );
      }
    }
    // Une INADMISSIBILITÉ doit être aussi attribuable qu'une observation :
    // sans quoi « refusé » deviendrait un verdict sans pièces.
    if (side.state === "INADMISSIBLE") {
      const d = side.inadmissibility!;
      if (!d.found.trim() || !d.required.trim()) {
        throw new UnattributableComparisonError(
          where,
          `côté ${label} INADMISSIBLE sans dire ce qui a été trouvé ni ce qui était exigé`,
        );
      }
    }
  }

  // ── INV-8 — vocabulaire fermé, aucun score, aucun seuil ────────────────
  const allowed = ALLOWED_VERDICT_REASONS_V2[result.verdict];
  if (!allowed || !allowed.includes(b.reasonCode)) {
    throw new ForbiddenConclusionError(
      where,
      `couple (${result.verdict}, ${b.reasonCode}) hors du vocabulaire fermé`,
    );
  }
  if (
    spec.kind === "ORDINAL" &&
    b.left.state === "OBSERVED" &&
    b.right.state === "OBSERVED" &&
    b.reasonCode !== "METHOD_MISMATCH" &&
    b.reasonCode !== "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD"
  ) {
    throw new ForbiddenConclusionError(where, "une grandeur ORDINAL a été jugée");
  }
  assertNoAggregateScore(result, where);
  assertNoVerdictLanguage(
    b.reason,
    [
      sideRepr(b.left), sideRepr(b.right),
      methodSignature(b.left), methodSignature(b.right),
      b.left.method?.methodRef ?? "", b.right.method?.methodRef ?? "",
      b.left.method?.ruleVersion ?? "", b.right.method?.ruleVersion ?? "",
      b.left.stateReason ?? "", b.right.stateReason ?? "",
      b.left.coverage?.censoredBy ?? "", b.right.coverage?.censoredBy ?? "",
      b.left.attribution?.label ?? "", b.right.attribution?.label ?? "",
      b.left.subjectRef, b.right.subjectRef,
      b.featureKey, b.family,
    ],
    where,
  );

  // ── INV-9 — deux méthodes différentes ne se comparent pas ──────────────
  if (b.left.state === "OBSERVED" && b.right.state === "OBSERVED") {
    const same = methodSignature(b.left) === methodSignature(b.right);
    if (!same && b.reasonCode !== "METHOD_MISMATCH") {
      throw new MethodMismatchNotFlaggedError(where, "méthodes divergentes non signalées");
    }
    if (same && b.reasonCode === "METHOD_MISMATCH") {
      throw new MethodMismatchNotFlaggedError(where, "METHOD_MISMATCH sans divergence");
    }
  }
}
