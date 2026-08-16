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

// ─── P0-2 / Phase 1 — liens PUBLIÉS + registre des décisions ───────────────
//
// La file de revue ne montrait que des drafts. Un bouton d'archivage n'a
// d'objet que sur un lien DÉJÀ public : il faut donc les lister. On y joint
// l'historique lu dans KolTokenLinkStatusLog — la traçabilité ne sert à rien
// si elle n'est visible nulle part.

export interface PublishedLinkRow {
  id: string;
  kolHandle: string;
  tokenSymbol: string | null;
  canonicalMint: string | null;
  contractAddress: string;
  chain: string;
  visibility: string;
  reviewStatus: string | null;
  caseId: string | null;
  createdByBridge: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface DecisionRow {
  id: string;
  linkId: string;
  fromVisibility: string;
  toVisibility: string;
  reasonCode: string;
  reason: string;
  actorId: string;
  contestationRef: string | null;
  createdAt: Date;
}

export interface PublishedLinksView {
  published: PublishedLinkRow[];
  /** Décisions indexées par linkId, plus récente d'abord. */
  decisionsByLink: Map<string, DecisionRow[]>;
  totalPublished: number;
  /**
   * false quand KolTokenLinkStatusLog est injoignable (migration non appliquée
   * sur cet environnement). L'écran le DIT au lieu de laisser croire à un
   * registre vide — un registre absent et un registre vide ne racontent pas la
   * même histoire.
   */
  journalAvailable: boolean;
}

const PUBLISHED_DISPLAY_LIMIT = 250;

export async function loadPublishedLinks(): Promise<PublishedLinksView> {
  const published = await prisma.$queryRawUnsafe<PublishedLinkRow[]>(
    `SELECT k.id, k."kolHandle", k."tokenSymbol", k."canonicalMint",
            k."contractAddress", k.chain, k.visibility, k."reviewStatus",
            k."caseId", k."createdByBridge", k."reviewedBy", k."reviewedAt",
            k."createdAt"
       FROM "KolTokenLink" k
      WHERE k.visibility = 'public'
      ORDER BY k."createdAt" DESC
      LIMIT ${PUBLISHED_DISPLAY_LIMIT}`,
  );

  const totalRows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT count(*)::int AS n FROM "KolTokenLink" WHERE visibility = 'public'`,
  );

  const decisionsByLink = new Map<string, DecisionRow[]>();
  let journalAvailable = true;
  try {
    const decisions = await prisma.$queryRawUnsafe<DecisionRow[]>(
      `SELECT id, "linkId", "fromVisibility", "toVisibility", "reasonCode",
              reason, "actorId", "contestationRef", "createdAt"
         FROM "KolTokenLinkStatusLog"
        ORDER BY "createdAt" DESC, id DESC`,
    );
    for (const d of decisions) {
      const list = decisionsByLink.get(d.linkId);
      if (list) list.push(d);
      else decisionsByLink.set(d.linkId, [d]);
    }
  } catch {
    // Table absente sur cet environnement → on le signale, on ne ment pas.
    journalAvailable = false;
  }

  return {
    published,
    decisionsByLink,
    totalPublished: totalRows[0]?.n ?? 0,
    journalAvailable,
  };
}
