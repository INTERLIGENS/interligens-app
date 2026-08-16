// ─── Watcher Bridge — approve/reject a draft KolTokenLink (Sprint 7) ────────
//
// Admin 1-click review actions. APPROVE makes a draft link public; REJECT
// marks it rejected (reason required). Both move the source SocialPostCandidate
// through the validated state machine (audited in CandidateStatusLog) and roll
// up the WatcherCampaign reviewStatus. EvidenceSnapshot.isPublic is NEVER
// touched (internal evidence stays internal). Idempotent.

import { transitionCandidate, StaleStatusError } from "@/lib/watcher-bridge/candidateStateMachine";
import { recomputeCampaignReviewStatus } from "@/lib/watcher-bridge/campaignReviewStatus";
import { recordPublicationDecisionSafe } from "@/lib/watcher-bridge/linkPublicationJournal";

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

interface LinkRow {
  id: string;
  kolHandle: string;
  tokenSymbol: string | null;
  visibility: string;
  reviewStatus: string | null;
  canonicalMint: string | null;
  tokenResolutionConfidence: string | null;
  socialPostCandidateId: string | null;
  watcherCampaignId: string | null;
}

export type ApproveAction = "approved" | "noop_already_public" | "blocked_checklist" | "not_draft" | "not_found";
export type RejectAction = "rejected" | "noop_already_rejected" | "missing_reason" | "not_draft" | "not_found";

export interface ReviewResult {
  linkId: string;
  action: ApproveAction | RejectAction;
  candidateTransition?: string;
  campaignReviewStatus?: string;
  reason?: string;
  /** Entrée créée dans KolTokenLinkStatusLog (P0-2). */
  logId?: string;
  warning?: string;
}

async function loadLink(db: RawDb, linkId: string): Promise<LinkRow | null> {
  const rows = await db.$queryRawUnsafe<LinkRow[]>(
    `SELECT id, "kolHandle", "tokenSymbol", visibility, "reviewStatus",
            "canonicalMint", "tokenResolutionConfidence",
            "socialPostCandidateId", "watcherCampaignId"
       FROM "KolTokenLink" WHERE id = $1 LIMIT 1`,
    linkId,
  );
  return rows[0] ?? null;
}

// Le rollup du reviewStatus de campagne vit désormais dans
// campaignReviewStatus.ts : le chemin de dépublication (P0-2) doit le
// recalculer avec les mêmes règles, plus la branche 'archived'.

async function moveCandidate(
  db: RawDb,
  candidateId: string | null,
  to: "approved_public" | "rejected",
  reason: string,
  reviewedBy: string,
): Promise<{ transition?: string; warning?: string }> {
  if (!candidateId) return {};
  try {
    const r = await transitionCandidate(db, candidateId, "needs_review", to, reason, reviewedBy);
    return { transition: r.action === "noop" ? `noop(${to})` : `needs_review→${to}` };
  } catch (e) {
    if (e instanceof StaleStatusError) {
      // Link reviewed but candidate was not in needs_review — surface, don't fail.
      return { warning: `candidate not in needs_review (${e.actual}); link reviewed, candidate state unchanged` };
    }
    throw e;
  }
}

export async function approveDraftLink(
  db: RawDb,
  linkId: string,
  reviewedBy: string,
): Promise<ReviewResult> {
  const link = await loadLink(db, linkId);
  if (!link) return { linkId, action: "not_found" };
  if (link.visibility === "public") return { linkId, action: "noop_already_public" };
  // Only a draft can be approved (never resurrect a rejected link via approve).
  if (link.visibility !== "draft") return { linkId, action: "not_draft", reason: `link visibility=${link.visibility}` };

  // Block 5 checklist (server-side enforcement).
  if (!link.canonicalMint || link.tokenResolutionConfidence !== "HIGH") {
    return {
      linkId,
      action: "blocked_checklist",
      reason: `cannot approve: ${!link.canonicalMint ? "missing canonicalMint" : `confidence=${link.tokenResolutionConfidence} (need HIGH)`}`,
    };
  }

  await db.$queryRawUnsafe(
    `UPDATE "KolTokenLink"
        SET visibility = 'public', "reviewStatus" = 'approved_public',
            "reviewedBy" = $2, "reviewedAt" = now()
      WHERE id = $1`,
    linkId,
    reviewedBy,
  );
  // P0-2 — la mise en ligne entre au journal des décisions, pas seulement la
  // dépublication : sans elle, l'historique d'un lien archivé commencerait au
  // milieu du cycle. Ici le journal vient APRÈS la mutation (l'inverse du
  // chemin archive) : le lien est déjà public, échouer sur le journal
  // n'annulerait rien et transformerait une publication réussie en erreur.
  // Un défaut de journal est donc remonté en warning, pas en échec.
  const journal = await recordPublicationDecisionSafe(db, {
    linkId,
    kolHandle: link.kolHandle,
    tokenSymbol: link.tokenSymbol,
    canonicalMint: link.canonicalMint,
    fromVisibility: "draft",
    toVisibility: "public",
    fromReviewStatus: link.reviewStatus,
    toReviewStatus: "approved_public",
    reasonCode: "approved",
    reason: "admin approve",
    actorId: reviewedBy,
  });
  const cand = await moveCandidate(db, link.socialPostCandidateId, "approved_public", "admin approve", reviewedBy);
  const campaignReviewStatus = await recomputeCampaignReviewStatus(db, link.watcherCampaignId);

  return {
    linkId,
    action: "approved",
    candidateTransition: cand.transition,
    campaignReviewStatus,
    logId: journal.logId,
    warning: cand.warning ?? journal.warning,
  };
}

export async function rejectDraftLink(
  db: RawDb,
  linkId: string,
  reviewedBy: string,
  reason: string,
): Promise<ReviewResult> {
  if (!reason || !reason.trim()) return { linkId, action: "missing_reason" };
  const link = await loadLink(db, linkId);
  if (!link) return { linkId, action: "not_found" };
  if (link.visibility === "rejected") return { linkId, action: "noop_already_rejected" };
  // Only a draft can be rejected — never un-publish an approved public link this
  // way. Le chemin de dépublication existe désormais et vit dans
  // archiveLinkPublication.ts (P0-2) : public → archived, motif obligatoire,
  // journalisé dans KolTokenLinkStatusLog. Jusqu'à ce chantier, ce commentaire
  // renvoyait à un chemin qui n'existait nulle part.
  if (link.visibility !== "draft") return { linkId, action: "not_draft", reason: `link visibility=${link.visibility}` };

  await db.$queryRawUnsafe(
    `UPDATE "KolTokenLink"
        SET visibility = 'rejected', "reviewStatus" = 'rejected',
            "reviewedBy" = $2, "reviewedAt" = now(), "reviewNote" = $3
      WHERE id = $1`,
    linkId,
    reviewedBy,
    reason.trim(),
  );
  const journal = await recordPublicationDecisionSafe(db, {
    linkId,
    kolHandle: link.kolHandle,
    tokenSymbol: link.tokenSymbol,
    canonicalMint: link.canonicalMint,
    fromVisibility: "draft",
    toVisibility: "rejected",
    fromReviewStatus: link.reviewStatus,
    toReviewStatus: "rejected",
    reasonCode: "rejected",
    reason: reason.trim(),
    actorId: reviewedBy,
  });
  const cand = await moveCandidate(db, link.socialPostCandidateId, "rejected", `admin reject: ${reason.trim()}`, reviewedBy);
  const campaignReviewStatus = await recomputeCampaignReviewStatus(db, link.watcherCampaignId);

  return {
    linkId,
    action: "rejected",
    candidateTransition: cand.transition,
    campaignReviewStatus,
    reason: reason.trim(),
    logId: journal.logId,
    warning: cand.warning ?? journal.warning,
  };
}
