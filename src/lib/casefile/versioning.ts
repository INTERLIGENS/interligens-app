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

import { createHash } from "node:crypto";

/** Ce qu'il faut d'un claim pour le sceller. Volontairement structurel. */
export interface SealableClaim {
  readonly claimId: string;
  readonly title: string;
  readonly titleFr?: string | null;
  readonly description?: string | null;
  readonly descriptionFr?: string | null;
  readonly category?: string | null;
  readonly severity?: string | null;
  readonly status?: string | null;
  readonly claimDate?: string | null;
  readonly actors?: readonly string[] | null;
  readonly threadUrl?: string | null;
  readonly evidenceRefs?: readonly string[] | null;
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
 */
export function claimContentHash(c: SealableClaim): string {
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

    if (c.contentHash == null || c.contentHash === "") {
      constats.push({ kind: "UNSEALED", claimId: c.claimId, version: c.version, field: "contentHash" });
    } else if (claimContentHash(c) !== c.contentHash) {
      constats.push({ kind: "CONTENT_MUTATED", claimId: c.claimId, version: c.version, field: "contentHash" });
    }

    for (const r of c.evidenceRefs ?? []) {
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
