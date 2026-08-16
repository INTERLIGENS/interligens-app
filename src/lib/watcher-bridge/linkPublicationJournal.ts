// ─── P0-2 — JOURNAL DES DÉCISIONS DE PUBLICATION ───────────────────────────
//
// Registre append-only de toutes les décisions publiques prises sur un
// KolTokenLink : approbation, rejet, dépublication. Une décision n'est jamais
// écrasée ; on empile.
//
// POURQUOI PAS reviewedBy / reviewedAt / reviewNote SUR LE LIEN : ces trois
// colonnes existent déjà mais sont MONO-EMPLACEMENT — la décision suivante
// écrase la précédente. Un cycle draft → public → archived n'y laisse que sa
// dernière étape. Or c'est précisément l'enchaînement qu'une contestation doit
// pouvoir reconstituer.
//
// POURQUOI PAS CandidateStatusLog : il est keyé sur SocialPostCandidate.
// Constat en base ep-square-band le 2026-08-15 : 185 des 187 liens publics ont
// createdByBridge = false, donc AUCUN candidat. Les journaliser là écrirait
// dans le vide.
//
// La table vit dans migrations/MIGRATION_publication_lifecycle_v1.sql
// (NON APPLIQUÉE — exécution manuelle par David dans le Neon SQL Editor).

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Codes de décision autorisés. Doit rester ALIGNÉ sur la contrainte CHECK
 * `KolTokenLinkStatusLog_reasonCode_allowed` de la migration — un code accepté
 * ici et refusé par la base ferait échouer l'INSERT. Un test verrouille
 * l'alignement en lisant le fichier SQL.
 */
export const PUBLICATION_DECISION_CODES = [
  // Décisions de mise en ligne
  "approved",
  "rejected",
  // Motifs de dépublication
  "contested",
  "erratum",
  "evidence_withdrawn",
  "legal",
  "duplicate",
  "other",
] as const;

export type PublicationDecisionCode = (typeof PUBLICATION_DECISION_CODES)[number];

export function isPublicationDecisionCode(value: string): value is PublicationDecisionCode {
  return (PUBLICATION_DECISION_CODES as readonly string[]).includes(value);
}

export interface PublicationDecision {
  linkId: string;
  kolHandle: string;
  tokenSymbol: string | null;
  canonicalMint: string | null;
  fromVisibility: string;
  toVisibility: string;
  fromReviewStatus: string | null;
  toReviewStatus: string | null;
  reasonCode: PublicationDecisionCode;
  reason: string;
  actorId: string;
  contestationRef?: string | null;
}

export interface PublicationHistoryEntry {
  id: string;
  linkId: string;
  kolHandle: string;
  tokenSymbol: string | null;
  fromVisibility: string;
  toVisibility: string;
  fromReviewStatus: string | null;
  toReviewStatus: string | null;
  reasonCode: string;
  reason: string;
  actorId: string;
  contestationRef: string | null;
  createdAt: Date;
}

/** Écrit une décision au journal. Renvoie l'id de l'entrée créée. */
export async function recordPublicationDecision(
  db: RawDb,
  decision: PublicationDecision,
): Promise<string | undefined> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "KolTokenLinkStatusLog"
       ("linkId","kolHandle","tokenSymbol","canonicalMint",
        "fromVisibility","toVisibility","fromReviewStatus","toReviewStatus",
        "reasonCode","reason","actorId","contestationRef")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    decision.linkId,
    decision.kolHandle,
    decision.tokenSymbol,
    decision.canonicalMint,
    decision.fromVisibility,
    decision.toVisibility,
    decision.fromReviewStatus,
    decision.toReviewStatus,
    decision.reasonCode,
    decision.reason,
    decision.actorId,
    decision.contestationRef ?? null,
  );
  return rows[0]?.id;
}

/**
 * Écrit une décision SANS jamais faire échouer l'appelant.
 *
 * Utilisé sur les chemins APPROVE / REJECT, où la mutation a déjà eu lieu :
 * refaire échouer l'opération à cause du journal ne défait pas la mutation, ça
 * ajoute juste une erreur. Le chemin ARCHIVE, lui, journalise AVANT de muter
 * et laisse remonter l'échec — voir archiveLinkPublication.ts.
 */
export async function recordPublicationDecisionSafe(
  db: RawDb,
  decision: PublicationDecision,
): Promise<{ logId?: string; warning?: string }> {
  try {
    const logId = await recordPublicationDecision(db, decision);
    return { logId };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { warning: `publication journal write failed: ${detail}` };
  }
}

/** Historique complet d'un lien, du plus récent au plus ancien. */
export async function getLinkPublicationHistory(
  db: RawDb,
  linkId: string,
): Promise<PublicationHistoryEntry[]> {
  return db.$queryRawUnsafe<PublicationHistoryEntry[]>(
    `SELECT id, "linkId", "kolHandle", "tokenSymbol", "fromVisibility", "toVisibility",
            "fromReviewStatus", "toReviewStatus", "reasonCode", "reason",
            "actorId", "contestationRef", "createdAt"
       FROM "KolTokenLinkStatusLog"
      WHERE "linkId" = $1
      ORDER BY "createdAt" DESC, id DESC`,
    linkId,
  );
}

/**
 * Historique par PERSONNE — la question que pose une contestation : « qu'avez-
 * vous publié à mon sujet, et qu'en avez-vous fait ? ». Répondable même si le
 * lien a disparu, grâce à la dénormalisation de kolHandle dans le journal.
 */
export async function getHandlePublicationHistory(
  db: RawDb,
  kolHandle: string,
): Promise<PublicationHistoryEntry[]> {
  return db.$queryRawUnsafe<PublicationHistoryEntry[]>(
    `SELECT id, "linkId", "kolHandle", "tokenSymbol", "fromVisibility", "toVisibility",
            "fromReviewStatus", "toReviewStatus", "reasonCode", "reason",
            "actorId", "contestationRef", "createdAt"
       FROM "KolTokenLinkStatusLog"
      WHERE lower("kolHandle") = lower($1)
      ORDER BY "createdAt" DESC, id DESC`,
    kolHandle,
  );
}
