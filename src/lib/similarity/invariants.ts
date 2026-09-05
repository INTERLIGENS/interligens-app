// --- BUILD 7 / S2 — LES INVARIANTS DURS, EXÉCUTABLES ----------------------
//
// PUR. Un commentaire ne refuse rien. Chaque règle de R2 est ici une FONCTION
// qui lève, avec sa classe d'erreur nommée, et chacune a un mutant dédié dans
// `__tests__/mutation.test.ts` : retirer la règle fait rougir EXACTEMENT un
// test, et ce test ne passe par aucune autre garde.
//
// ██ POURQUOI VÉRIFIER LA SORTIE DU COMPARATEUR PLUTÔT QUE LUI FAIRE CONFIANCE ██
//
// `compareFeature` calcule, puis `assertComparisonInvariants` CONTRÔLE ce qu'il
// vient de calculer. Ça a l'air redondant. Ça ne l'est pas : le calcul et le
// contrôle sont deux écritures indépendantes de la même règle, et une faute de
// frappe dans l'une ne se reproduit pas à l'identique dans l'autre. Surtout,
// le contrôle est appelable sur N'IMPORTE QUELLE sortie — y compris celle d'un
// futur second comparateur, ou celle d'un mutant. Sans lui, les invariants
// tiendraient par omission : on pourrait supprimer n'importe quelle règle du
// calcul sans qu'un seul test rougisse.
//
// ─── LES NEUF INVARIANTS ──────────────────────────────────────────────────
//
//   INV-1  les cinq états ne fusionnent jamais et sont transcrits fidèlement
//   INV-2  l'absence de preuve ne devient jamais MATCH, PARTIAL ni DIFFERENT
//   INV-3  une observation doit avoir un CONTENU POSITIF
//   INV-4  la censure ne peut qu'affaiblir un négatif, jamais le fabriquer
//   INV-5  une sortie EXPÉRIMENTALE ne devient pas un fait canonique
//   INV-6  la nature ne remonte jamais l'échelle d'autorité
//   INV-7  chaque comparaison est ATTRIBUABLE à sa preuve et à sa méthode
//   INV-8  vocabulaire fermé, aucun score global, aucun seuil
//   INV-9  deux méthodes différentes ne se comparent pas

import { leastAuthoritative } from "@/lib/data-nature/nature";
import { isKnownMethodRef } from "@/lib/methodology/registry";
import { specFor } from "./registry";
import type {
  ComparisonReasonCode,
  ComparisonResult,
  ComparisonSide,
  ComparisonVerdict,
  FeatureObservation,
  FeatureValue,
} from "./types";

export interface ComparisonSources {
  leftSubjectRef: string;
  rightSubjectRef: string;
  /** `null` = la feature n'a jamais été extraite pour ce sujet ⇒ MISSING. */
  left: FeatureObservation | null;
  right: FeatureObservation | null;
}

// ═══ INV-1 ════════════════════════════════════════════════════════════════

export class StateCollapseError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-1 — les cinq états d'observabilité ne fusionnent pas (${where}) : ${detail}. ` +
        `MISSING, NOT_OBSERVED, NOT_MEASURABLE et CENSORED répondent à quatre ` +
        `questions différentes ; les confondre attribue la réponse à la mauvaise, ` +
        `et deux absences côte à côte se lisent alors comme une ressemblance.`,
    );
    this.name = "StateCollapseError";
  }
}

// ═══ INV-2 ════════════════════════════════════════════════════════════════

export class AbsenceBecameFindingError extends Error {
  constructor(where: string, verdict: ComparisonVerdict, detail: string) {
    super(
      `[similarity] INV-2 — l'absence de preuve est devenue « ${verdict} » (${where}) : ${detail}. ` +
        `Une collecte bornée qui n'a rien vu n'établit RIEN. Rendre cela comme ` +
        `une différence convertirait une limite de budget en fait sur le monde ; ` +
        `le rendre comme une ressemblance serait pire encore.`,
    );
    this.name = "AbsenceBecameFindingError";
  }
}

// ═══ INV-3 ════════════════════════════════════════════════════════════════

export class EmptyObservationError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-3 — observation sans contenu positif (${where}) : ${detail}. ` +
        `Un ensemble vide, un booléen faux ou une chaîne vide ne sont pas des ` +
        `observations : ce sont des absences déguisées en valeurs. Deux d'entre ` +
        `elles se compareraient égales, et « les deux n'ont rien » se lirait ` +
        `« les deux se ressemblent ».`,
    );
    this.name = "EmptyObservationError";
  }
}

// ═══ INV-4 ════════════════════════════════════════════════════════════════

export class CensoredNegativeError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-4 — différence affirmée sous couverture censurée (${where}) : ${detail}. ` +
        `Sous censure, une valeur est un PLANCHER : ce qui manque d'un côté peut ` +
        `vivre entièrement hors de l'échantillon. La censure ne peut donc ` +
        `qu'AFFAIBLIR un négatif — jamais le produire.`,
    );
    this.name = "CensoredNegativeError";
  }
}

// ═══ INV-5 ════════════════════════════════════════════════════════════════

export class ExperimentalLaunderedError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-5 — statut expérimental perdu (${where}) : ${detail}. ` +
        `Une sortie expérimentale (PRE-SHILL : fenêtre de 600 s, corpus de 8 ` +
        `occasions sur 3 KOL) ne devient pas un fait canonique parce qu'elle a ` +
        `traversé un comparateur. Le drapeau se propage, il ne se nettoie pas.`,
    );
    this.name = "ExperimentalLaunderedError";
  }
}

// ═══ INV-6 ════════════════════════════════════════════════════════════════

export class NatureUpRankError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-6 — la nature a remonté l'échelle d'autorité (${where}) : ${detail}. ` +
        `Une INFERENCE ne devient pas une PRIMARY_OBSERVATION parce qu'on l'a ` +
        `comparée. La nature d'un résultat est la MOINS autoritaire de ses ` +
        `entrées (règle §1.2) — toute autre règle rend le sur-classement possible.`,
    );
    this.name = "NatureUpRankError";
  }
}

// ═══ INV-7 ════════════════════════════════════════════════════════════════

export class UnattributableComparisonError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-7 — comparaison non attribuable (${where}) : ${detail}. ` +
        `Une comparaison sans preuve opposable et sans méthode retrouvable n'est ` +
        `pas une observation, seulement une affirmation — exactement ce que la ` +
        `question produit refuse de rendre.`,
    );
    this.name = "UnattributableComparisonError";
  }
}

// ═══ INV-8 ════════════════════════════════════════════════════════════════

export class ForbiddenConclusionError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-8 — conclusion interdite (${where}) : ${detail}. ` +
        `La similarité ne produit ni culpabilité, ni scam, ni coordination, ni ` +
        `opérateur commun. Le vocabulaire de sortie est FERMÉ, il n'y a pas de ` +
        `score global, et aucun seuil n'entre dans ce comparateur.`,
    );
    this.name = "ForbiddenConclusionError";
  }
}

// ═══ INV-9 ════════════════════════════════════════════════════════════════

export class MethodMismatchNotFlaggedError extends Error {
  constructor(where: string, detail: string) {
    super(
      `[similarity] INV-9 — deux méthodes différentes ont été comparées (${where}) : ${detail}. ` +
        `« Deux évaluations sous deux seuils ne se comparent pas » : rien dans ` +
        `les VALEURS ne signale qu'une fenêtre, une version de règle ou un ` +
        `paramètre a changé. C'est la méthode qui le dit, ou personne.`,
    );
    this.name = "MethodMismatchNotFlaggedError";
  }
}

// ═══ LE VOCABULAIRE FERMÉ ═════════════════════════════════════════════════

/** Les seuls couples (verdict, motif) qui existent. Rien d'autre n'est émettable. */
export const ALLOWED_VERDICT_REASONS: Readonly<
  Record<ComparisonVerdict, readonly ComparisonReasonCode[]>
> = Object.freeze({
  MATCH: ["EQUAL_VALUE", "IDENTICAL_SET"],
  PARTIAL_MATCH: ["SET_OVERLAP_PARTIAL"],
  DIFFERENT: ["VALUE_DIFFERS", "SET_DISJOINT"],
  NOT_COMPARABLE: [
    "SIDE_NOT_OBSERVABLE",
    "COVERAGE_CENSORED_NEGATIVE_WITHHELD",
    "METHOD_MISMATCH",
    "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD",
  ],
});

/**
 * Le lexique refusé dans le MOTIF d'une comparaison.
 *
 * Il ne s'applique PAS aux réserves ni au `meaning` du registre : ces textes
 * contiennent délibérément « coordination », « scam » ou « manipulation »,
 * parce que leur rôle est justement de DÉMENTIR ces lectures. Interdire le mot
 * partout rendrait le démenti inécrivable — et un démenti qu'on ne peut pas
 * écrire ne protège personne.
 */
export const FORBIDDEN_CONCLUSION_LEXICON: readonly string[] = [
  "scam",
  "rug",
  "fraud",
  "guilt",
  "culpab",
  "coordinat",
  "insider",
  "manipul",
  "sybil",
  "launder",
  "blanchi",
  "collusion",
  "conspir",
  "entente",
  "same operator",
  "shared operator",
  "operateur commun",
  "meme operateur",
];

/** Clés qui trahiraient un score agrégé. Aucune ne doit exister dans la sortie. */
const AGGREGATE_KEY_RE =
  /(score|rating|similarity|confidence|weight|ratio|percent|probability|likelihood|threshold)/i;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Refuse un mot de verdict dans un motif.
 *
 * `redactions` retire d'abord les VALEURS comparées, les references de méthode
 * et la clé de feature : `coordinated-exit/qualify@v1` est une référence, pas
 * une conclusion, et la faire déclencher la garde apprendrait aux auteurs à
 * contourner la garde plutôt qu'à écrire juste.
 */
export function assertNoVerdictLanguage(
  text: string,
  redactions: readonly string[],
  where: string,
): void {
  let scanned = stripAccents(text).toLowerCase();
  for (const r of redactions) {
    if (!r) continue;
    scanned = scanned.split(stripAccents(r).toLowerCase()).join(" ");
  }
  for (const banned of FORBIDDEN_CONCLUSION_LEXICON) {
    if (scanned.includes(banned)) {
      throw new ForbiddenConclusionError(
        where,
        `le motif contient « ${banned} » — un motif de comparaison décrit ce qui a ` +
          `été comparé, jamais ce que la comparaison signifierait`,
      );
    }
  }
}

/** Refuse toute clé d'agrégat, à n'importe quelle profondeur. */
export function assertNoAggregateScore(value: unknown, where: string, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoAggregateScore(v, where, `${path}[${i}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (AGGREGATE_KEY_RE.test(k)) {
      throw new ForbiddenConclusionError(
        where,
        `la sortie porte une clé d'agrégat « ${path}.${k} ». Il n'y a pas de score ` +
          `de similarité : réduire des features hétérogènes à un nombre demanderait ` +
          `des poids, et des poids sont un verdict déguisé`,
      );
    }
    assertNoAggregateScore(v, where, `${path}.${k}`);
  }
}

// ═══ CONTENU POSITIF ══════════════════════════════════════════════════════

/**
 * INV-3 — une observation doit AFFIRMER quelque chose.
 *
 * L'ensemble vide est le piège principal : « aucun venue démontré » et « aucun
 * venue démontré » se compareraient identiques. L'absence s'exprime par un
 * ÉTAT (NOT_OBSERVED), jamais par une valeur vide.
 */
export function assertPositiveContent(value: FeatureValue | null, where: string): void {
  if (!value) throw new EmptyObservationError(where, "aucune valeur alors que l'état est OBSERVED");
  if (value.kind === "CATEGORICAL") {
    if (value.value.trim() === "") {
      throw new EmptyObservationError(where, "valeur catégorielle vide");
    }
    return;
  }
  if (value.kind === "SET") {
    if (value.values.length === 0) {
      throw new EmptyObservationError(
        where,
        "ensemble VIDE — « rien de démontré » est un état (NOT_OBSERVED), pas une valeur",
      );
    }
    if (value.values.some((v) => v.trim() === "")) {
      throw new EmptyObservationError(where, "l'ensemble contient un identifiant vide");
    }
    return;
  }
  if (!Number.isFinite(value.value)) {
    throw new EmptyObservationError(where, `grandeur non finie (${String(value.value)})`);
  }
}

// ═══ LE CONTRÔLE COMPLET ══════════════════════════════════════════════════

function sideRepr(side: ComparisonSide): string {
  if (!side.value) return side.state;
  if (side.value.kind === "CATEGORICAL") return side.value.value;
  if (side.value.kind === "SET") return side.value.values.join(",");
  return String(side.value.value);
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

/**
 * APPLIQUE LES NEUF INVARIANTS à un résultat de comparaison, confronté aux
 * observations qui l'ont produit. LÈVE — ne corrige pas, ne dégrade pas.
 */
export function assertComparisonInvariants(
  result: ComparisonResult,
  sources: ComparisonSources,
  where = "assertComparisonInvariants",
): void {
  const b = result.basis;
  const spec = specFor(b.featureKey, where);
  const sides: ReadonlyArray<[ComparisonSide, FeatureObservation | null, "left" | "right"]> = [
    [b.left, sources.left, "left"],
    [b.right, sources.right, "right"],
  ];

  // ── INV-1 — transcription fidèle des cinq états ────────────────────────
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
          `côté ${label} en état « ${side.state} » porte pourtant une valeur — un état ` +
            `non observé qui transporte une valeur est exactement la fusion interdite`,
        );
      }
      if (!side.stateReason || side.stateReason.trim() === "") {
        throw new StateCollapseError(
          where,
          `côté ${label} en état « ${side.state} » sans motif : l'état seul ne dit pas ` +
            `laquelle des quatre limites a joué`,
        );
      }
    }
  }
  if (b.left.state !== "OBSERVED" || b.right.state !== "OBSERVED") {
    // Le motif doit NOMMER les deux états. Un motif générique laisserait le
    // lecteur attribuer l'absence à la mauvaise cause.
    for (const [side, , label] of sides) {
      if (!b.reason.includes(side.state)) {
        throw new StateCollapseError(
          where,
          `le motif ne nomme pas l'état du côté ${label} (« ${side.state} »)`,
        );
      }
    }
  }

  // ── INV-2 — l'absence ne devient jamais un constat ─────────────────────
  const anyUnobserved = b.left.state !== "OBSERVED" || b.right.state !== "OBSERVED";
  if (anyUnobserved) {
    if (result.verdict !== "NOT_COMPARABLE") {
      throw new AbsenceBecameFindingError(
        where,
        result.verdict,
        `états ${b.left.state} / ${b.right.state}`,
      );
    }
    if (b.reasonCode !== "SIDE_NOT_OBSERVABLE") {
      throw new AbsenceBecameFindingError(
        where,
        result.verdict,
        `motif « ${b.reasonCode} » alors qu'un côté n'est pas observé — le motif doit ` +
          `dire que c'est l'observabilité qui bloque`,
      );
    }
  }

  // ── INV-3 — contenu positif de chaque côté observé ─────────────────────
  for (const [side, , label] of sides) {
    if (side.state === "OBSERVED") assertPositiveContent(side.value, `${where}/${label}`);
  }

  // ── INV-4 — la censure ne fabrique pas de négatif ──────────────────────
  const censored =
    (b.left.coverage !== null && !b.left.coverage.complete) ||
    (b.right.coverage !== null && !b.right.coverage.complete);
  if (result.verdict === "DIFFERENT" && censored) {
    throw new CensoredNegativeError(
      where,
      `verdict DIFFERENT avec couverture censurée ` +
        `(gauche: ${b.left.coverage?.censoredBy ?? "complète"}, ` +
        `droite: ${b.right.coverage?.censoredBy ?? "complète"})`,
    );
  }
  if (censored && !b.resultIsFloor) {
    throw new CensoredNegativeError(
      where,
      "couverture censurée sans `resultIsFloor` — le résultat serait lu comme démontré",
    );
  }

  // ── INV-5 — l'expérimental ne se blanchit pas ──────────────────────────
  const expectedExperimental = (sources.left?.experimental ?? false) || (sources.right?.experimental ?? false);
  if (b.experimental !== expectedExperimental) {
    throw new ExperimentalLaunderedError(
      where,
      `basis.experimental=${b.experimental} alors que les entrées donnent ${expectedExperimental}`,
    );
  }
  if (b.experimental && !result.reservations.some((r) => r.includes("EXPERIMENTAL"))) {
    throw new ExperimentalLaunderedError(
      where,
      "aucune réserve EXPERIMENTAL portée par le résultat",
    );
  }
  const expectedNominative = (sources.left?.nominative ?? false) || (sources.right?.nominative ?? false);
  if (b.nominative !== expectedNominative) {
    throw new ExperimentalLaunderedError(
      where,
      `basis.nominative=${b.nominative} alors que les entrées donnent ${expectedNominative}`,
    );
  }

  // ── INV-6 — la nature ne remonte pas ───────────────────────────────────
  for (const [side, obs, label] of sides) {
    if (!obs) {
      if (side.nature !== null) {
        throw new NatureUpRankError(
          where,
          `côté ${label} MISSING doté d'une nature — on ne classe pas une absence`,
        );
      }
      continue;
    }
    if (side.nature !== spec.nature) {
      throw new NatureUpRankError(
        where,
        `côté ${label} rendu « ${side.nature} » alors que le registre déclare « ${spec.nature} »`,
      );
    }
  }
  if (b.left.nature === null || b.right.nature === null) {
    if (result.resultNature !== null) {
      throw new NatureUpRankError(
        where,
        "un côté est MISSING et le résultat porte pourtant une nature",
      );
    }
  } else {
    const expected = leastAuthoritative(b.left.nature, b.right.nature);
    if (result.resultNature !== expected) {
      throw new NatureUpRankError(
        where,
        `resultNature=${String(result.resultNature)} alors que la moins autoritaire ` +
          `de (${b.left.nature}, ${b.right.nature}) est ${expected}`,
      );
    }
  }

  // ── INV-7 — attribuabilité ─────────────────────────────────────────────
  if (b.family !== spec.family || b.kind !== spec.kind) {
    throw new UnattributableComparisonError(
      where,
      `famille/sorte divergentes du registre (${b.family}/${b.kind} vs ${spec.family}/${spec.kind})`,
    );
  }
  if (!b.comparedOn.trim() || !b.reason.trim() || !b.ruleVersion.trim()) {
    throw new UnattributableComparisonError(where, "comparedOn, reason ou ruleVersion vide");
  }
  for (const [side, , label] of sides) {
    if (side.state === "MISSING") continue;
    if (!side.method || !side.method.ruleVersion.trim()) {
      throw new UnattributableComparisonError(where, `côté ${label} sans ruleVersion`);
    }
    if (side.method.methodRef !== null && !isKnownMethodRef(side.method.methodRef)) {
      throw new UnattributableComparisonError(
        where,
        `côté ${label} cite « ${side.method.methodRef} », qui ne résout sur aucun ` +
          `artefact gelé — une référence qui ne mène nulle part ne documente rien`,
      );
    }
    for (const p of spec.requiredParameters) {
      if (!(p in side.method.parameters)) {
        throw new UnattributableComparisonError(
          where,
          `côté ${label} sans le paramètre de méthode « ${p} », exigé par le registre`,
        );
      }
    }
    if (!side.coverage) {
      throw new UnattributableComparisonError(where, `côté ${label} sans couverture`);
    }
    if (!side.coverage.complete && !side.coverage.censoredBy) {
      throw new UnattributableComparisonError(
        where,
        `côté ${label} incomplet sans dire ce qui a coupé`,
      );
    }
    if (side.state === "OBSERVED") {
      if (side.evidence.length === 0 || side.evidence.some((e) => e.refs.length === 0)) {
        throw new UnattributableComparisonError(
          where,
          `côté ${label} OBSERVED sans preuve opposable`,
        );
      }
    }
  }

  // ── INV-8 — vocabulaire fermé, aucun score, aucun seuil ────────────────
  const allowed = ALLOWED_VERDICT_REASONS[result.verdict];
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
    throw new ForbiddenConclusionError(
      where,
      `une grandeur ORDINAL a été jugée (« ${b.reasonCode} »). Dire « proche » ou ` +
        `« différent » sur des secondes ou des comptes exigerait un seuil, et aucun ` +
        `seuil n'est ratifié pour cette comparaison`,
    );
  }
  assertNoAggregateScore(result, where);
  assertNoVerdictLanguage(
    b.reason,
    // Ce qui est RETIRÉ avant le scan : tout ce qui vient d'ailleurs. Une
    // référence de méthode (`coordinated-exit/qualify@v1`), un motif d'état
    // rendu par un moteur amont, un identifiant de sujet ou une cause de
    // censure ne sont pas des conclusions de CE comparateur. Les laisser
    // déclencher la garde apprendrait aux auteurs à contourner la garde
    // plutôt qu'à écrire juste.
    [
      sideRepr(b.left),
      sideRepr(b.right),
      methodSignature(b.left),
      methodSignature(b.right),
      b.left.method?.methodRef ?? "",
      b.right.method?.methodRef ?? "",
      b.left.method?.ruleVersion ?? "",
      b.right.method?.ruleVersion ?? "",
      b.left.stateReason ?? "",
      b.right.stateReason ?? "",
      b.left.coverage?.censoredBy ?? "",
      b.right.coverage?.censoredBy ?? "",
      b.left.subjectRef,
      b.right.subjectRef,
      b.featureKey,
      b.family,
    ],
    where,
  );

  // ── INV-9 — deux méthodes différentes ne se comparent pas ──────────────
  if (b.left.state === "OBSERVED" && b.right.state === "OBSERVED") {
    const same = methodSignature(b.left) === methodSignature(b.right);
    if (!same && b.reasonCode !== "METHOD_MISMATCH") {
      throw new MethodMismatchNotFlaggedError(
        where,
        `« ${methodSignature(b.left)} » vs « ${methodSignature(b.right)} », rendu « ${b.reasonCode} »`,
      );
    }
    if (same && b.reasonCode === "METHOD_MISMATCH") {
      throw new MethodMismatchNotFlaggedError(
        where,
        "METHOD_MISMATCH annoncé alors que les deux méthodes sont identiques",
      );
    }
  }
}
