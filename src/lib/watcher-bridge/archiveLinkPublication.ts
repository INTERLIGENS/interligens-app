// ─── P0-2 — DÉPUBLICATION D'UN LIEN PUBLIÉ (réversibilité éditoriale) ──────
//
// Le chemin que reviewDraftLink.ts promettait sans qu'il existe.
//
// Cycle complet : draft → approved_public → archived, HISTORIQUE CONSERVÉ.
// On n'efface pas une décision : on l'archive, on dit pourquoi, et on garde la
// trace de qui l'a prise, quand, et depuis quel état.
//
//   * `archived` est un état TERMINAL et il n'est PAS `public` : tous les
//     consommateurs aval filtrent en LISTE BLANCHE (visibility = 'public'),
//     donc l'archivage les vide tous d'un coup. Cette propriété est vérifiée
//     par __tests__/security/koltokenlink-visibility-invariant.test.ts, qui
//     échoue si une lecture publique oublie le filtre — cinq lectures
//     l'avaient oublié au moment d'écrire ce module.
//   * Le motif est OBLIGATOIRE (code contraint + texte libre non vide). Une
//     dépublication sans motif n'est pas traçable, donc n'est pas une
//     dépublication : c'est un effacement.
//   * Le journal (KolTokenLinkStatusLog) est append-only et dénormalisé, de
//     sorte qu'une CONTESTATION puisse être démontrée comme honorée même si le
//     lien lui-même disparaît plus tard.
//
// PÉRIMÈTRE : le chemin technique et sa traçabilité. Le chantier CONTESTATION
// (crédibilité n°3) n'est PAS ouvert ici — seule la colonne `contestationRef`
// lui est réservée, en entrée optionnelle.

import { transitionCandidate, StaleStatusError } from "@/lib/watcher-bridge/candidateStateMachine";
import {
  recomputeCampaignReviewStatus,
  type CampaignReviewStatus,
} from "@/lib/watcher-bridge/campaignReviewStatus";
import {
  recordPublicationDecision,
  type PublicationDecisionCode,
} from "@/lib/watcher-bridge/linkPublicationJournal";

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Motifs de dépublication acceptés. Sous-ensemble de
 * PUBLICATION_DECISION_CODES : on ne dépublie pas avec le code `approved`.
 */
export const ARCHIVE_REASON_CODES = [
  "contested",
  "erratum",
  "evidence_withdrawn",
  "legal",
  "duplicate",
  "other",
] as const;

export type ArchiveReasonCode = (typeof ARCHIVE_REASON_CODES)[number];

/**
 * Le SEUL état depuis lequel on peut archiver. Un draft ne s'archive pas, il
 * se rejette (rejectDraftLink) ; un lien rejeté est déjà terminal. Archiver un
 * draft reviendrait à retirer une publication qui n'a jamais eu lieu.
 */
export const ARCHIVABLE_FROM = "public" as const;

export type ArchiveAction =
  | "archived"
  | "noop_already_archived"
  | "not_public"
  | "missing_reason"
  | "invalid_reason_code"
  | "missing_actor"
  | "not_found";

export interface ArchiveInput {
  /** Qui prend la décision. Obligatoire — une décision anonyme n'est pas éditoriale. */
  actorId: string;
  /** Motif libre, obligatoire, non vide. */
  reason: string;
  /** Motif codé, obligatoire, dans ARCHIVE_REASON_CODES. */
  reasonCode: string;
  /** Référence du dossier de contestation, quand la dépublication l'honore. */
  contestationRef?: string | null;
}

export interface ArchiveResult {
  linkId: string;
  action: ArchiveAction;
  from?: string;
  to?: string;
  reason?: string;
  reasonCode?: string;
  logId?: string;
  candidateTransition?: string;
  campaignReviewStatus?: CampaignReviewStatus;
  warning?: string;
}

interface LinkRow {
  id: string;
  kolHandle: string;
  tokenSymbol: string | null;
  canonicalMint: string | null;
  visibility: string;
  reviewStatus: string | null;
  socialPostCandidateId: string | null;
  watcherCampaignId: string | null;
}

async function loadLink(db: RawDb, linkId: string): Promise<LinkRow | null> {
  const rows = await db.$queryRawUnsafe<LinkRow[]>(
    `SELECT id, "kolHandle", "tokenSymbol", "canonicalMint", visibility,
            "reviewStatus", "socialPostCandidateId", "watcherCampaignId"
       FROM "KolTokenLink" WHERE id = $1 LIMIT 1`,
    linkId,
  );
  return rows[0] ?? null;
}

function isArchiveReasonCode(value: string): value is ArchiveReasonCode {
  return (ARCHIVE_REASON_CODES as readonly string[]).includes(value);
}

/**
 * Déplace le SocialPostCandidate d'origine vers `archived`, quand il y en a un.
 *
 * 185 des 187 liens publics constatés en base n'ont AUCUN candidat (seeds
 * éditoriaux antérieurs au bridge) : l'absence de candidat est le cas NORMAL,
 * pas une anomalie. Un candidat qui n'est pas en approved_public est en
 * revanche une incohérence réelle — on la remonte en warning sans faire
 * échouer la dépublication, qui est l'acte protecteur.
 */
async function moveCandidate(
  db: RawDb,
  candidateId: string | null,
  reason: string,
  actorId: string,
): Promise<{ transition?: string; warning?: string }> {
  if (!candidateId) return {};
  try {
    const r = await transitionCandidate(db, candidateId, "approved_public", "archived", reason, actorId);
    return { transition: r.action === "noop" ? "noop(archived)" : "approved_public→archived" };
  } catch (e) {
    if (e instanceof StaleStatusError) {
      return {
        warning: `candidate not in approved_public (${e.actual}); link archived, candidate state unchanged`,
      };
    }
    throw e;
  }
}

/**
 * Dépublie un lien publié. Idempotent (déjà archivé → noop). Refuse tout ce
 * qui n'est pas un `public` en cours. Aucune écriture si une validation échoue.
 */
export async function archiveLinkPublication(
  db: RawDb,
  linkId: string,
  input: ArchiveInput,
): Promise<ArchiveResult> {
  // ── Validations AVANT toute écriture. Fail-closed. ──────────────────────
  const actorId = typeof input.actorId === "string" ? input.actorId.trim() : "";
  if (actorId.length === 0) return { linkId, action: "missing_actor" };

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length === 0) return { linkId, action: "missing_reason" };

  const rawCode = typeof input.reasonCode === "string" ? input.reasonCode.trim() : "";
  if (!isArchiveReasonCode(rawCode)) return { linkId, action: "invalid_reason_code" };
  const reasonCode: PublicationDecisionCode = rawCode;

  const contestationRef =
    typeof input.contestationRef === "string" && input.contestationRef.trim().length > 0
      ? input.contestationRef.trim()
      : null;

  const link = await loadLink(db, linkId);
  if (!link) return { linkId, action: "not_found" };

  // Idempotence : déjà archivé → on ne réécrit pas, on ne rejournalise pas.
  if (link.visibility === "archived") {
    return { linkId, action: "noop_already_archived", from: "archived", to: "archived" };
  }

  if (link.visibility !== ARCHIVABLE_FROM) {
    return {
      linkId,
      action: "not_public",
      from: link.visibility,
      reason: `only a '${ARCHIVABLE_FROM}' link can be archived (visibility=${link.visibility}); a draft is rejected, not archived`,
    };
  }

  // ── ORDRE D'ÉCRITURE : le journal AVANT la mutation. ────────────────────
  // Il n'y a pas de transaction ici (l'interface RawDb n'en expose pas, et le
  // pooler pgbouncer en mode transaction rend le $transaction interactif
  // fragile). L'ordre est donc choisi pour que le seul échec partiel possible
  // soit le MOINS grave : un journal sans mutation — une décision consignée
  // qui n'a pas pris effet, visible et rejouable — plutôt qu'une mutation sans
  // journal, c'est-à-dire une dépublication silencieuse, exactement ce que ce
  // chantier interdit. L'écriture du lien est ensuite gardée par
  // `WHERE visibility = 'public'`, donc une reprise ne peut pas double-archiver.
  //
  // Une erreur du journal REMONTE ici (pas de catch) : sans trace, la
  // dépublication ne doit pas avoir lieu.
  const logId = await recordPublicationDecision(db, {
    linkId,
    kolHandle: link.kolHandle,
    tokenSymbol: link.tokenSymbol,
    canonicalMint: link.canonicalMint,
    fromVisibility: link.visibility,
    toVisibility: "archived",
    fromReviewStatus: link.reviewStatus,
    toReviewStatus: "archived",
    reasonCode,
    reason,
    actorId,
    contestationRef,
  });

  const updated = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "KolTokenLink"
        SET visibility = 'archived', "reviewStatus" = 'archived',
            "reviewedBy" = $2, "reviewedAt" = now(), "reviewNote" = $3
      WHERE id = $1 AND visibility = $4
      RETURNING id`,
    linkId,
    actorId,
    `[${reasonCode}] ${reason}`,
    ARCHIVABLE_FROM,
  );
  if (updated.length === 0) {
    // Course perdue : le lien a bougé entre le load et l'update.
    const current = await loadLink(db, linkId);
    if (current && current.visibility === "archived") {
      return { linkId, action: "noop_already_archived", from: "archived", to: "archived", logId };
    }
    return {
      linkId,
      action: "not_public",
      from: current?.visibility ?? "unknown",
      reason: "concurrent modification: link left 'public' before the archive write",
      logId,
    };
  }

  const cand = await moveCandidate(
    db,
    link.socialPostCandidateId,
    `archive: [${reasonCode}] ${reason}`,
    actorId,
  );
  const campaignReviewStatus = await recomputeCampaignReviewStatus(db, link.watcherCampaignId);

  return {
    linkId,
    action: "archived",
    from: ARCHIVABLE_FROM,
    to: "archived",
    reason,
    reasonCode,
    logId,
    candidateTransition: cand.transition,
    campaignReviewStatus,
    warning: cand.warning,
  };
}

export {
  getLinkPublicationHistory,
  getHandlePublicationHistory,
} from "@/lib/watcher-bridge/linkPublicationJournal";
