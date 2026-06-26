// ─── Watcher Bridge — DRAFT KolTokenLink creation (Sprint 4) ────────────────
//
// Promotes a qualified, HIGH-confidence-resolved Watcher signal into a
// KolTokenLink that is NEVER public. The public scan/Watchlist filter strictly
// on visibility='public' (advanced from Sprint 8 in this same sprint), so a
// draft created here cannot surface publicly.
//
// HARD INVARIANTS (literal in the INSERT — cannot be flipped here):
//   visibility='draft', reviewStatus='auto_draft', createdByBridge=true.
// Idempotent on the table's @@unique(kolHandle, contractAddress, chain): if any
// link already exists for that triple (public OR draft OR rejected), SKIP.

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface DraftLinkInput {
  kolHandle: string;
  canonicalMint: string;
  canonicalChain: string;
  symbol: string | null;
  watcherCampaignId: string | null;
  socialPostCandidateId: string;
  evidenceSnapshotId: string | null;
  note?: string;
}

export type DraftAction = "draft_created" | "skipped_exists";
export interface DraftResult {
  action: DraftAction;
  kolTokenLinkId?: string;
  existingVisibility?: string;
}

const DEFAULT_NOTE =
  "Auto-draft from Watcher V2 bridge. Internal review pending — not public, not legal-reviewed.";

export async function createDraftKolTokenLink(
  db: RawDb,
  input: DraftLinkInput,
): Promise<DraftResult> {
  // Idempotence / hard unique guard on (kolHandle, contractAddress, chain).
  const existing = await db.$queryRawUnsafe<Array<{ visibility: string }>>(
    `SELECT "visibility" FROM "KolTokenLink"
      WHERE "kolHandle" = $1 AND "contractAddress" = $2 AND "chain" = $3
      LIMIT 1`,
    input.kolHandle,
    input.canonicalMint,
    input.canonicalChain,
  );
  if (existing.length > 0) {
    return { action: "skipped_exists", existingVisibility: existing[0].visibility };
  }

  const note = input.note ?? DEFAULT_NOTE;
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "KolTokenLink"
       ("kolHandle","contractAddress","chain","tokenSymbol","role","note","documentationStatus",
        "visibility","reviewStatus","createdByBridge","sourceType","sourceRefId",
        "watcherCampaignId","socialPostCandidateId","canonicalChain","canonicalMint",
        "tokenResolutionConfidence","tokenResolutionStatus","evidenceSnapshotId")
     VALUES
       ($1,$2,$3,$4,'promoter',$5,'partial',
        'draft','auto_draft',true,'watcher',$6,
        $7,$8,$9,$10,'HIGH','RESOLVED',$11)
     RETURNING id`,
    input.kolHandle,
    input.canonicalMint,
    input.canonicalChain,
    input.symbol,
    note,
    input.socialPostCandidateId, // sourceRefId
    input.watcherCampaignId,
    input.socialPostCandidateId, // socialPostCandidateId
    input.canonicalChain,
    input.canonicalMint,
    input.evidenceSnapshotId,
  );

  return { action: "draft_created", kolTokenLinkId: rows[0]?.id };
}
