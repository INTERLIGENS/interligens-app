// ─── T1-BASCULE-DU-CONTRAT — LE JOURNAL EST L'AUTORITÉ, ET IL EST SEUL ─────
//
// ██  Une autorité nouvelle ne devient pas opérante parce que son schéma    ██
// ██  existe. Elle le devient quand un témoin gouverné POSITIF prouve le    ██
// ██  chemin qu'elle est censée gouverner.                                  ██
//
// Ruling GPT du 2026-09-15 :
//   « A new authority is not made operational merely because its schema
//     exists. It becomes authoritative only after a positive governed witness
//     proves the path it is meant to govern. »
//
// PHASE B (2026-09-15, plus tôt le même jour) : ce module SAVAIT lire, et
// personne ne le lui demandait. Le témoin exigé par le ruling existe désormais
// — deux lignes réelles, gouvernées, en production (journal #3 et #4, VINE,
// OPERATOR_DECLARED / QUERY_CONTEXT). La PHASE C est donc franchie ICI : les
// trois consommateurs de décision (`decideFoundation`, `decidePublicRelease`,
// la projection publique) résolvent la provenance PAR CE MODULE.
//
// ─── ET LE REGISTRE EN DUR A DISPARU ──────────────────────────────────────
//
// `provenanceKind.readProvenanceKind` portait deux entrées codées en dur
// (les sha256 de SRC-0xS-09 et SRC-0xS-18). La base porte maintenant la MÊME
// information, gouvernée et append-only. Laisser le registre en place aurait
// créé une SECONDE AUTORITÉ sur le même fait — exactement ce contre quoi toute
// la semaine a été écrite. Il est supprimé, pas déprécié : `provenanceKind.ts`
// ne porte plus que le VOCABULAIRE fermé. Deux témoins le prouvent
// (__tests__/casefile/t1-bascule-du-contrat.test.ts) : aucune provenance codée
// en dur ne subsiste dans `src/` ni `scripts/`, et ce module est le SEUL
// chemin de résolution.
//
// ─── LE CHEMIN DE RÉSOLUTION, IMPOSÉ ──────────────────────────────────────
//
//     CaseFileSource.snapshotId → EvidenceSnapshot.id → evidence_provenance_journal
//
//   snapshotId absent                → UNKNOWN dérivé (NO_SNAPSHOT_LINK)
//   snapshotId présent, 0 ligne      → UNKNOWN dérivé (NO_JOURNAL_ENTRY)
//   snapshotId présent, n lignes     → la DERNIÈRE qualification gouvernée,
//                                      c'est-à-dire max(id) — jamais la première,
//                                      jamais l'ordre du tableau reçu.
//
// ─── ⛔ AUCUN REPLI PAR SHA-256. NOMMÉMENT INTERDIT ────────────────────────
//
//   « A byte digest may corroborate identity; it must not elect observation
//     identity. »
//   « Même si le fallback fonctionnerait aujourd'hui pour VINE, je l'interdis.
//     Une optimisation opportuniste sur deux cas ne doit pas devenir une règle
//     d'identité globale. »
//
// `sha256` est présent dans `JournalProvenanceRef` — et n'est JAMAIS lu par la
// résolution. Il y figure pour que l'interdit ait un LIEU : le mutant qui
// ajoute le repli tient en une ligne, et le témoin (f) rougit dessus. Le
// retirer du type rendrait la faute inexprimable, donc la garde invérifiable.
//
// ─── ⛔ UNKNOWN N'EST PAS UNE VALEUR STOCKÉE ───────────────────────────────
//
// Le domaine du journal est OPERATOR_DECLARED | EXTRACTED | VERIFIED — décision
// GPT 4a du 2026-09-14, portée par le CHECK
// `evidence_provenance_journal_provenance_kind_check`. UNKNOWN est UNIQUEMENT
// une valeur DÉRIVÉE de l'absence. Une ligne dont `provenanceKind` sort du
// domaine (un 'UNKNOWN' stocké, une casse approchante, une valeur inconnue) ne
// rend donc PAS cette valeur : elle rend UNKNOWN dérivé, cause
// ROW_OUT_OF_DOMAIN. Aucun chemin de ce module ne peut rendre une
// qualification qui vienne de la base sans appartenir au domaine fermé.
//
// ─── LECTURE SEULE ────────────────────────────────────────────────────────
//
// Ce module ne porte AUCUN INSERT, AUCUN UPDATE, AUCUN DELETE. Le journal est
// append-only par trigger en base ; ici il est simplement LU. L'écriture
// gouvernée du journal est une autre fenêtre.

import type { SourceProvenanceKind } from "./provenanceKind";

/**
 * Le domaine FERMÉ de la colonne `provenance_kind`. UNKNOWN n'en fait pas partie.
 *
 * MACHINE_MEASURED depuis le 2026-09-16 (CC-OFFLINE-230) : le CHECK en base porte
 * désormais quatre valeurs, et ce domaine le MIROITE. Le laisser à trois ferait
 * rendre ROW_OUT_OF_DOMAIN à une ligne parfaitement légitime — c'est-à-dire que
 * l'instrument déclarerait anormale sa propre mesure.
 */
export const JOURNAL_PROVENANCE_KINDS = [
  "OPERATOR_DECLARED",
  "EXTRACTED",
  "VERIFIED",
  "MACHINE_MEASURED",
] as const;
export type JournalProvenanceKind = (typeof JOURNAL_PROVENANCE_KINDS)[number];

/** Le domaine FERMÉ de la colonne `reference_kind`. */
export const JOURNAL_REFERENCE_KINDS = ["QUERY_CONTEXT", "PUBLICATION", "PROFILE", "DOCUMENT", "OTHER"] as const;
export type JournalReferenceKind = (typeof JOURNAL_REFERENCE_KINDS)[number];

/** Le domaine FERMÉ de la colonne `verification_method`. */
export const JOURNAL_VERIFICATION_METHODS = [
  "URL_MATCHES_CAPTURED_POST",
  "ARCHIVE_SNAPSHOT_MATCHES",
  "PLATFORM_API_RECORD_MATCHES",
] as const;
export type JournalVerificationMethod = (typeof JOURNAL_VERIFICATION_METHODS)[number];

/**
 * POURQUOI la provenance est inconnue. Un UNKNOWN sans cause serait
 * indiscernable d'un UNKNOWN par négligence : chaque absence dit laquelle
 * elle est.
 */
export const DERIVED_UNKNOWN_CAUSES = [
  /** La pièce ne porte pas de `snapshotId` : aucun pont vers une observation gouvernée. */
  "NO_SNAPSHOT_LINK",
  /** Le pont existe, et le journal ne porte aucune ligne pour cette pièce. */
  "NO_JOURNAL_ENTRY",
  /**
   * Une ligne existe et n'est pas exploitable : `provenanceKind` hors du
   * domaine fermé (un 'UNKNOWN' stocké tomberait ICI), ou un `id` non
   * ordonnable — « le dernier état connu » cesserait d'être non ambigu.
   */
  "ROW_OUT_OF_DOMAIN",
] as const;
export type DerivedUnknownCause = (typeof DERIVED_UNKNOWN_CAUSES)[number];

/**
 * Ce qu'il faut pour désigner une pièce DANS CE LECTEUR : le pont vers
 * l'observation gouvernée, et lui seul.
 *
 * `sha256` est déclaré et JAMAIS lu — voir l'en-tête. Sa présence est le lieu
 * de l'interdit, pas une entrée de la résolution.
 */
export interface JournalProvenanceRef {
  readonly sourceId: string;
  readonly snapshotId: string | null;
  readonly sha256?: string | null;
}

/** Une ligne du journal, TELLE QUE LUE. Colonnes énumérées, jamais `*`. */
export interface JournalRow {
  /** BIGINT : il peut dépasser `Number.MAX_SAFE_INTEGER`. Comparé en `BigInt`. */
  readonly id: string | number | bigint;
  readonly evidenceSnapshotId: string;
  readonly provenanceKind: string;
  readonly referenceKind: string;
  readonly sourceUrl: string;
  readonly sha256: string | null;
  readonly declaredBy: string;
  readonly declaredAt: Date | string;
  readonly verifiedBy: string | null;
  readonly verifiedAt: Date | string | null;
  readonly verificationMethod: string | null;
}

/** Une qualification EFFECTIVEMENT apportée, lue au journal. */
export interface QualifiedProvenance {
  readonly kind: JournalProvenanceKind;
  /** `false` : cette qualification vient d'une ligne, pas d'une absence. */
  readonly derived: false;
  /** L'`id` de la ligne qui fait foi. Rendu en texte : c'est un BIGINT. */
  readonly journalId: string;
  readonly referenceKind: JournalReferenceKind;
  /**
   * `source_url` est sémantiquement un SOURCE LOCATOR (ruling T1-DDL-PHASE-A) :
   * URL HTTP(S), objet `r2://…` ou URI selon `referenceKind`. Le nom de la
   * colonne n'est pas renommé avant le RC ; le lecteur, lui, le NOMME.
   */
  readonly sourceLocator: string;
  /** Non nul SI ET SEULEMENT SI `kind === "VERIFIED"` — CHECK en base, reconstruit ici. */
  readonly verification: {
    readonly by: string;
    readonly at: Date | string;
    readonly method: JournalVerificationMethod;
  } | null;
}

/** L'ABSENCE de qualification, et sa cause. UNKNOWN n'existe QUE sous cette forme. */
export interface UnknownProvenance {
  readonly kind: "UNKNOWN";
  /** `true` : UNKNOWN est TOUJOURS dérivé. Aucune ligne ne le porte. */
  readonly derived: true;
  readonly cause: DerivedUnknownCause;
  /** La ligne mise en cause, quand il y en a une (ROW_OUT_OF_DOMAIN). */
  readonly journalId: string | null;
}

export type JournalProvenance = QualifiedProvenance | UnknownProvenance;

const estKind = (v: unknown): v is JournalProvenanceKind =>
  typeof v === "string" && (JOURNAL_PROVENANCE_KINDS as readonly string[]).includes(v);
const estReferenceKind = (v: unknown): v is JournalReferenceKind =>
  typeof v === "string" && (JOURNAL_REFERENCE_KINDS as readonly string[]).includes(v);
const estMethode = (v: unknown): v is JournalVerificationMethod =>
  typeof v === "string" && (JOURNAL_VERIFICATION_METHODS as readonly string[]).includes(v);

const inconnue = (cause: DerivedUnknownCause, journalId: string | null = null): UnknownProvenance =>
  ({ kind: "UNKNOWN", derived: true, cause, journalId });

/**
 * L'`id` d'une ligne, en `BigInt`, ou `null` s'il n'est pas ordonnable.
 *
 * `BigInt` et non `Number` : la colonne est un BIGINT IDENTITY. Au-delà de
 * 2^53 deux ids distincts deviendraient égaux en flottant, et « le dernier
 * état connu » cesserait d'être non ambigu — exactement ce que la colonne
 * IDENTITY garantit en base.
 */
function ordre(id: unknown): bigint | null {
  try {
    if (typeof id === "bigint") return id;
    if (typeof id === "number") return Number.isSafeInteger(id) ? BigInt(id) : null;
    if (typeof id === "string" && /^-?\d+$/.test(id)) return BigInt(id);
    return null;
  } catch {
    return null;
  }
}

/**
 * LA RÉSOLUTION. Pure, synchrone, déterministe.
 *
 * Elle ne consulte NI `EvidenceSnapshot."sourceUrl"`, NI
 * `CaseFileSource."sourceUrl"`, NI aucun sha256 : depuis la décision GPT 5 du
 * 2026-09-14 ces colonnes ne sont plus une preuve autonome de provenance, et
 * les combler par inférence est exactement ce que le ruling refuse.
 *
 * L'ordre du tableau reçu n'est JAMAIS présumé : la dernière qualification est
 * `max(id)`, calculée ici. La requête SQL trie de la même façon — deux gardes
 * valent mieux qu'un contrat implicite entre un appelant et son appelé.
 */
export function resolveJournalProvenance(
  ref: JournalProvenanceRef,
  rows: readonly JournalRow[],
): JournalProvenance {
  if (typeof ref !== "object" || ref === null) return inconnue("NO_SNAPSHOT_LINK");

  // ── 1 · le pont. Absent, vide, ou d'un type inattendu : on s'arrête AVANT
  // de regarder la moindre ligne. Un lecteur qui fouille le journal sans clef
  // finit toujours par trouver quelque chose à recoller.
  const snapshotId = ref.snapshotId;
  if (typeof snapshotId !== "string" || snapshotId === "") return inconnue("NO_SNAPSHOT_LINK");

  // ── 2 · les lignes de CETTE pièce. L'égalité est stricte : une ligne d'une
  // AUTRE pièce ne fuit pas ici, quel que soit son sha256.
  const candidates = Array.isArray(rows)
    ? rows.filter((r) => typeof r === "object" && r !== null && r.evidenceSnapshotId === snapshotId)
    : [];
  if (candidates.length === 0) return inconnue("NO_JOURNAL_ENTRY");

  // ── 3 · le DERNIER état connu = max(id). Un id non ordonnable rend l'ordre
  // ambigu : on ne devine pas, on rend UNKNOWN.
  let derniere: JournalRow | null = null;
  let max: bigint | null = null;
  for (const r of candidates) {
    const o = ordre(r.id);
    if (o === null) return inconnue("ROW_OUT_OF_DOMAIN", typeof r.id === "string" ? r.id : null);
    if (max === null || o > max) { max = o; derniere = r; }
  }
  if (derniere === null || max === null) return inconnue("NO_JOURNAL_ENTRY");
  const journalId = max.toString();

  // ── 4 · le DOMAINE. Un 'UNKNOWN' stocké tombe ICI, et n'en ressort pas :
  // UNKNOWN reste une valeur dérivée de l'absence, jamais une valeur lue.
  const kind = derniere.provenanceKind;
  if (!estKind(kind)) return inconnue("ROW_OUT_OF_DOMAIN", journalId);
  if (!estReferenceKind(derniere.referenceKind)) return inconnue("ROW_OUT_OF_DOMAIN", journalId);
  if (typeof derniere.sourceUrl !== "string" || derniere.sourceUrl === "") {
    return inconnue("ROW_OUT_OF_DOMAIN", journalId);
  }

  // ── 5 · VERIFIED ⇔ (qui, quand, comment). Le CHECK le garantit en base ; on
  // le RECONSTRUIT ici plutôt que de le supposer — une ligne posée hors du
  // DDL ne se ferait pas passer pour vérifiée.
  let verification: QualifiedProvenance["verification"] = null;
  if (kind === "VERIFIED") {
    const by = derniere.verifiedBy;
    const at = derniere.verifiedAt;
    const method = derniere.verificationMethod;
    if (typeof by !== "string" || by === "" || at === null || at === undefined || !estMethode(method)) {
      return inconnue("ROW_OUT_OF_DOMAIN", journalId);
    }
    verification = { by, at, method };
  } else if (derniere.verifiedBy !== null || derniere.verifiedAt !== null || derniere.verificationMethod !== null) {
    // L'autre sens du SI ET SEULEMENT SI : une qualification non vérifiée qui
    // porterait une vérification serait une ligne incohérente, pas une
    // qualification faible.
    return inconnue("ROW_OUT_OF_DOMAIN", journalId);
  }

  return {
    kind,
    derived: false,
    journalId,
    referenceKind: derniere.referenceKind,
    sourceLocator: derniere.sourceUrl,
    verification,
  };
}

// ═══ LA DÉCORATION — LE SEUL PONT VERS L'ÉLIGIBILITÉ ═══════════════════════
//
// ██  resolve → résultat typé → eligibility → cause précise → refusal      ██
// ██  et JAMAIS : resolve → écraser en UNKNOWN → deviner pourquoi          ██
//
// Une pièce que l'éligibilité juge porte DEUX champs, et ils sortent d'ICI,
// ensemble, d'un seul appel :
//
//   provenanceKind   la qualification, ou UNKNOWN si elle est dérivée
//   provenanceCause  POURQUOI elle est dérivée — `null` quand elle ne l'est pas
//
// Les poser séparément permettrait de les faire diverger (un `VERIFIED` à
// côté d'un `NO_SNAPSHOT_LINK`). Un témoin structurel exige donc que TOUT site
// de `src/` qui pose `provenanceKind:` passe par cette fonction.
//
// ⛔ `provenanceCause` est un DIAGNOSTIC DE CONTRAT. Il ne descend JAMAIS dans
// `casefile_claim_publication_decisions.cause`, dont le vocabulaire reste
// `INSUFFICIENT_SOURCE_PROVENANCE` et le restera : « Ne transformez pas la
// table de décisions en journal diagnostique. » (GPT, 2026-09-15.)

/** Ce qu'une pièce porte pour être JUGÉE. Les deux champs, toujours ensemble. */
export interface ProvenanceDecoration {
  readonly provenanceKind: SourceProvenanceKind;
  /** La cause de l'UNKNOWN dérivé. `null` ⇔ `provenanceKind !== "UNKNOWN"`. */
  readonly provenanceCause: DerivedUnknownCause | null;
}

/**
 * Aplatit une résolution en décoration, SANS rien perdre.
 *
 * `UnknownProvenance` garde sa cause : c'est la seule chose qui distingue
 * « aucun pont » (NO_SNAPSHOT_LINK), « pont sans ligne » (NO_JOURNAL_ENTRY) et
 * « ligne inexploitable » (ROW_OUT_OF_DOMAIN) — et la troisième ne doit
 * SURTOUT PAS se dégrader en simple absence : elle signale une ligne du
 * journal hors domaine, c'est-à-dire une anomalie de la base, pas un trou de
 * couverture.
 */
export function provenanceDecoration(p: JournalProvenance): ProvenanceDecoration {
  if (p.derived) return { provenanceKind: "UNKNOWN", provenanceCause: p.cause };
  return { provenanceKind: p.kind, provenanceCause: null };
}

// ═══ LA LECTURE EN BASE — SELECT, ET RIEN D'AUTRE ═══════════════════════════

/** Le minimum pour interroger : la même forme que `governedExecutor.SqlRunner`. */
export interface JournalSqlRunner {
  query<T extends Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

/**
 * Les DERNIÈRES lignes du journal pour un lot de pièces, une pièce par ligne.
 *
 * `DISTINCT ON` plutôt qu'un `LATERAL` par pièce : une seule passe sur
 * `evidence_provenance_journal_snapshot_idx (evidence_snapshot_id, id DESC)`.
 * Le tri est le MÊME que celui de `resolveJournalProvenance` — la résolution
 * ne s'y fie pas pour autant.
 *
 * ⛔ Cette requête est un SELECT. Ce module n'écrit RIEN dans le journal :
 * l'écriture gouvernée est une autre fenêtre, et la table est append-only par
 * trigger de toute façon.
 */
export async function readLatestJournalRows(
  db: JournalSqlRunner,
  snapshotIds: readonly string[],
): Promise<JournalRow[]> {
  const clefs = [...new Set(snapshotIds.filter((s): s is string => typeof s === "string" && s !== ""))];
  if (clefs.length === 0) return [];
  const rows = await db.query<Record<string, unknown>>(
    `SELECT DISTINCT ON (evidence_snapshot_id)
            id::text          AS "id",
            evidence_snapshot_id AS "evidenceSnapshotId",
            provenance_kind   AS "provenanceKind",
            reference_kind    AS "referenceKind",
            source_url        AS "sourceUrl",
            sha256            AS "sha256",
            declared_by       AS "declaredBy",
            declared_at       AS "declaredAt",
            verified_by       AS "verifiedBy",
            verified_at       AS "verifiedAt",
            verification_method AS "verificationMethod"
       FROM evidence_provenance_journal
      WHERE evidence_snapshot_id = ANY($1)
      ORDER BY evidence_snapshot_id, id DESC`,
    [clefs],
  );
  return rows as unknown as JournalRow[];
}

/**
 * Le lecteur complet : le pont, puis le journal, puis la résolution.
 *
 * Rend une entrée par `sourceId` reçu — y compris pour les pièces sans pont,
 * qui n'ont pas déclenché de requête : leur UNKNOWN est dérivé du `null`, pas
 * d'un silence de la base.
 */
export async function readJournalProvenance(
  db: JournalSqlRunner,
  refs: readonly JournalProvenanceRef[],
): Promise<Map<string, JournalProvenance>> {
  const ponts = refs
    .map((r) => r?.snapshotId)
    .filter((s): s is string => typeof s === "string" && s !== "");
  const rows = await readLatestJournalRows(db, ponts);
  return new Map(refs.map((r) => [r.sourceId, resolveJournalProvenance(r, rows)]));
}
