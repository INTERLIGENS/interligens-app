// ─── S0 — DataNature : l'énumération canonique, GELÉE ───────────────────────
//
// ██  CE SET EST RATIFIÉ ET FERMÉ. Toute valeur ajoutée ici est un            ██
// ██  changement de doctrine, pas une évolution technique.                    ██
//
// Le discovery du 2026-08-27 a mesuré sept sites de mélange (M1–M7) dans le
// produit. Ils fautent TOUS dans le même sens : une inférence ou une assertion
// éditoriale prend l'apparence d'une observation. Toute la conception de ce
// module découle de ce constat unique — l'erreur est asymétrique, donc les
// défauts doivent l'être aussi.
//
// ─── Pourquoi UNCLASSIFIED existe, et ce qu'il n'est pas ────────────────────
// UNCLASSIFIED n'est PAS une sixième nature, et ce n'est JAMAIS un défaut
// silencieux. C'est l'aveu explicite qu'une donnée n'a pas été classée. Il est
// transitoire par construction : bloquant à l'écriture (requireNature lève),
// bloquant à la frontière publique (assertPublishable lève).
//
// Sans lui, une donnée non classée hériterait d'un défaut implicite — et un
// défaut implicite est EXACTEMENT le mécanisme des sept sites de mélange.
// Avec lui, l'ignorance est visible et coûteuse. C'est voulu.

export const DATA_NATURES = [
  "PRIMARY_OBSERVATION",
  "THIRD_PARTY_DATA",
  "INFERENCE",
  "ESTIMATE",
  "EDITORIAL_ASSERTION",
] as const;

export type DataNature = (typeof DATA_NATURES)[number];

/** Le transitoire. Séparé du type canonique pour qu'il ne puisse pas être
 *  produit par inadvertance là où un DataNature est attendu. */
export const UNCLASSIFIED = "UNCLASSIFIED" as const;
export type Unclassified = typeof UNCLASSIFIED;

/** Ce qu'une colonne peut porter en base pendant la transition. */
export type NatureValue = DataNature | Unclassified;

export const ALL_NATURE_VALUES = [...DATA_NATURES, UNCLASSIFIED] as const;

// ─── Ordre d'autorité — décroissant ────────────────────────────────────────
// Sert à UNE seule chose : arbitrer quand deux natures conviendraient (règle
// §1.2 de la spec — la MOINS autoritaire l'emporte). Il ne sert JAMAIS à
// classer des données entre elles pour un affichage : deux natures ne sont pas
// comparables en qualité, elles sont comparables en RESPONSABILITÉ.
const AUTHORITY_RANK: Record<DataNature, number> = {
  PRIMARY_OBSERVATION: 5,
  THIRD_PARTY_DATA: 4,
  INFERENCE: 3,
  ESTIMATE: 2,
  EDITORIAL_ASSERTION: 1,
};

export function isDataNature(v: unknown): v is DataNature {
  return typeof v === "string" && (DATA_NATURES as readonly string[]).includes(v);
}

export function isNatureValue(v: unknown): v is NatureValue {
  return isDataNature(v) || v === UNCLASSIFIED;
}

/**
 * Règle d'arbitrage §1.2 : quand plusieurs natures conviennent, la MOINS
 * autoritaire l'emporte. Ce n'est pas de la prudence rhétorique — c'est la
 * seule lecture qui rende le sur-classement impossible par construction.
 */
export function leastAuthoritative(a: DataNature, b: DataNature): DataNature {
  return AUTHORITY_RANK[a] <= AUTHORITY_RANK[b] ? a : b;
}

/**
 * I1 — LA NATURE NE REMONTE JAMAIS L'ÉCHELLE.
 *
 * Une INFERENCE ne devient pas une PRIMARY_OBSERVATION parce qu'on l'a
 * recalculée ; une ESTIMATE ne devient pas une INFERENCE parce qu'on a affiné
 * la méthode. La transition est monotone, dans un seul sens.
 *
 * Exception unique et explicite : UNCLASSIFIED peut devenir n'importe quoi —
 * c'est précisément l'acte de classer.
 */
export function canTransition(from: NatureValue, to: NatureValue): boolean {
  if (from === UNCLASSIFIED) return true;
  if (to === UNCLASSIFIED) return false; // on ne "déclasse" pas vers l'ignorance
  return AUTHORITY_RANK[to] <= AUTHORITY_RANK[from];
}

export class NatureTransitionError extends Error {
  constructor(from: NatureValue, to: NatureValue, where: string) {
    super(
      `[data-nature] transition interdite ${from} → ${to} (${where}) : ` +
        "la nature ne remonte jamais l'échelle d'autorité (I1).",
    );
    this.name = "NatureTransitionError";
  }
}

export function assertTransition(from: NatureValue, to: NatureValue, where: string): void {
  if (!canTransition(from, to)) throw new NatureTransitionError(from, to, where);
}

// ─── Écriture fail-closed ──────────────────────────────────────────────────

export class UnknownNatureError extends Error {
  constructor(where: string, received: unknown) {
    super(
      `[data-nature] nature inconnue en écriture (${where}) : ` +
        `reçu ${JSON.stringify(received)}. ` +
        "S0 impose l'échec — aucun défaut n'est appliqué silencieusement.",
    );
    this.name = "UnknownNatureError";
  }
}

/**
 * Porte d'écriture. Une nature inconnue ou absente FAIT ÉCHOUER L'ÉCRITURE.
 * Il n'y a volontairement aucun paramètre `fallback` : le jour où quelqu'un en
 * voudra un, ce sera la décision à discuter, pas le contournement à coder.
 */
export function requireNature(value: unknown, where: string): DataNature {
  if (!isDataNature(value)) throw new UnknownNatureError(where, value);
  return value;
}

/** Variante d'écriture tolérant le transitoire — réservée aux backfills S3+. */
export function requireNatureValue(value: unknown, where: string): NatureValue {
  if (!isNatureValue(value)) throw new UnknownNatureError(where, value);
  return value;
}

// ─── ESTIMATE : la seule nature à compagnon obligatoire (Q5) ────────────────

export class MissingMethodRefError extends Error {
  constructor(where: string) {
    super(
      `[data-nature] ESTIMATE sans methodRef (${where}) : une estimation sans ` +
        "méthode n'est pas une donnée faible, elle est INFALSIFIABLE — " +
        "ni vérifiable, ni contestable (Q5).",
    );
    this.name = "MissingMethodRefError";
  }
}

/**
 * Référence de méthode VERSIONNABLE et AUDITABLE (doctrine S2/Q5).
 * Forme imposée : `<slug>@<version>`, où slug est un identifiant stable et
 * version un entier ou un semver. « internal », « n/a », « manual » et les
 * autres formules d'évitement sont refusées — une méthode qu'on ne peut pas
 * retrouver n'est pas une méthode.
 */
const METHOD_REF_RE = /^[a-z][a-z0-9-]{2,63}@(?:\d+|\d+\.\d+\.\d+)$/;
const METHOD_REF_BLOCKLIST = new Set([
  "internal", "n/a", "na", "none", "manual", "tbd", "todo", "unknown", "legacy",
]);

export function isValidMethodRef(ref: unknown): ref is string {
  if (typeof ref !== "string") return false;
  const slug = ref.split("@")[0]?.toLowerCase() ?? "";
  if (METHOD_REF_BLOCKLIST.has(slug)) return false;
  return METHOD_REF_RE.test(ref);
}

export function assertEstimateHasMethod(
  nature: NatureValue,
  methodRef: unknown,
  where: string,
): void {
  if (nature !== "ESTIMATE") return;
  if (!isValidMethodRef(methodRef)) throw new MissingMethodRefError(where);
}

// ─── Frontière publique ────────────────────────────────────────────────────

export class UnpublishableNatureError extends Error {
  constructor(where: string) {
    super(
      `[data-nature] sortie publique refusée (${where}) : nature UNCLASSIFIED. ` +
        "Une donnée non classée ne peut rien publier (I3).",
    );
    this.name = "UnpublishableNatureError";
  }
}

export function assertPublishable(nature: NatureValue, where: string): asserts nature is DataNature {
  if (nature === UNCLASSIFIED) throw new UnpublishableNatureError(where);
}

// ─── Confiance : Q2, deux axes ─────────────────────────────────────────────

export class CrossNatureComparisonError extends Error {
  constructor(where: string, natures: string[]) {
    super(
      `[data-nature] comparaison de confiance inter-nature refusée (${where}) : ` +
        `${natures.join(", ")}. La confiance n'est comparable qu'à nature égale (Q2) — ` +
        "un `high` d'OFAC et un `high` d'INTERLIGENS ne mesurent pas la même chose.",
    );
    this.name = "CrossNatureComparisonError";
  }
}

/**
 * Q2 — garde-fou de tri. Refuse un tri/seuil global sur `confidence` dès que
 * l'ensemble mélange plusieurs natures. Le remède n'est pas de désactiver ce
 * contrôle : c'est de trier PAR nature, puis d'ordonner les groupes.
 */
export function assertSingleNatureForConfidence(
  items: ReadonlyArray<{ nature: NatureValue }>,
  where: string,
): void {
  const seen = new Set(items.map((i) => i.nature));
  if (seen.size > 1) throw new CrossNatureComparisonError(where, [...seen].sort());
}
