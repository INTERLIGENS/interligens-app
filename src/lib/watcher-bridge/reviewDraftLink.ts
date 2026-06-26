// ─── Watcher Bridge — approve/reject a draft KolTokenLink (Sprint 7) ────────
//
// Admin 1-click review actions. APPROVE makes a draft link public; REJECT
// marks it rejected (reason required). Both move the source SocialPostCandidate
// through the validated state machine (audited in CandidateStatusLog) and roll
// up the WatcherCampaign reviewStatus. EvidenceSnapshot.isPublic is NEVER
// touched (internal evidence stays internal). Idempotent.

import { transitionCandidate, StaleStatusError } from "@/lib/watcher-bridge/candidateStateMachine";

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

interface LinkRow {
  id: string;
  visibility: string;
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
  warning?: string;
}

async function loadLink(db: RawDb, linkId: string): Promise<LinkRow | null> {
  const rows = await db.$queryRawUnsafe<LinkRow[]>(
    `SELECT id, visibility, "canonicalMint", "tokenResolutionConfidence",
            "socialPostCandidateId", "watcherCampaignId"
       FROM "KolTokenLink" WHERE id = $1 LIMIT 1`,
    linkId,
  );
  return rows[0] ?? null;
}

// Roll up the campaign review status from its bridge-origin links.
async function recomputeCampaignReviewStatus(db: RawDb, campaignId: string | null): Promise<string | undefined> {
  if (!campaignId) return undefined;
  const rows = await db.$queryRawUnsafe<Array<{ total: number; pub: number; rej: number }>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE visibility = 'public')::int   AS pub,
            count(*) FILTER (WHERE visibility = 'rejected')::int AS rej
       FROM "KolTokenLink"
      WHERE "watcherCampaignId" = $1 AND "createdByBridge" = true`,
    campaignId,
  );
  const { total, pub, rej } = rows[0] ?? { total: 0, pub: 0, rej: 0 };
  let status = "pending";
  if (total > 0 && pub === total) status = "approved_public";
  else if (total > 0 && rej === total) status = "rejected";
  else if (pub > 0) status = "partially_approved";
  await db.$queryRawUnsafe(
    `UPDATE "WatcherCampaign" SET "reviewStatus" = $2, "updatedAt" = now() WHERE id = $1`,
    campaignId,
    status,
  );
  return status;
}

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
  const cand = await moveCandidate(db, link.socialPostCandidateId, "approved_public", "admin approve", reviewedBy);
  const campaignReviewStatus = await recomputeCampaignReviewStatus(db, link.watcherCampaignId);

  return { linkId, action: "approved", candidateTransition: cand.transition, campaignReviewStatus, warning: cand.warning };
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
  // way (use the approved_public→archived path for that).
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
  const cand = await moveCandidate(db, link.socialPostCandidateId, "rejected", `admin reject: ${reason.trim()}`, reviewedBy);
  const campaignReviewStatus = await recomputeCampaignReviewStatus(db, link.watcherCampaignId);

  return { linkId, action: "rejected", candidateTransition: cand.transition, campaignReviewStatus, reason: reason.trim(), warning: cand.warning };
}
