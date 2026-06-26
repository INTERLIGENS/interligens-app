// ─── Watcher Bridge — Admin Draft Queue data loader (Sprint 6) ──────────────
// READ-ONLY. Lists bridge-created draft KolTokenLinks + needs_resolution
// SignalIntake rows for the admin review queue (/admin/watcher-drafts). No DB
// write. The page that consumes this is gated server-side by the admin session.

import { prisma } from "@/lib/prisma";

export interface DraftQueueRow {
  id: string;
  kolHandle: string;
  tokenSymbol: string | null;
  canonicalMint: string | null;
  chain: string;
  resolutionConfidence: string | null;
  resolutionStatus: string | null;
  reviewStatus: string;
  visibility: string;
  campaignPriority: string | null;
  signalScore: number | null;
  campaignKolCount: number | null;
  postUrl: string | null;
  candidateStatus: string | null;
  evidenceLevel: string | null;
  publicDuplicateCount: number;
  createdAt: Date;
}

export interface NeedsResolutionRow {
  id: string;
  kolHandle: string | null;
  detectedSymbols: string[];
  detectedAddresses: string[];
  resolutionStatus: string | null;
  resolutionMethod: string | null;
  resolutionConfidence: string | null;
  signalScore: number | null;
  campaignPriority: string | null;
  campaignKolCount: number | null;
  postUrl: string | null;
  rawText: string | null;
  createdAt: Date;
}

export interface WatcherDraftQueue {
  drafts: DraftQueueRow[];
  needsResolution: NeedsResolutionRow[];
  counts: { drafts: number; needsResolution: number };
}

export async function loadWatcherDraftQueue(): Promise<WatcherDraftQueue> {
  const drafts = await prisma.$queryRawUnsafe<DraftQueueRow[]>(
    `SELECT
        k.id,
        k."kolHandle"                  AS "kolHandle",
        k."tokenSymbol"                AS "tokenSymbol",
        k."canonicalMint"              AS "canonicalMint",
        k.chain                        AS chain,
        k."tokenResolutionConfidence"  AS "resolutionConfidence",
        k."tokenResolutionStatus"      AS "resolutionStatus",
        k."reviewStatus"               AS "reviewStatus",
        k.visibility                   AS visibility,
        k."createdAt"                  AS "createdAt",
        c."postUrl"                    AS "postUrl",
        c."signalScore"                AS "signalScore",
        c.status                       AS "candidateStatus",
        wc.priority                    AS "campaignPriority",
        wc."kolCount"                  AS "campaignKolCount",
        es."evidenceLevel"             AS "evidenceLevel",
        (SELECT count(*)::int FROM "KolTokenLink" k2
          WHERE k2."contractAddress" = k."contractAddress"
            AND k2.visibility = 'public')  AS "publicDuplicateCount"
       FROM "KolTokenLink" k
       LEFT JOIN "social_post_candidates" c ON c.id = k."socialPostCandidateId"
       LEFT JOIN "WatcherCampaign" wc       ON wc.id = k."watcherCampaignId"
       LEFT JOIN "EvidenceSnapshot" es      ON es.id = k."evidenceSnapshotId"
      WHERE k.visibility = 'draft'
      ORDER BY k."createdAt" DESC`,
  );

  const needsResolution = await prisma.$queryRawUnsafe<NeedsResolutionRow[]>(
    `SELECT
        s.id,
        s."kolHandle"                  AS "kolHandle",
        s."detectedSymbols"            AS "detectedSymbols",
        s."detectedAddresses"          AS "detectedAddresses",
        s."tokenResolutionStatus"      AS "resolutionStatus",
        s."tokenResolutionMethod"      AS "resolutionMethod",
        s."tokenResolutionConfidence"  AS "resolutionConfidence",
        s."signalScore"                AS "signalScore",
        s."rawText"                    AS "rawText",
        s."createdAt"                  AS "createdAt",
        c."postUrl"                    AS "postUrl",
        wc.priority                    AS "campaignPriority",
        wc."kolCount"                  AS "campaignKolCount"
       FROM "SignalIntake" s
       LEFT JOIN "social_post_candidates" c ON c.id = s."sourceRefId"
       LEFT JOIN "WatcherCampaign" wc       ON wc.id = s."watcherCampaignId"
      WHERE s.status = 'needs_resolution'
      ORDER BY s."createdAt" DESC`,
  );

  return {
    drafts,
    needsResolution,
    counts: { drafts: drafts.length, needsResolution: needsResolution.length },
  };
}
