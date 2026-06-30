/**
 * src/lib/osint/review/loadReviewQueue.ts
 *
 * SPRINT B — Chargement READ-ONLY de la file de revue OSINT. Agrège les 3
 * sources de PENDING :
 *   - OsintSubmission status=PENDING_REVIEW (pipeline vision)
 *   - KolTokenLink   reviewStatus=pending_review (assertion en attente)
 *   - SignalIntake   status=needs_resolution (signal bridge non résolu)
 *
 * DÉFENSIF : OsintSubmission et OsintReviewAudit sont des tables ADDITIVES non
 * encore appliquées sur ep-square-band. Si absentes, on renvoie simplement 0
 * item de cette source (« en attente de données réelles ») au lieu de crasher.
 *
 * Les items ESCALADÉS (ligne OsintReviewAudit action=ESCALATE) sont EXCLUS de la
 * file standard. Les items déjà traités (resolved/rejected) ne remontent pas non
 * plus (les requêtes filtrent sur l'état pending de chaque source).
 */

import { prisma } from "@/lib/prisma";
import { ReviewItemType } from "./reviewContracts";

export interface VisionConsensusView {
  /** true si la 2e passe a été exécutée (sinon lecture simple). */
  twoPass: boolean;
  rawPass1: unknown;
  rawPass2: unknown;
}

export interface ReviewQueueItem {
  type: ReviewItemType;
  id: string;
  // ── Capture / provenance ───────────────────────────────────────────────────
  imageUrl: string | null;
  localFilePath: string | null;
  imageSha256: string | null;
  perceptualHash: string | null;
  // ── Ce que la vision a lu ───────────────────────────────────────────────────
  vision: VisionConsensusView | null;
  // ── Claim extrait ───────────────────────────────────────────────────────────
  tokenSymbol: string | null;
  contractAddress: string | null;
  chain: string | null;
  kolHandle: string | null;
  perf: string | null;
  // ── Décision / revue ────────────────────────────────────────────────────────
  pendingReason: string | null;
  rejectReason: string | null;
  claimStatus: string | null;
  trustTier: string | null;
  decisionReasons: string[];
  /** Badge "possible coordinated reporting" si un cluster a été noté. */
  poisoningFlag: boolean;
  createdAt: string | null;
}

export interface ReviewQueue {
  items: ReviewQueueItem[];
  counts: { submissions: number; links: number; signals: number; total: number };
  /** false si le pipeline temps-réel n'écrit pas encore (table absente). */
  submissionSourceLive: boolean;
}

async function tableExists(name: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
    name,
  )) as unknown[];
  return rows.length > 0;
}

/** sha256 des items escaladés (toutes sources confondues) → exclusion file standard. */
async function escalatedIds(auditLive: boolean): Promise<Set<string>> {
  if (!auditLive) return new Set();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "itemId" FROM "OsintReviewAudit" WHERE action = 'ESCALATE'`,
  )) as Array<{ itemId: string }>;
  return new Set(rows.map((r) => r.itemId));
}

function asArray(x: unknown): string[] {
  if (Array.isArray(x)) return x.map((v) => String(v));
  return [];
}

export async function loadReviewQueue(): Promise<ReviewQueue> {
  const submissionLive = await tableExists("OsintSubmission");
  const auditLive = await tableExists("OsintReviewAudit");
  const escalated = await escalatedIds(auditLive);

  const items: ReviewQueueItem[] = [];

  // ── 1. OsintSubmission PENDING_REVIEW (+ evidence liée pour l'image) ──────────
  if (submissionLive) {
    const subs = (await prisma.$queryRawUnsafe(
      `SELECT
          s.id, s."imageSha256", s."perceptualHash", s."trustTier",
          s."pendingReason", s."rejectReason", s."decisionReasons",
          s."rawVisionPass1", s."rawVisionPass2", s."ingestedAt",
          e."imageUrl"      AS "imageUrl",
          e."localFilePath" AS "localFilePath",
          e."kolHandle"     AS "kolHandle",
          e."tokenSymbol"   AS "tokenSymbol"
         FROM "OsintSubmission" s
         LEFT JOIN "EvidenceSnapshot" e ON e."sha256" = s."imageSha256"
        WHERE s.status = 'PENDING_REVIEW'
        ORDER BY s."ingestedAt" DESC`,
    )) as Array<Record<string, unknown>>;
    for (const r of subs) {
      if (escalated.has(String(r.id))) continue;
      const reasons = asArray(r.decisionReasons);
      items.push({
        type: ReviewItemType.SUBMISSION,
        id: String(r.id),
        imageUrl: (r.imageUrl as string) ?? null,
        localFilePath: (r.localFilePath as string) ?? null,
        imageSha256: (r.imageSha256 as string) ?? null,
        perceptualHash: (r.perceptualHash as string) ?? null,
        vision: {
          twoPass: r.rawVisionPass2 != null,
          rawPass1: r.rawVisionPass1 ?? null,
          rawPass2: r.rawVisionPass2 ?? null,
        },
        tokenSymbol: (r.tokenSymbol as string) ?? null,
        contractAddress: null,
        chain: null,
        kolHandle: (r.kolHandle as string) ?? null,
        perf: null,
        pendingReason: (r.pendingReason as string) ?? null,
        rejectReason: (r.rejectReason as string) ?? null,
        claimStatus: null,
        trustTier: (r.trustTier as string) ?? null,
        decisionReasons: reasons,
        poisoningFlag: reasons.some((x) => x.startsWith("POISONING:")),
        createdAt: r.ingestedAt ? new Date(r.ingestedAt as string).toISOString() : null,
      });
    }
  }

  // ── 2. KolTokenLink pending_review (assertion en attente) ────────────────────
  const links = (await prisma.$queryRawUnsafe(
    `SELECT
        k.id, k."kolHandle", k."tokenSymbol", k."contractAddress", k.chain,
        k.visibility, k."createdAt", k.note,
        e."imageUrl"      AS "imageUrl",
        e."localFilePath" AS "localFilePath",
        e."sha256"        AS "sha256"
       FROM "KolTokenLink" k
       LEFT JOIN "EvidenceSnapshot" e ON e.id = k."evidenceSnapshotId"
      WHERE k."reviewStatus" = 'pending_review' AND k.visibility <> 'public'
      ORDER BY k."createdAt" DESC`,
  )) as Array<Record<string, unknown>>;
  for (const r of links) {
    if (escalated.has(String(r.id))) continue;
    items.push({
      type: ReviewItemType.LINK,
      id: String(r.id),
      imageUrl: (r.imageUrl as string) ?? null,
      localFilePath: (r.localFilePath as string) ?? null,
      imageSha256: (r.sha256 as string) ?? null,
      perceptualHash: null,
      vision: null,
      tokenSymbol: (r.tokenSymbol as string) ?? null,
      contractAddress: (r.contractAddress as string) ?? null,
      chain: (r.chain as string) ?? null,
      kolHandle: (r.kolHandle as string) ?? null,
      perf: null,
      pendingReason: "ATTRIBUTION",
      rejectReason: null,
      claimStatus: "onchain_verified_only",
      trustTier: null,
      decisionReasons: r.note ? [String(r.note)] : [],
      poisoningFlag: false,
      createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : null,
    });
  }

  // ── 3. SignalIntake needs_resolution (signal bridge non résolu) ──────────────
  const signals = (await prisma.$queryRawUnsafe(
    `SELECT
        s.id, s."kolHandle", s."detectedSymbols", s."detectedAddresses",
        s."canonicalChain", s."tokenResolutionStatus", s."rawText", s."createdAt"
       FROM "SignalIntake" s
      WHERE s.status = 'needs_resolution'
      ORDER BY s."createdAt" DESC`,
  )) as Array<Record<string, unknown>>;
  for (const r of signals) {
    if (escalated.has(String(r.id))) continue;
    const symbols = asArray(r.detectedSymbols);
    const addrs = asArray(r.detectedAddresses);
    items.push({
      type: ReviewItemType.SIGNAL,
      id: String(r.id),
      imageUrl: null,
      localFilePath: null,
      imageSha256: null,
      perceptualHash: null,
      vision: null,
      tokenSymbol: symbols[0] ?? null,
      contractAddress: addrs[0] ?? null,
      chain: (r.canonicalChain as string) ?? null,
      kolHandle: (r.kolHandle as string) ?? null,
      perf: null,
      pendingReason: addrs.length === 0 ? "CA_ABSENT" : "MINT_NOT_FOUND",
      rejectReason: null,
      claimStatus: "unverified_submission",
      trustTier: null,
      decisionReasons: r.rawText ? [String(r.rawText).slice(0, 240)] : [],
      poisoningFlag: false,
      createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : null,
    });
  }

  const counts = {
    submissions: items.filter((i) => i.type === ReviewItemType.SUBMISSION).length,
    links: items.filter((i) => i.type === ReviewItemType.LINK).length,
    signals: items.filter((i) => i.type === ReviewItemType.SIGNAL).length,
    total: items.length,
  };

  return { items, counts, submissionSourceLive: submissionLive };
}
