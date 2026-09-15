// ─── T1-INSCRIPTION-QUALIFICATIONS-VINE — L'ÉCRIVAIN DU JOURNAL DE PROVENANCE ──
//
// ██  Un journal append-only doit pouvoir enregistrer les vérités             ██
// ██  IMPARFAITES, sinon il devient seulement un registre des preuves         ██
// ██  parfaites.                                                              ██
//
// Ruling GPT du 2026-09-15 :
//   « Append-only provenance may record an honestly incomplete qualification;
//     recording OPERATOR_DECLARED does not elevate it to VERIFIED. »
//
// Ce module est le SEUL chemin d'écriture du journal de provenance dans `src/`.
// Le vertical slice écrira par ici, pas à côté : c'est pourquoi il vit dans
// `src/lib/casefile/` et non dans un script de fenêtre.
//
// ─── CE QU'IL NE PEUT PAS FAIRE, PAR CONSTRUCTION ─────────────────────────
//
//   · AUCUN UPDATE. AUCUN DELETE. AUCUN TRUNCATE. Pas « aucun n'est appelé » :
//     aucun n'est ÉCRIT. Une requalification est une NOUVELLE ligne — la ligne
//     VERIFIED de demain n'est pas une mutation de l'OPERATOR_DECLARED
//     d'aujourd'hui, c'est sa suite. Un témoin structurel lit ce fichier et
//     rougit si un verbe de mutation y apparaît :
//     __tests__/casefile/t1-ecrivain-journal.test.ts.
//   · AUCUN `now()` sur `declared_at`. La colonne est SANS DEFAULT par
//     conception (DDL T2-PROVENANCE-JOURNAL) : une déclaration que personne
//     n'a datée n'est pas une déclaration. L'instant vient de l'APPELANT, est
//     posé en paramètre `$n`, et la relecture EXIGE l'égalité. Le mutant qui
//     remplace ce paramètre par `now()` rougit deux fois : sur le témoin
//     structurel, et sur la relecture.
//
// ─── LE TYPE EST LA RÈGLE, LE CHECK EST LE FILET ──────────────────────────
//
// `QualificationIntent` est une UNION DISCRIMINÉE sur `provenanceKind` :
//
//   OPERATOR_DECLARED | EXTRACTED  →  la variante NE DÉCLARE PAS de champ de
//                                     vérification. On ne peut pas en fournir.
//   VERIFIED                       →  la variante EXIGE `verification`
//                                     (by, at, method), et son `referenceKind`
//                                     EXCLUT QUERY_CONTEXT (décision 4b).
//
// Écrire VERIFIED sans les trois champs ne compile donc pas. Le CHECK SQL
// `verified_iff_verification` et `verified_not_query_context` disent la même
// chose en base — ils restent le FILET pour ce qui n'est pas passé par ici
// (psql, un import, une erreur), jamais la règle de ce module. Et parce qu'un
// appelant JavaScript peut mentir au compilateur, les mêmes invariants sont
// REVALIDÉS à l'exécution, avec une cause NOMMÉE, AVANT d'atteindre la base.
//
// ─── CE QU'IL N'AFFIRME PAS ───────────────────────────────────────────────
//
// Inscrire une qualification ne corrige RIEN. `CaseFileSource."sourceUrl"` et
// `"EvidenceSnapshot"."sourceUrl"` ne sont pas touchés, pas relus, pas
// comparés : depuis la décision GPT 5 du 2026-09-14 ils ne sont plus une
// preuve autonome de provenance. Le localisateur inscrit ici est la valeur
// CANONIQUE que le déclarant assume, et elle n'est pas rétroactive.

import type {
  JournalProvenanceKind,
  JournalReferenceKind,
  JournalVerificationMethod,
  JournalSqlRunner,
} from "./journalProvenance";
import {
  JOURNAL_PROVENANCE_KINDS,
  JOURNAL_REFERENCE_KINDS,
  JOURNAL_VERIFICATION_METHODS,
} from "./journalProvenance";

// ═══ LA CONNEXION ═══════════════════════════════════════════════════════════

/**
 * Ouvre une transaction, VALIDE si `fn` rend, ANNULE si `fn` lève. Même forme
 * que `governedExecutor.SqlTransactor` — l'adaptateur de production
 * (`governedExecutorPrisma.prismaTransactor`) satisfait les deux.
 */
export interface JournalSqlTransactor {
  transaction<T>(fn: (db: JournalSqlRunner) => Promise<T>): Promise<T>;
}

// ═══ L'INTENTION — UNE UNION DISCRIMINÉE, PAS UN SAC DE CHAÎNES ═════════════

/** Ce que toute qualification porte, quelle que soit sa force. */
interface QualificationCommune {
  /** L'identité GOUVERNÉE de la pièce : `"EvidenceSnapshot".id`. Jamais un sha256. */
  readonly evidenceSnapshotId: string;
  /**
   * Le SOURCE LOCATOR, sous sa forme CANONIQUE. Sa forme admise dépend de
   * `referenceKind` (CHECK `source_url_form_by_kind`) : URL HTTP(S) pour
   * PUBLICATION · PROFILE · QUERY_CONTEXT, `r2://bucket/clé` pour DOCUMENT,
   * URI à schéma pour OTHER. Aucun blanc, jamais.
   */
  readonly sourceLocator: string;
  /** Ce qu'on sait des OCTETS de la pièce. Attribut, JAMAIS clé. `null` = non établi. */
  readonly sha256: string | null;
  /** QUI affirme. Un acte signé. */
  readonly declaredBy: string;
  /**
   * QUAND la qualification est déclarée. Fourni par l'appelant, JAMAIS par
   * l'horloge du serveur : la colonne est sans DEFAULT à dessein. C'est
   * `recorded_at` (DEFAULT now()) qui porte l'horloge de la base.
   */
  readonly declaredAt: Date | string;
}

/**
 * Une qualification HONNÊTEMENT INCOMPLÈTE. La variante ne DÉCLARE aucun champ
 * de vérification : on ne peut pas en glisser un.
 */
export interface QualificationDeclaree extends QualificationCommune {
  readonly provenanceKind: Extract<JournalProvenanceKind, "OPERATOR_DECLARED" | "EXTRACTED">;
  readonly referenceKind: JournalReferenceKind;
}

/**
 * Une qualification VÉRIFIÉE. Les trois champs sont OBLIGATOIRES, et
 * QUERY_CONTEXT est exclu du type : « un contexte de découverte peut être
 * documenté, il ne peut pas être la référence de provenance individuelle
 * vérifiée d'un post » (décision 4b).
 */
export interface QualificationVerifiee extends QualificationCommune {
  readonly provenanceKind: Extract<JournalProvenanceKind, "VERIFIED">;
  readonly referenceKind: Exclude<JournalReferenceKind, "QUERY_CONTEXT">;
  readonly verification: {
    readonly by: string;
    readonly at: Date | string;
    readonly method: JournalVerificationMethod;
  };
}

export type QualificationIntent = QualificationDeclaree | QualificationVerifiee;

// ═══ LES CAUSES — NOMMÉES, FERMÉES ══════════════════════════════════════════

/**
 * Ce qui fait REFUSER une intention AVANT toute requête. Un refus n'est jamais
 * « la base n'a pas voulu » : la cause dit laquelle des règles a parlé.
 */
export const QUALIFICATION_REFUSAL_CAUSES = [
  /** L'intention n'est pas un objet, ou `provenanceKind` est hors domaine. */
  "MALFORMED_INTENT",
  /** `evidenceSnapshotId` absent ou vide : rien à qualifier. */
  "MISSING_EVIDENCE_TARGET",
  /** `referenceKind` hors domaine fermé. */
  "UNKNOWN_REFERENCE_KIND",
  /** Localisateur vide, avec un blanc, ou dont la forme ne suit pas `referenceKind`. */
  "MALFORMED_LOCATOR",
  /** `sha256` fourni sans être 64 hexadécimaux minuscules. `null` est licite. */
  "MALFORMED_SHA256",
  /** `declaredBy` vide ou bordé de blancs : un acte doit être signé. */
  "MALFORMED_DECLARANT",
  /** `declaredAt` absent ou non convertible en instant. */
  "MALFORMED_DECLARED_AT",
  /** VERIFIED sans les trois champs de vérification, ou l'un d'eux malformé. */
  "VERIFICATION_REQUIRED",
  /** Une qualification non vérifiée porte des champs de vérification. */
  "VERIFICATION_NOT_ALLOWED",
  /** VERIFIED sur un QUERY_CONTEXT : décision 4b, refusée par le type ET ici. */
  "VERIFIED_QUERY_CONTEXT_FORBIDDEN",
] as const;
export type QualificationRefusalCause = (typeof QUALIFICATION_REFUSAL_CAUSES)[number];

/** Ce qui fait ÉCHOUER une écriture qui avait passé toutes les règles. */
export const QUALIFICATION_ABORT_CAUSES = [
  /** L'INSERT n'a pas rendu d'id : rien n'a été inscrit, et on ne le suppose pas. */
  "INSERT_NOT_RECORDED",
  /** La relecture ne retrouve pas la ligne qui vient d'être inscrite. */
  "READBACK_MISSING",
  /**
   * La ligne relue diverge de ce qui a été demandé — un DEFAULT surprise, un
   * trigger, une troncature. Le mutant `declared_at = now()` tombe ICI.
   */
  "READBACK_MISMATCH",
] as const;
export type QualificationAbortCause = (typeof QUALIFICATION_ABORT_CAUSES)[number];

export interface QualificationRefusal<C extends string> {
  readonly cause: C;
  /** OÙ : le champ ou la colonne mise en cause. Un refus sans lieu ne se corrige pas. */
  readonly at: string;
}

/** La ligne inscrite, RELUE. Les valeurs rendues viennent de la base, pas de l'intention. */
export interface QualificationInscrite {
  readonly journalId: string;
  readonly evidenceSnapshotId: string;
  readonly provenanceKind: JournalProvenanceKind;
  readonly referenceKind: JournalReferenceKind;
  readonly sourceLocator: string;
  readonly sha256: string | null;
  readonly declaredBy: string;
  /** ISO-8601 UTC, tel que relu. */
  readonly declaredAt: string;
  readonly verifiedBy: string | null;
  readonly verifiedAt: string | null;
  readonly verificationMethod: JournalVerificationMethod | null;
  /** L'horloge de la BASE. La seule qui ordonne. */
  readonly recordedAt: string;
}

export type QualificationOutcome =
  | { readonly outcome: "RECORDED"; readonly row: QualificationInscrite }
  | { readonly outcome: "REFUSED"; readonly refusal: QualificationRefusal<QualificationRefusalCause> }
  | { readonly outcome: "ABORTED"; readonly refusal: QualificationRefusal<QualificationAbortCause> };

/** Levée DANS la transaction : le transactor annule, l'appelant reçoit la cause. */
export class QualificationAbort extends Error {
  constructor(readonly cause: QualificationAbortCause, readonly at: string) {
    super(`[casefile/journalWriter] ABORT ${cause} @ ${at}`);
    this.name = "QualificationAbort";
  }
}

// ═══ LES FORMES ADMISES — LE MÊME DOMAINE QUE LE CHECK SQL ══════════════════
//
// Ces motifs sont la TRANSCRIPTION du CHECK
// `evidence_provenance_journal_source_url_form_by_kind_check`. Ils sont ici
// pour NOMMER le refus avant la base, pas pour la remplacer : si les deux
// divergent un jour, c'est la base qui a raison, et le refus 23514 remonte tel
// quel. Un témoin rejoue les deux sur le même corpus.
//
// ⚠ `[^/[:space:]]` de Postgres devient `[^/\s]` ici ; `[:space:]` couvre les
// mêmes blancs que `\s` pour les caractères ASCII que ces localisateurs
// portent. L'égalité stricte des deux moteurs n'est pas présumée : elle est
// MESURÉE par le témoin, corpus par corpus.

const URL_HTTP = /^https?:\/\/[^/\s]+\.[^/\s]+(\/\S*)?$/;
const OBJET_R2 = /^r2:\/\/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\/\S+$/;
const URI_SCHEME = /^[a-z][a-z0-9+.-]*:\S+$/;

/** La forme du localisateur exigée par la NATURE de la référence. */
export function formeLocalisateurAdmise(referenceKind: JournalReferenceKind, locator: string): boolean {
  if (typeof locator !== "string" || locator === "" || locator.trim() !== locator) return false;
  switch (referenceKind) {
    case "PUBLICATION":
    case "PROFILE":
    case "QUERY_CONTEXT":
      return URL_HTTP.test(locator);
    case "DOCUMENT":
      return OBJET_R2.test(locator);
    case "OTHER":
      return URI_SCHEME.test(locator);
    default:
      return false;
  }
}

// ═══ LA VALIDATION — AVANT LA BASE, AVEC UNE CAUSE ══════════════════════════

const estChaineNonBordee = (v: unknown): v is string =>
  typeof v === "string" && v !== "" && v.trim() === v;

/** Un instant, en ISO-8601 UTC. `null` si la valeur n'en est pas un. */
function instant(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "string" && v.trim() !== "") {
    const t = new Date(v);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  return null;
}

/** Ce que l'INSERT recevra : chaque colonne, déjà normalisée. */
interface Parametres {
  readonly evidenceSnapshotId: string;
  readonly sha256: string | null;
  readonly provenanceKind: JournalProvenanceKind;
  readonly referenceKind: JournalReferenceKind;
  readonly sourceLocator: string;
  readonly declaredBy: string;
  readonly declaredAt: string;
  readonly verifiedBy: string | null;
  readonly verifiedAt: string | null;
  readonly verificationMethod: JournalVerificationMethod | null;
}

/**
 * Toutes les règles, en une passe, dans l'ordre où elles se lisent. Pure :
 * aucune requête, aucune horloge. Un appelant JavaScript qui a menti au
 * compilateur échoue ICI, pas en base.
 */
export function validerQualification(
  intent: QualificationIntent,
): { ok: true; params: Parametres } | { ok: false; refusal: QualificationRefusal<QualificationRefusalCause> } {
  const ko = (cause: QualificationRefusalCause, at: string) => ({ ok: false as const, refusal: { cause, at } });

  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    return ko("MALFORMED_INTENT", "intent");
  }
  const kind = (intent as { provenanceKind?: unknown }).provenanceKind;
  if (typeof kind !== "string" || !(JOURNAL_PROVENANCE_KINDS as readonly string[]).includes(kind)) {
    return ko("MALFORMED_INTENT", "provenanceKind");
  }
  const provenanceKind = kind as JournalProvenanceKind;

  if (!estChaineNonBordee(intent.evidenceSnapshotId)) return ko("MISSING_EVIDENCE_TARGET", "evidenceSnapshotId");

  const referenceKind = (intent as { referenceKind?: unknown }).referenceKind;
  if (typeof referenceKind !== "string" || !(JOURNAL_REFERENCE_KINDS as readonly string[]).includes(referenceKind)) {
    return ko("UNKNOWN_REFERENCE_KIND", "referenceKind");
  }
  const refKind = referenceKind as JournalReferenceKind;

  // ── 4b, AVANT même de regarder les champs de vérification : le couple
  //    interdit est interdit pour lui-même, pas parce qu'il manquerait quelque
  //    chose. Le type l'exclut déjà ; ceci est pour l'appelant non typé.
  if (provenanceKind === "VERIFIED" && refKind === "QUERY_CONTEXT") {
    return ko("VERIFIED_QUERY_CONTEXT_FORBIDDEN", "referenceKind");
  }

  if (!formeLocalisateurAdmise(refKind, (intent as { sourceLocator?: unknown }).sourceLocator as string)) {
    return ko("MALFORMED_LOCATOR", `sourceLocator (${refKind})`);
  }
  const sourceLocator = intent.sourceLocator;

  const sha = (intent as { sha256?: unknown }).sha256;
  if (sha !== null && sha !== undefined && !(typeof sha === "string" && /^[0-9a-f]{64}$/.test(sha))) {
    return ko("MALFORMED_SHA256", "sha256");
  }
  const sha256 = typeof sha === "string" ? sha : null;

  if (!estChaineNonBordee(intent.declaredBy)) return ko("MALFORMED_DECLARANT", "declaredBy");
  const declaredAt = instant(intent.declaredAt);
  if (declaredAt === null) return ko("MALFORMED_DECLARED_AT", "declaredAt");

  // ── VERIFIED ⇔ (qui, quand, comment). Les deux sens.
  const brut = (intent as { verification?: unknown }).verification;
  if (provenanceKind === "VERIFIED") {
    if (typeof brut !== "object" || brut === null) return ko("VERIFICATION_REQUIRED", "verification");
    const v = brut as { by?: unknown; at?: unknown; method?: unknown };
    if (!estChaineNonBordee(v.by)) return ko("VERIFICATION_REQUIRED", "verification.by");
    const at = instant(v.at);
    if (at === null) return ko("VERIFICATION_REQUIRED", "verification.at");
    if (typeof v.method !== "string" || !(JOURNAL_VERIFICATION_METHODS as readonly string[]).includes(v.method)) {
      return ko("VERIFICATION_REQUIRED", "verification.method");
    }
    return {
      ok: true,
      params: {
        evidenceSnapshotId: intent.evidenceSnapshotId,
        sha256,
        provenanceKind,
        referenceKind: refKind,
        sourceLocator,
        declaredBy: intent.declaredBy,
        declaredAt,
        verifiedBy: v.by,
        verifiedAt: at,
        verificationMethod: v.method as JournalVerificationMethod,
      },
    };
  }

  // ── L'autre sens : une qualification honnêtement incomplète ne se pare pas
  //    d'une vérification. Le type ne déclare pas le champ ; on refuse quand
  //    même s'il arrive, plutôt que de l'ignorer en silence.
  if (brut !== undefined && brut !== null) return ko("VERIFICATION_NOT_ALLOWED", "verification");

  return {
    ok: true,
    params: {
      evidenceSnapshotId: intent.evidenceSnapshotId,
      sha256,
      provenanceKind,
      referenceKind: refKind,
      sourceLocator,
      declaredBy: intent.declaredBy,
      declaredAt,
      verifiedBy: null,
      verifiedAt: null,
      verificationMethod: null,
    },
  };
}

// ═══ L'ÉCRITURE — UN INSERT, UNE RELECTURE, RIEN D'AUTRE ════════════════════

/** Les colonnes dont la relecture DOIT rendre exactement ce qui a été demandé. */
const COLONNES_CIBLES = [
  "evidenceSnapshotId",
  "sha256",
  "provenanceKind",
  "referenceKind",
  "sourceLocator",
  "declaredBy",
  "declaredAt",
  "verifiedBy",
  "verifiedAt",
  "verificationMethod",
] as const;

const attendu = (p: Parametres): Record<(typeof COLONNES_CIBLES)[number], string | null> => ({
  evidenceSnapshotId: p.evidenceSnapshotId,
  sha256: p.sha256,
  provenanceKind: p.provenanceKind,
  referenceKind: p.referenceKind,
  sourceLocator: p.sourceLocator,
  declaredBy: p.declaredBy,
  declaredAt: p.declaredAt,
  verifiedBy: p.verifiedBy,
  verifiedAt: p.verifiedAt,
  verificationMethod: p.verificationMethod,
});

/** Deux instants sont égaux s'ils désignent le même point du temps, pas la même chaîne. */
const memeInstant = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return a === b;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  return !Number.isNaN(x) && !Number.isNaN(y) && x === y;
};

/**
 * INSCRIRE une qualification. UNE transaction, UN INSERT, UNE relecture.
 *
 * Refuse AVANT la base sur toute règle violée, avec une cause nommée. Les
 * refus de la BASE (23503 pièce inexistante, 23514 CHECK) ne sont PAS traduits
 * en refus gouvernés : ils remontent tels quels, parce qu'ils disent quelque
 * chose que ce module ne savait pas, et la transaction est annulée de la même
 * façon. Rien n'est écrit à moitié.
 *
 * ⛔ Aucun chemin de cette fonction ne met à jour ni ne supprime quoi que ce
 * soit. Requalifier = rappeler cette même fonction avec une NOUVELLE intention.
 */
export async function recordQualification(
  tx: JournalSqlTransactor,
  intent: QualificationIntent,
): Promise<QualificationOutcome> {
  const v = validerQualification(intent);
  if (!v.ok) return { outcome: "REFUSED", refusal: v.refusal };
  const p = v.params;

  try {
    return await tx.transaction(async (db) => {
      // ── L'INSERT. Le SQL est écrit EN CLAIR AU SITE D'APPEL, jamais tenu
      //    dans une constante ni assemblé : la garde S24 découvre les tables
      //    atteintes en lisant le gabarit littéral passé à `db.query` — une
      //    constante référencée par son nom la rendrait AVEUGLE à ce module.
      //
      // ⚠ `declared_at` est `$7`. Pas `now()`. Pas un DEFAULT. Le mutant qui
      //    substitue l'horloge du serveur ici fait diverger la relecture et
      //    rougit — et le témoin structurel refuse le fichier avant même
      //    qu'on l'exécute.
      const inserted = await db.query<{ journalId: string }>(
        `INSERT INTO evidence_provenance_journal
        (evidence_snapshot_id, sha256, provenance_kind, reference_kind,
         source_url, declared_by, declared_at,
         verified_by, verified_at, verification_method)
 VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz, $10)
 RETURNING id::text AS "journalId"`,
        [
          p.evidenceSnapshotId,
          p.sha256,
          p.provenanceKind,
          p.referenceKind,
          p.sourceLocator,
          p.declaredBy,
          p.declaredAt,
          p.verifiedBy,
          p.verifiedAt,
          p.verificationMethod,
        ],
      );
      const journalId = inserted[0]?.journalId;
      if (typeof journalId !== "string" || !/^\d+$/.test(journalId)) {
        throw new QualificationAbort("INSERT_NOT_RECORDED", p.evidenceSnapshotId);
      }

      // ── La RELECTURE. On ne rend pas l'intention : on rend ce que la base a
      //    gardé. Sans elle, un DEFAULT ou un trigger pourrait écrire autre
      //    chose que ce qu'on croit avoir déclaré, et personne ne le saurait.
      //    Colonnes énumérées, jamais `*` : une colonne ajoutée demain ne doit
      //    pas changer en silence ce que ce module croit avoir écrit.
      const relu = await db.query<Record<string, unknown>>(
        `SELECT id::text                       AS "journalId",
        evidence_snapshot_id                  AS "evidenceSnapshotId",
        provenance_kind                       AS "provenanceKind",
        reference_kind                        AS "referenceKind",
        source_url                            AS "sourceLocator",
        sha256                                AS "sha256",
        declared_by                           AS "declaredBy",
        to_char(declared_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "declaredAt",
        verified_by                           AS "verifiedBy",
        to_char(verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "verifiedAt",
        verification_method                   AS "verificationMethod",
        to_char(recorded_at  AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordedAt"
   FROM evidence_provenance_journal
  WHERE id = $1::bigint`,
        [journalId],
      );
      const row = relu[0];
      if (!row) throw new QualificationAbort("READBACK_MISSING", journalId);

      const cible = attendu(p);
      for (const col of COLONNES_CIBLES) {
        const lu = row[col] === undefined ? null : (row[col] as string | null);
        const att = cible[col];
        const egal =
          col === "declaredAt" || col === "verifiedAt" ? memeInstant(lu, att) : lu === att;
        if (!egal) {
          throw new QualificationAbort("READBACK_MISMATCH", `${col}: attendu ${att ?? "∅"}, relu ${lu ?? "∅"}`);
        }
      }

      return {
        outcome: "RECORDED",
        row: {
          journalId,
          evidenceSnapshotId: p.evidenceSnapshotId,
          provenanceKind: p.provenanceKind,
          referenceKind: p.referenceKind,
          sourceLocator: p.sourceLocator,
          sha256: p.sha256,
          declaredBy: p.declaredBy,
          declaredAt: String(row.declaredAt),
          verifiedBy: p.verifiedBy,
          verifiedAt: row.verifiedAt === undefined ? null : (row.verifiedAt as string | null),
          verificationMethod: p.verificationMethod,
          recordedAt: String(row.recordedAt),
        },
      } satisfies QualificationOutcome;
    });
  } catch (e) {
    if (e instanceof QualificationAbort) return { outcome: "ABORTED", refusal: { cause: e.cause, at: e.at } };
    throw e;
  }
}
