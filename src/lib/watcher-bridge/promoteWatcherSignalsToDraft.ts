// ─── Watcher Bridge — promote qualified signals to DRAFT (Sprint 4, the core) ─
//
// For each Watcher SocialPostCandidate carrying a token signal:
//   • If it clears the auto-promotion threshold AND the canonical resolver
//     (Sprint 2) returns RESOLVED + HIGH + canonicalMint → create a DRAFT
//     KolTokenLink (never public), linked to its Sprint-3 E1 EvidenceSnapshot.
//   • Explicit-CA special case: a valid CA resolved HIGH (method=explicit_ca)
//     may draft even below the priority threshold.
//   • If a token is detected but resolution is AMBIGUOUS/UNRESOLVED/CONFLICT →
//     enqueue a SignalIntake (status='needs_resolution', internal) for manual
//     resolution (admin, Sprint 6). No KolTokenLink is created.
//
// READ + write, idempotent, no public surface. Not wired into the cron.

import { resolveCanonicalToken } from "@/lib/token-resolution/resolveCanonicalToken";
import { createAutoEvidenceSnapshot } from "@/lib/watcher-bridge/createAutoEvidenceSnapshot";
import { createDraftKolTokenLink } from "@/lib/watcher-bridge/createDraftKolTokenLink";
import { advanceCandidateTo, logCandidateEvent } from "@/lib/watcher-bridge/candidateStateMachine";

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export type PromoteAction =
  | "draft_created"
  | "draft_skipped_exists"
  | "needs_resolution_created"
  | "needs_resolution_skipped"
  | "below_threshold"
  | "not_eligible"
  | "no_signal"
  | "not_found";

export interface PromoteResult {
  candidateId: string;
  action: PromoteAction;
  kolHandle?: string;
  symbol?: string | null;
  canonicalMint?: string | null;
  resolutionStatus?: string;
  resolutionMethod?: string;
  draftId?: string;
  signalIntakeId?: string;
  reason?: string;
}

const ELIGIBLE_STATUSES = new Set(["new", "clustered"]);
const HIGH_PRIORITIES = new Set(["HIGH", "CRITICAL"]);

interface CandidateRow {
  id: string;
  handle: string;
  postUrl: string | null;
  postId: string | null;
  status: string;
  signalScore: number | null;
  rawText: string | null;
  campaignId: string | null;
  toks: string | null;
  addrs: string | null;
  postedAtUtc: Date | null;
  camp_priority: string | null;
  camp_kolcount: number | null;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// Postgres text[] literal with each element quoted/escaped.
function toPgTextArray(arr: string[]): string {
  return "{" + arr.map((s) => `"${s.replace(/(["\\])/g, "\\$1")}"`).join(",") + "}";
}

async function ensureEvidenceSnapshotId(db: RawDb, candidateId: string): Promise<string | null> {
  // Sprint 3 is idempotent — ensures the E1 evidence exists, then we read its id.
  await createAutoEvidenceSnapshot(db as never, candidateId);
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "EvidenceSnapshot"
      WHERE "sourceRefId" = $1 AND "sourceType" = 'watcher_x_post'
      ORDER BY "createdAt" ASC LIMIT 1`,
    candidateId,
  );
  return rows[0]?.id ?? null;
}

async function enqueueSignalIntake(
  db: RawDb,
  cand: CandidateRow,
  symbols: string[],
  addresses: string[],
  resolution: { status: string; method: string; confidence: string },
  dryRun: boolean,
): Promise<{ action: "needs_resolution_created" | "needs_resolution_skipped"; id?: string }> {
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "SignalIntake"
      WHERE "sourceRefId" = $1 AND "sourceType" = 'watcher_campaign' LIMIT 1`,
    cand.id,
  );
  if (existing.length > 0) return { action: "needs_resolution_skipped", id: existing[0].id };
  if (dryRun) return { action: "needs_resolution_created" };

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "SignalIntake"
       ("id","sourceType","sourceRefId","status","visibility","rawText",
        "detectedSymbols","detectedAddresses","kolHandle","watcherCampaignId",
        "signalScore","tokenResolutionStatus","tokenResolutionConfidence","tokenResolutionMethod")
     VALUES
       (gen_random_uuid()::text,'watcher_campaign',$1,'needs_resolution','internal',$2,
        $3::text[],$4::text[],$5,$6,
        $7,$8,$9,$10)
     RETURNING id`,
    cand.id,
    cand.rawText,
    toPgTextArray(symbols),
    toPgTextArray(addresses),
    cand.handle,
    cand.campaignId,
    cand.signalScore,
    resolution.status,
    resolution.confidence,
    resolution.method,
  );
  return { action: "needs_resolution_created", id: rows[0]?.id };
}

export async function promoteCandidate(
  db: RawDb,
  candidateId: string,
  opts: { dryRun?: boolean } = {},
): Promise<PromoteResult> {
  const dryRun = !!opts.dryRun;

  const rows = await db.$queryRawUnsafe<CandidateRow[]>(
    `SELECT c.id, i.handle, c."postUrl", c."postId", c.status, c."signalScore",
            c."rawText", c."campaignId",
            c."detectedTokens"::text AS toks, c."detectedAddresses" AS addrs,
            c."postedAtUtc",
            wc.priority AS camp_priority, wc."kolCount" AS camp_kolcount
       FROM "social_post_candidates" c
       JOIN "influencers" i ON i.id = c."influencerId"
       LEFT JOIN "WatcherCampaign" wc ON wc.id = c."campaignId"
      WHERE c.id = $1 LIMIT 1`,
    candidateId,
  );
  const cand = rows[0];
  if (!cand) return { candidateId, action: "not_found" };

  const tokens = parseJsonArray(cand.toks);
  const addresses = parseJsonArray(cand.addrs);
  if (tokens.length === 0 && addresses.length === 0) {
    return { candidateId, action: "no_signal", kolHandle: cand.handle };
  }

  // A.3 — qualifying source.
  if (!ELIGIBLE_STATUSES.has(cand.status) || !cand.postUrl || !cand.postId || !cand.handle) {
    return { candidateId, action: "not_eligible", kolHandle: cand.handle, reason: "status/url/handle gate" };
  }

  // A.1 — auto-promotion threshold.
  const priorityHigh = HIGH_PRIORITIES.has(cand.camp_priority ?? "");
  const scoreHigh = (cand.signalScore ?? 0) >= 70;
  let multiKol = false;
  if ((cand.camp_kolcount ?? 0) >= 2 && cand.campaignId) {
    const avg = await db.$queryRawUnsafe<Array<{ avg: number | null }>>(
      `SELECT avg("signalScore")::float8 AS avg FROM "social_post_candidates" WHERE "campaignId" = $1`,
      cand.campaignId,
    );
    multiKol = (avg[0]?.avg ?? 0) >= 55;
  }
  const thresholdMet = priorityHigh || scoreHigh || multiKol;

  // A.2 — canonical resolution (Sprint 2 service).
  const resolution = await resolveCanonicalToken({
    rawText: cand.rawText ?? undefined,
    extractedCashtags: tokens,
    extractedAddresses: addresses,
    chainHint: "solana",
    postTimestamp: cand.postedAtUtc ?? undefined,
    kolHandle: cand.handle,
    watcherCampaignId: cand.campaignId ?? undefined,
  });

  const resolvedHigh =
    resolution.status === "RESOLVED" &&
    resolution.confidence === "HIGH" &&
    !!resolution.canonicalMint;
  const explicitCaHigh = resolvedHigh && resolution.method === "explicit_ca";

  // C — draft when (threshold OR explicit-CA special case) AND resolved HIGH.
  if (resolvedHigh && (thresholdMet || explicitCaHigh)) {
    const symbol = resolution.symbol || tokens[0] || null;
    const chain = resolution.chain || "SOL";
    if (dryRun) {
      return {
        candidateId, action: "draft_created", kolHandle: cand.handle, symbol,
        canonicalMint: resolution.canonicalMint, resolutionStatus: resolution.status,
        resolutionMethod: resolution.method, reason: "dry_run",
      };
    }
    const evidenceSnapshotId = await ensureEvidenceSnapshotId(db, cand.id);
    const draft = await createDraftKolTokenLink(db, {
      kolHandle: cand.handle,
      canonicalMint: resolution.canonicalMint!,
      canonicalChain: chain,
      symbol,
      watcherCampaignId: cand.campaignId,
      socialPostCandidateId: cand.id,
      evidenceSnapshotId,
    });
    // State machine: draft link created → walk legally to needs_review
    // (new→parsed→clustered→draft_ready→draft_link_created→needs_review).
    // Idempotent on re-run (already at needs_review → no-op).
    await advanceCandidateTo(db, cand.id, "needs_review", "watcher bridge draft promotion");
    return {
      candidateId,
      action: draft.action === "draft_created" ? "draft_created" : "draft_skipped_exists",
      kolHandle: cand.handle, symbol, canonicalMint: resolution.canonicalMint,
      resolutionStatus: resolution.status, resolutionMethod: resolution.method,
      draftId: draft.kolTokenLinkId,
    };
  }

  // B — ambiguous/unresolved/conflict → resolution queue (SignalIntake).
  if (["AMBIGUOUS", "UNRESOLVED", "CONFLICT"].includes(resolution.status)) {
    const r = await enqueueSignalIntake(db, cand, tokens, addresses, resolution, dryRun);
    if (!dryRun) {
      // State machine: clustered → resolution_pending (idempotent on re-run).
      await advanceCandidateTo(db, cand.id, "resolution_pending", `unresolved: ${resolution.status}`);
    }
    return {
      candidateId, action: r.action, kolHandle: cand.handle, symbol: tokens[0] ?? null,
      resolutionStatus: resolution.status, resolutionMethod: resolution.method,
      signalIntakeId: r.id,
    };
  }

  // Resolved HIGH but below threshold and not explicit-CA → no draft. The
  // candidate stays 'clustered' (re-evaluable); the reason is a log annotation.
  if (!dryRun) {
    await advanceCandidateTo(db, cand.id, "clustered", "below_threshold sync");
    await logCandidateEvent(db, cand.id, "below_threshold");
  }
  return {
    candidateId, action: "below_threshold", kolHandle: cand.handle,
    symbol: resolution.symbol ?? tokens[0] ?? null,
    canonicalMint: resolution.canonicalMint, resolutionStatus: resolution.status,
    resolutionMethod: resolution.method,
  };
}

export interface PromoteSummary {
  processed: number;
  draft_created: number;
  draft_skipped_exists: number;
  needs_resolution_created: number;
  needs_resolution_skipped: number;
  below_threshold: number;
  not_eligible: number;
  no_signal: number;
  not_found: number;
  results: PromoteResult[];
}

export async function promoteWatcherSignalsToDraft(
  db: RawDb,
  opts: { candidateIds?: string[]; limit?: number; dryRun?: boolean } = {},
): Promise<PromoteSummary> {
  let ids = opts.candidateIds ?? [];
  if (ids.length === 0 && opts.limit) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "social_post_candidates"
        WHERE jsonb_typeof("detectedTokens") = 'array'
          AND jsonb_array_length("detectedTokens") > 0
        ORDER BY "discoveredAtUtc" DESC
        LIMIT $1`,
      opts.limit,
    );
    ids = rows.map((r) => r.id);
  }

  const summary: PromoteSummary = {
    processed: 0, draft_created: 0, draft_skipped_exists: 0,
    needs_resolution_created: 0, needs_resolution_skipped: 0,
    below_threshold: 0, not_eligible: 0, no_signal: 0, not_found: 0, results: [],
  };
  for (const id of ids) {
    const r = await promoteCandidate(db, id, { dryRun: opts.dryRun });
    summary.processed++;
    summary[r.action]++;
    summary.results.push(r);
  }
  return summary;
}
