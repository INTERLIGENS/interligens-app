// ─── BUILD 9 / ÉTAPE 6 — VERSIONNER SANS RÉÉCRIRE ──────────────────────────
//
// ██  Une assertion ne se corrige pas : elle est SUPPLANTÉE.               ██
//
// ─── Ce que l'étape 6 ajoute, et ce qu'elle n'ajoute pas ──────────────────
//
// Les colonnes existent déjà en base (bloc 3) : `version`, `supersedes`,
// `contentHash`, et l'unicité `(casefileRef, claimId, version)`. Ce module ne
// crée rien — il rend le versioning LISIBLE et VÉRIFIABLE côté code, ce qui
// est la seule moitié qui manquait :
//
//   1. le lecteur ne mélange plus les versions — il rend la DERNIÈRE
//   2. une modification en place devient DÉTECTABLE — c'est le sceau
//   3. une référence cassée est distinguée d'une référence qui n'a jamais
//      été une clef de registre
//
// Il n'ajoute AUCUNE condition de publication. Détecter n'est pas décider :
// faire bloquer une publication sur un sceau absent serait un gate de plus,
// et les gates se ratifient, ils ne se déduisent pas.
//
// ─── Ce que le sceau couvre, et ce qu'il ne couvre surtout pas ────────────
//
// Le sceau scelle le CONTENU d'une assertion. Pas les décisions qu'on prend à
// son sujet.
//
//   scellé      claimId, titres, descriptions, catégorie, sévérité, statut,
//               date, acteurs, thread, références de preuve
//   NON scellé  state, exclusionReason, version, supersedes, horodatages
//
// C'est le point : promouvoir un claim de ATTACHED à PUBLIC ne touche pas à ce
// qu'il affirme. Si l'état entrait dans le sceau, toute promotion casserait
// l'empreinte, et un sceau qui casse à chaque décision légitime finit par être
// ignoré — c'est-à-dire par ne plus rien sceller.
//
// ─── `contentHash` NULL n'est pas une altération ──────────────────────────
//
// Les 16 claims migrés au bloc 4 ont été insérés sans sceau. NULL veut dire
// « jamais scellé », pas « modifié ». Confondre les deux transformerait une
// absence en accusation — exactement ce que la doctrine interdit ailleurs.
//
// ─── SPINE-00 · B — UNE SEULE NORMALISATION CANONIQUE ─────────────────────
//
//   « A seal format has one canonical normalization. A renderer, writer or
//     audit tool may consume it; none may redefine it. »
//
// La matière scellée n'est pas la ligne brute : `actors` et `evidenceRefs`
// sont du jsonb qui peut être NULL, `claimDate` une colonne `date`. Entre la
// ligne et l'empreinte il y a donc une NORMALISATION, et c'est elle qui fait
// le format — deux normalisations, c'est deux sceaux qui portent le même nom.
//
// MESURÉ le 2026-09-14 sur les 16 sceaux persistés en production : 16/16
// vérifient sous la forme que `integrityAudit.ts` appliquait (tableaux jamais
// nuls, `null → []`, `claimDate → YYYY-MM-DD`) ; 0/16 sous une forme qui
// laisse `actors` absent. Cette forme est donc LA forme, et elle vit ici,
// une fois : `canonicalSealMaterial`. Elle a été DÉPLACÉE, pas réécrite — les
// 16 sceaux sont la baseline, et c'est elle qui a raison.
//
// `claimContentHash` n'accepte que la matière canonique (type nominal). Il
// n'existe donc aucun chemin qui hache une composition locale : pour produire
// une empreinte, il faut passer par la primitive.
//
// ⚠️ MESURÉ AUSSI : une colonne `date` rendue par Prisma est un `Date` à
// minuit UTC, et `toISOString().slice(0, 10)` rend le jour exact. Un pilote
// qui rendrait minuit LOCAL décalerait le jour d'un cran (8/16 au lieu de
// 16/16 sous UTC+8, ici même). La forme canonique suppose donc le rendu
// Prisma ; un autre lecteur doit fournir `YYYY-MM-DD` en chaîne.

import { createHash } from "node:crypto";

/**
 * Ce qu'une ligne apporte à la matière scellée — TELLE QUE LUE ou telle que
 * saisie. Volontairement large : `actors` et `evidenceRefs` sont le jsonb
 * brut, `claimDate` la colonne `date` ou déjà `YYYY-MM-DD`. La primitive
 * normalise ; l'appelant ne le fait pas.
 */
export interface SealableClaim {
  readonly claimId: string;
  readonly title: string;
  readonly titleFr?: string | null;
  readonly description?: string | null;
  readonly descriptionFr?: string | null;
  readonly category?: string | null;
  readonly severity?: string | null;
  readonly status?: string | null;
  /** `Date` telle que Prisma rend une colonne `date` (minuit UTC), ou `YYYY-MM-DD`. */
  readonly claimDate?: Date | string | null;
  /** jsonb brut : tableau, NULL, ou absent. */
  readonly actors?: unknown;
  readonly threadUrl?: string | null;
  /** jsonb brut : tableau, NULL, ou absent. */
  readonly evidenceRefs?: unknown;
}

declare const MATIERE_CANONIQUE: unique symbol;

/**
 * La matière scellée sous sa forme CANONIQUE. Nominale : la marque ne
 * s'obtient que de `canonicalSealMaterial`. Chaque champ est présent — jamais
 * `undefined` — les textes absents valent `null`, les listes ne sont jamais
 * nulles, la date est `YYYY-MM-DD` ou `null`.
 */
export interface CanonicalSealMaterial {
  readonly [MATIERE_CANONIQUE]: true;
  readonly claimId: string;
  readonly title: string;
  readonly titleFr: string | null;
  readonly description: string | null;
  readonly descriptionFr: string | null;
  readonly category: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly claimDate: string | null;
  readonly actors: readonly string[];
  readonly threadUrl: string | null;
  readonly evidenceRefs: readonly string[];
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const jour = (d: Date | string | null | undefined): string | null =>
  d === null || d === undefined ? null : d instanceof Date ? d.toISOString().slice(0, 10) : d;

/**
 * LA normalisation. Le seul site du dépôt qui compose la matière scellée.
 *
 * Idempotente : la matière canonique est son propre point fixe. Un tableau
 * non textuel ou NULL devient `[]` ; un texte `undefined` devient `null` ;
 * une `Date` devient son jour UTC. Rien d'autre n'est touché — en particulier
 * la chaîne vide reste une chaîne vide, distincte de `null` dans l'empreinte.
 */
export function canonicalSealMaterial(c: SealableClaim): CanonicalSealMaterial {
  return {
    claimId: c.claimId,
    title: c.title,
    titleFr: c.titleFr ?? null,
    description: c.description ?? null,
    descriptionFr: c.descriptionFr ?? null,
    category: c.category ?? null,
    severity: c.severity ?? null,
    status: c.status ?? null,
    claimDate: jour(c.claimDate),
    actors: asStrings(c.actors),
    threadUrl: c.threadUrl ?? null,
    evidenceRefs: asStrings(c.evidenceRefs),
    // La marque nominale n'existe qu'au type : c'est ICI, et nulle part
    // ailleurs dans le dépôt, qu'un objet la reçoit.
  } as unknown as CanonicalSealMaterial;
}

/**
 * Les champs scellés, dans l'ordre. La LISTE fait partie du contrat : ajouter
 * un champ change toutes les empreintes, et doit donc être un acte délibéré.
 */
export const SEALED_FIELDS = [
  "claimId", "title", "titleFr", "description", "descriptionFr",
  "category", "severity", "status", "claimDate", "actors",
  "threadUrl", "evidenceRefs",
] as const;

// Les separateurs sont declares en echappees, jamais poses en octets bruts
// dans le source : un caractere de controle litteral rend le fichier binaire
// pour git, grep et diff — mesure ici meme, le fichier ressortait en `data`.
// Les valeurs, elles, sont inchangees : les empreintes ne bougent pas.
/** Marque une ABSENCE, pour qu'elle ne se confonde pas avec la chaine vide. */
const SEP_ABSENT = "\u0000";
/** Separe les elements d'une liste (unit separator). */
const SEP_LISTE = "\u001f";
/** Separe les champs entre eux (record separator). */
const SEP_CHAMP = "\u001e";

const norm = (v: unknown): string => (v === null || v === undefined ? SEP_ABSENT : String(v));

/**
 * L'empreinte du contenu d'un claim.
 *
 * Sérialisation explicite plutôt que `JSON.stringify` de l'objet : l'ordre des
 * clefs d'un objet JS dépend de la façon dont il a été construit, et une
 * empreinte qui dépend de l'ordre d'insertion ne scelle rien du tout.
 *
 * `SEP_ABSENT` (U+0000) distingue une chaîne vide d'une absence — sans lui, `title: ""` et
 * `title: null` auraient la même empreinte, et remplacer l'un par l'autre
 * passerait inaperçu.
 *
 * Les listes sont TRIÉES : réordonner des références ne change pas ce que le
 * claim affirme, donc ne doit pas casser le sceau.
 *
 * N'accepte que la matière CANONIQUE : la sérialisation ne normalise rien,
 * elle n'a pas à le faire — `canonicalSealMaterial` l'a déjà fait, une fois.
 */
export function claimContentHash(c: CanonicalSealMaterial): string {
  const parts = SEALED_FIELDS.map((f) => {
    const v = (c as unknown as Record<string, unknown>)[f];
    if (Array.isArray(v)) return `${f}=[${[...v].map(String).sort().join(SEP_LISTE)}]`;
    return `${f}=${norm(v)}`;
  });
  return createHash("sha256").update(parts.join(SEP_CHAMP), "utf8").digest("hex");
}

// ─── Sélection de version ─────────────────────────────────────────────────

export interface VersionedRow {
  readonly claimId: string;
  readonly version: number;
}

/**
 * La DERNIÈRE version de chaque claim, et elle seule.
 *
 * Sans ça, un dossier qui porterait C1 v1 et C1 v2 rendrait DEUX claims C1 —
 * dont un périmé — sur la même page. Le lecteur ne mélange pas les versions :
 * c'est la moitié applicative de l'immuabilité. L'autre moitié est en base.
 *
 * Latent aujourd'hui : les 16 claims migrés sont tous en v1. C'est
 * précisément le moment de le fermer — un défaut latent ne se voit pas, et
 * celui-ci se manifesterait le jour de la première correction d'assertion.
 */
export function latestVersions<T extends VersionedRow>(rows: readonly T[]): T[] {
  const parClaim = new Map<string, T>();
  for (const r of rows) {
    const deja = parClaim.get(r.claimId);
    if (!deja || r.version > deja.version) parClaim.set(r.claimId, r);
  }
  return [...parClaim.values()].sort((a, b) => a.claimId.localeCompare(b.claimId));
}

// ─── Références : cassée, ou jamais une clef ? ────────────────────────────

/**
 * Une référence de registre a la FORME d'un identifiant : pas d'espace, pas de
 * ponctuation de phrase. `SRC-001` en est une ; « screenshots TBC » n'en a
 * jamais été une.
 */
const FORME_IDENTIFIANT = /^[A-Za-z][A-Za-z0-9_.-]*$/;

export const REFERENCE_VERDICTS = [
  /** Elle résout dans le registre du dossier. */
  "RESOLVED",
  /** Elle a la forme d'une clef, et ne résout pas. Un lien cassé. */
  "BROKEN",
  /**
   * Elle n'a jamais eu la forme d'une clef — c'est de la prose citée en guise
   * de référence. Ce n'est pas un lien cassé : c'est une référence qui n'a
   * jamais été posée. La qualifier relève de BUILD 10, pas d'ici.
   */
  "UNCLASSIFIED",
] as const;
export type ReferenceVerdict = (typeof REFERENCE_VERDICTS)[number];

export function classifyReference(ref: string, registre: ReadonlySet<string>): ReferenceVerdict {
  if (registre.has(ref)) return "RESOLVED";
  return FORME_IDENTIFIANT.test(ref) ? "BROKEN" : "UNCLASSIFIED";
}

// ─── Constats d'intégrité ─────────────────────────────────────────────────

export const INTEGRITY_FINDINGS = [
  /** Une référence en forme de clef qui ne résout pas. */
  "BROKEN_REFERENCE",
  /** Le contenu ne correspond plus au sceau : modification EN PLACE. */
  "CONTENT_MUTATED",
  /** Aucun sceau posé. Une absence — jamais une accusation. */
  "UNSEALED",
  /** Des versions manquent dans la suite (1, 3 sans 2) : une a été retirée. */
  "VERSION_GAP",
  /** Deux lignes pour la même version. L'unicité en base devrait l'interdire. */
  "DUPLICATE_VERSION",
] as const;
export type IntegrityFindingKind = (typeof INTEGRITY_FINDINGS)[number];

/**
 * Un constat nomme un CLAIM et un CHAMP. Jamais un contenu.
 *
 * Même règle que les avis d'exclusion : un rapport d'intégrité qui cite ce
 * qu'il a trouvé republie ce qu'il signale.
 */
export interface IntegrityFinding {
  readonly kind: IntegrityFindingKind;
  readonly claimId: string;
  readonly version: number;
  /** Le NOM du champ concerné, ou la référence en cause. Jamais une valeur. */
  readonly field: string;
}

export interface AuditableClaim extends SealableClaim, VersionedRow {
  readonly contentHash?: string | null;
}

/**
 * L'audit d'intégrité d'un dossier. Pur : il ne lit ni base ni fichier.
 *
 * Il porte sur TOUTES les versions, pas seulement la dernière — c'est le
 * propre d'un audit d'immuabilité : une version supplantée qui a été modifiée
 * après coup est exactement ce qu'on cherche.
 */
export function auditClaims(
  claims: readonly AuditableClaim[],
  registre: ReadonlySet<string>,
): IntegrityFinding[] {
  const constats: IntegrityFinding[] = [];
  const versionsVues = new Map<string, number[]>();

  for (const c of claims) {
    const vues = versionsVues.get(c.claimId) ?? [];
    if (vues.includes(c.version)) {
      constats.push({ kind: "DUPLICATE_VERSION", claimId: c.claimId, version: c.version, field: "version" });
    }
    vues.push(c.version);
    versionsVues.set(c.claimId, vues);

    // La révision telle que lue passe par la primitive : l'audit compare le
    // sceau à la matière CANONIQUE, jamais à la ligne brute.
    const matiere = canonicalSealMaterial(c);
    if (c.contentHash == null || c.contentHash === "") {
      constats.push({ kind: "UNSEALED", claimId: c.claimId, version: c.version, field: "contentHash" });
    } else if (claimContentHash(matiere) !== c.contentHash) {
      constats.push({ kind: "CONTENT_MUTATED", claimId: c.claimId, version: c.version, field: "contentHash" });
    }

    for (const r of matiere.evidenceRefs) {
      if (classifyReference(r, registre) === "BROKEN") {
        constats.push({ kind: "BROKEN_REFERENCE", claimId: c.claimId, version: c.version, field: r });
      }
    }
  }

  // Les trous de version se constatent une fois la suite complète connue.
  for (const [claimId, vues] of versionsVues) {
    const triees = [...new Set(vues)].sort((a, b) => a - b);
    for (let v = 1; v <= triees[triees.length - 1]; v++) {
      if (!triees.includes(v)) {
        constats.push({ kind: "VERSION_GAP", claimId, version: v, field: "version" });
      }
    }
  }

  return constats;
}

/** Un décompte par type, pour un rapport qui ne republie rien. */
export function summarizeFindings(
  constats: readonly IntegrityFinding[],
): Record<IntegrityFindingKind, number> {
  const out = Object.fromEntries(INTEGRITY_FINDINGS.map((k) => [k, 0])) as Record<
    IntegrityFindingKind,
    number
  >;
  for (const c of constats) out[c.kind] += 1;
  return out;
}
