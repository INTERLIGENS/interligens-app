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

import { resolveCanonicalToken, type ApiCallTelemetry } from "@/lib/token-resolution/resolveCanonicalToken";
import {
  shadowEnabled,
  startShadow,
  buildShadowComparison,
  emitShadowComparison,
} from "./shadowResolveV3";
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
  | "not_found"
  | "below_liquidity"
  | "kol_cap_skipped"
  | "no_kol_profile"
  | "error";

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
  /** true if a new E1 EvidenceSnapshot was (or in dry-run WOULD be) created. */
  createdEvidenceSnapshot?: boolean;
  /** Resolved token liquidity (USD) when known; null = unknown (RPC-fresh). */
  liquidityUsd?: number | null;
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

// Ensures the E1 evidence exists for a candidate and reports whether a NEW one
// was created. In dryRun mode it writes NOTHING — it only checks existence and
// reports `created` as "would create" (key metric for the dry-run backlog).
async function ensureEvidenceSnapshotId(
  db: RawDb,
  candidateId: string,
  dryRun: boolean,
): Promise<{ id: string | null; created: boolean }> {
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "EvidenceSnapshot"
      WHERE "sourceRefId" = $1 AND "sourceType" = 'watcher_x_post'
      ORDER BY "createdAt" ASC LIMIT 1`,
    candidateId,
  );
  if (existing.length > 0) return { id: existing[0].id, created: false };
  if (dryRun) return { id: null, created: true }; // would be created on a live run
  const r = await createAutoEvidenceSnapshot(db as never, candidateId);
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "EvidenceSnapshot"
      WHERE "sourceRefId" = $1 AND "sourceType" = 'watcher_x_post'
      ORDER BY "createdAt" ASC LIMIT 1`,
    candidateId,
  );
  return { id: rows[0]?.id ?? null, created: r.action === "created" };
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
  opts: { dryRun?: boolean; telemetry?: ApiCallTelemetry; minLiquidityUsd?: number } = {},
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

  // A.2 — canonical resolution (Sprint 2 service). Telemetry counts its DexScreener
  // / Helius calls — done in dry-run too (resolution is real even in dry mode).
  // ─── OMBRE V3 ────────────────────────────────────────────────────────────
  // Lancée AVANT l'await de V1 pour tourner pendant lui, pas après : le hook ne
  // doit rien coûter en temps de mur. Elle ne lève jamais, et son résultat n'est
  // ni lu ni transmis — seulement journalisé. Le chemin V1 ci-dessous est, ligne
  // pour ligne, celui d'avant le hook.
  const shadowPromise = shadowEnabled()
    ? startShadow(
        {
          ticker: tokens[0] ?? null,
          addresses,
          hasRawText: !!cand.rawText,
          observedAt: cand.postedAtUtc ? new Date(cand.postedAtUtc) : null,
        },
        { prisma: db },
      )
    : null;

  const resolution = await resolveCanonicalToken(
    {
      rawText: cand.rawText ?? undefined,
      extractedCashtags: tokens,
      extractedAddresses: addresses,
      chainHint: "solana",
      postTimestamp: cand.postedAtUtc ?? undefined,
      kolHandle: cand.handle,
      watcherCampaignId: cand.campaignId ?? undefined,
    },
    opts.telemetry,
  );

  if (shadowPromise) {
    const shadow = await shadowPromise;
    emitShadowComparison(
      buildShadowComparison({
        input: {
          ticker: tokens[0] ?? null,
          addresses,
          hasRawText: !!cand.rawText,
          observedAt: cand.postedAtUtc ? new Date(cand.postedAtUtc) : null,
        },
        v1: resolution,
        v3: shadow.v3,
        error: shadow.error,
        latencyMs: shadow.latencyMs,
      }),
    );
  }

  const resolvedHigh =
    resolution.status === "RESOLVED" &&
    resolution.confidence === "HIGH" &&
    !!resolution.canonicalMint;
  const explicitCaHigh = resolvedHigh && resolution.method === "explicit_ca";

  // C — draft when (threshold OR explicit-CA special case) AND resolved HIGH.
  if (resolvedHigh && (thresholdMet || explicitCaHigh)) {
    const symbol = resolution.symbol || tokens[0] || null;
    const chain = resolution.chain || "SOL";

    // Liquidity floor (S4.5). Skip the draft if the resolved token's liquidity is
    // below the floor — OR unknown (explicit_ca confirmed on-chain via RPC, no
    // DexScreener pair yet = fresh pump.fun). The fresh-illiquid case is a
    // SEPARATE PRIORITY BACKLOG (launch rugs the anti-scam must catch early) —
    // see BACKLOG_fresh_illiquid_explicit_ca.md — counted, never silently lost.
    if (opts.minLiquidityUsd != null) {
      const liq = resolution.candidates[0]?.liquidityUsd ?? null;
      if (liq == null || liq < opts.minLiquidityUsd) {
        const freshIlliquid = liq == null && resolution.method === "explicit_ca";
        return {
          candidateId, action: "below_liquidity", kolHandle: cand.handle, symbol,
          canonicalMint: resolution.canonicalMint, resolutionStatus: resolution.status,
          resolutionMethod: resolution.method, liquidityUsd: liq,
          reason: freshIlliquid
            ? "fresh_illiquid_explicit_ca"
            : `liquidity ${liq ?? "unknown"} < ${opts.minLiquidityUsd}`,
        };
      }
    }

    // Compute evidence existence in BOTH modes (dry = "would create", no write).
    const ev = await ensureEvidenceSnapshotId(db, cand.id, dryRun);
    if (dryRun) {
      return {
        candidateId, action: "draft_created", kolHandle: cand.handle, symbol,
        canonicalMint: resolution.canonicalMint, resolutionStatus: resolution.status,
        resolutionMethod: resolution.method, createdEvidenceSnapshot: ev.created,
        reason: "dry_run",
      };
    }
    const draft = await createDraftKolTokenLink(db, {
      kolHandle: cand.handle,
      canonicalMint: resolution.canonicalMint!,
      canonicalChain: chain,
      symbol,
      watcherCampaignId: cand.campaignId,
      socialPostCandidateId: cand.id,
      evidenceSnapshotId: ev.id,
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
      draftId: draft.kolTokenLinkId, createdEvidenceSnapshot: ev.created,
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

export interface PromoteOptions {
  candidateIds?: string[];
  dryRun?: boolean;
  limit?: number;                       // default 25, strictly enforced
  minPriority?: "HIGH" | "CRITICAL";    // campaign priority floor
  maxAgeDays?: number;                  // only candidates posted within N days
  onlyUnprocessed?: boolean;            // default true: status IN (new, clustered)
  stopOnError?: boolean;                // default false: log error, continue
  // ── S4.5 threshold hardening ──
  requireMultiKol?: boolean;            // campaign kolCount >= 2 (master lever)
  minLiquidityUsd?: number;             // resolved token liquidity floor (USD)
  maxPerKol?: number;                   // max drafts per KOL per run (anti-saturation)
}

export interface PromoteSummary {
  selected: number;                     // candidates that ENTERED the loop (post-SQL, ≤ limit)
  processed: number;                    // selected minus kolCapSkipped (ran promoteCandidate)
  createdEvidenceSnapshots: number;
  createdDraftLinks: number;
  alreadyExistingSkipped: number;
  ambiguous: number;
  unresolved: number;
  conflict: number;
  lowPrioritySkipped: number;           // SQL-excluded: priority < minPriority
  singleKolSkipped: number;             // SQL-excluded: kolCount < 2 (requireMultiKol)
  belowLiquiditySkipped: number;        // gate-excluded: liquidity < floor or unknown
  freshIlliquidExplicitCa: number;      // of belowLiquidity: explicit_ca + liquidity null
  kolCapSkipped: number;                // loop-excluded: KOL already at maxPerKol
  noKolProfileSkipped: number;          // loop-excluded: no KolProfile row for the handle
  errors: number;
  durationMs: number;
  apiCallsDexScreener: number;
  apiCallsHelius: number;
  actionCounts: Record<string, number>; // raw per-action tally (every selected id → 1 bucket)
  results: PromoteResult[];
}

export async function promoteWatcherSignalsToDraft(
  db: RawDb,
  opts: PromoteOptions = {},
): Promise<PromoteSummary> {
  const startedAt = Date.now();
  const dryRun = !!opts.dryRun;
  const stopOnError = !!opts.stopOnError;
  const limit = Math.max(0, opts.limit ?? 25);
  const onlyUnprocessed = opts.onlyUnprocessed !== false; // default true
  const requireMultiKol = !!opts.requireMultiKol;
  const telemetry: ApiCallTelemetry = { dexScreener: 0, helius: 0 };

  let ids = opts.candidateIds ?? [];
  let lowPrioritySkipped = 0;
  let singleKolSkipped = 0;

  if (ids.length > 0) {
    ids = ids.slice(0, limit); // limit strictly enforced even for explicit ids
  } else {
    const conds: string[] = [
      `jsonb_typeof(c."detectedTokens") = 'array'`,
      `jsonb_array_length(c."detectedTokens") > 0`,
      // Sans KolProfile, l'INSERT KolTokenLink violerait la FK : le candidat ne
      // peut RIEN produire. La garde de boucle plus bas le rattrape aussi, mais
      // l'exclure ici est ce qui permet au job de DRAINER : sinon ces candidats
      // (1091 au 2026-08-14) consomment les slots de `limit` à chaque run et le
      // backlog ne descend jamais. La garde de boucle reste le filet pour le
      // chemin `candidateIds` explicite, qui ne passe pas par ce SELECT.
      `EXISTS (SELECT 1 FROM "KolProfile" p WHERE p.handle = i.handle)`,
    ];
    const params: unknown[] = [];
    if (onlyUnprocessed) conds.push(`c.status IN ('new','clustered')`);
    if (opts.maxAgeDays != null) {
      params.push(opts.maxAgeDays);
      conds.push(`coalesce(c."postedAtUtc", c."discoveredAtUtc") >= now() - ($${params.length} || ' days')::interval`);
    }
    const baseWhere = conds.join(" AND ");

    // minPriority — controlled enum, safe to inline. Tally lowPrioritySkipped
    // (within the base pool, regardless of the multi-kol filter).
    let priorityClause = "";
    if (opts.minPriority) {
      const allowed = opts.minPriority === "CRITICAL" ? "('CRITICAL')" : "('HIGH','CRITICAL')";
      priorityClause = ` AND wc.priority IN ${allowed}`;
      const skip = await db.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int n FROM "social_post_candidates" c
           JOIN "influencers" i ON i.id = c."influencerId"
           LEFT JOIN "WatcherCampaign" wc ON wc.id = c."campaignId"
          WHERE ${baseWhere} AND (wc.priority IS NULL OR wc.priority NOT IN ${allowed})`,
        ...params,
      );
      lowPrioritySkipped = skip[0]?.n ?? 0;
    }

    // requireMultiKol — campaign kolCount >= 2. Tally singleKolSkipped: candidates
    // that pass base+priority but whose campaign has < 2 distinct KOLs.
    let multiKolClause = "";
    if (requireMultiKol) {
      multiKolClause = ` AND coalesce(wc."kolCount", 0) >= 2`;
      const skip = await db.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int n FROM "social_post_candidates" c
           JOIN "influencers" i ON i.id = c."influencerId"
           LEFT JOIN "WatcherCampaign" wc ON wc.id = c."campaignId"
          WHERE ${baseWhere}${priorityClause} AND coalesce(wc."kolCount", 0) < 2`,
        ...params,
      );
      singleKolSkipped = skip[0]?.n ?? 0;
    }

    params.push(limit);
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT c.id FROM "social_post_candidates" c
         JOIN "influencers" i ON i.id = c."influencerId"
         LEFT JOIN "WatcherCampaign" wc ON wc.id = c."campaignId"
        WHERE ${baseWhere}${priorityClause}${multiKolClause}
        ORDER BY c."discoveredAtUtc" DESC
        LIMIT $${params.length}`,
      ...params,
    );
    ids = rows.map((r) => r.id);
  }

  // Resolve handles for the per-KOL cap (works for both selection + explicit ids).
  const idToHandle = new Map<string, string>();
  if (ids.length > 0) {
    const hrows = await db.$queryRawUnsafe<Array<{ id: string; handle: string }>>(
      `SELECT c.id, i.handle FROM "social_post_candidates" c
         JOIN "influencers" i ON i.id = c."influencerId"
        WHERE c.id = ANY($1::text[])`,
      toPgTextArray(ids),
    );
    for (const r of hrows) idToHandle.set(r.id, r.handle);
  }

  // ── Pré-filtre KolProfile (cause racine des 3 erreurs FK du 2026-06-29) ────
  // Le bridge lit le handle depuis `influencers` (watchlist du watcher) mais
  // KolTokenLink.kolHandle porte une FK vers KolProfile(handle). Les deux
  // populations ne coïncident pas : un influencer sans KolProfile faisait
  // remonter une violation 23503 depuis l'INSERT, comptée en `errors` — un
  // écart de données présenté comme une panne.
  //
  // On résout l'existence en UN seul SELECT sur le lot, et on saute le
  // candidat AVANT promoteCandidate — donc avant resolveCanonicalToken, qui
  // consomme DexScreener/Helius. Un candidat sans KolProfile ne peut produire
  // aucun lien : payer une résolution pour lui est du gaspillage pur.
  //
  // Choix délibéré : on NE crée PAS le KolProfile manquant. Publier un profil
  // KOL est une décision éditoriale humaine, pas un effet de bord de cron.
  // Le compteur noKolProfileSkipped rend l'écart visible pour arbitrage.
  const knownKolProfiles = new Set<string>();
  if (idToHandle.size > 0) {
    const prows = await db.$queryRawUnsafe<Array<{ handle: string }>>(
      `SELECT handle FROM "KolProfile" WHERE handle = ANY($1::text[])`,
      toPgTextArray([...new Set(idToHandle.values())]),
    );
    for (const r of prows) knownKolProfiles.add(r.handle);
  }

  const summary: PromoteSummary = {
    selected: ids.length, processed: 0, createdEvidenceSnapshots: 0, createdDraftLinks: 0,
    alreadyExistingSkipped: 0, ambiguous: 0, unresolved: 0, conflict: 0,
    lowPrioritySkipped, singleKolSkipped, belowLiquiditySkipped: 0, freshIlliquidExplicitCa: 0,
    kolCapSkipped: 0, noKolProfileSkipped: 0, errors: 0, durationMs: 0,
    apiCallsDexScreener: 0, apiCallsHelius: 0, actionCounts: {}, results: [],
  };

  const kolDraftCount = new Map<string, number>();

  for (const id of ids) {
    const handle = idToHandle.get(id) ?? null;

    // KolProfile absent — pre-check BEFORE promoteCandidate (skips processing +
    // API). Sans profil, l'INSERT KolTokenLink violerait la FK : on sort
    // proprement au lieu de laisser remonter une 23503.
    if (handle && !knownKolProfiles.has(handle)) {
      summary.noKolProfileSkipped++;
      summary.actionCounts["no_kol_profile"] = (summary.actionCounts["no_kol_profile"] ?? 0) + 1;
      summary.results.push({
        candidateId: id,
        action: "no_kol_profile",
        kolHandle: handle,
        reason: "no KolProfile row — KolTokenLink.kolHandle FK would fail",
      });
      continue;
    }

    // Per-KOL cap — pre-check BEFORE promoteCandidate (skips processing + API).
    if (opts.maxPerKol != null && handle && (kolDraftCount.get(handle) ?? 0) >= opts.maxPerKol) {
      summary.kolCapSkipped++;
      summary.actionCounts["kol_cap_skipped"] = (summary.actionCounts["kol_cap_skipped"] ?? 0) + 1;
      summary.results.push({ candidateId: id, action: "kol_cap_skipped", kolHandle: handle });
      continue;
    }

    try {
      const r = await promoteCandidate(db, id, { dryRun, telemetry, minLiquidityUsd: opts.minLiquidityUsd });
      summary.processed++;
      summary.actionCounts[r.action] = (summary.actionCounts[r.action] ?? 0) + 1;
      if (r.action === "draft_created") {
        summary.createdDraftLinks++;
        if (handle) kolDraftCount.set(handle, (kolDraftCount.get(handle) ?? 0) + 1);
      }
      if (r.action === "draft_skipped_exists" || r.action === "needs_resolution_skipped") {
        summary.alreadyExistingSkipped++;
      }
      if (r.action === "below_liquidity") {
        summary.belowLiquiditySkipped++;
        if (r.reason === "fresh_illiquid_explicit_ca") summary.freshIlliquidExplicitCa++;
      }
      if (r.createdEvidenceSnapshot) summary.createdEvidenceSnapshots++;
      if (r.action === "needs_resolution_created" || r.action === "needs_resolution_skipped") {
        if (r.resolutionStatus === "AMBIGUOUS") summary.ambiguous++;
        else if (r.resolutionStatus === "CONFLICT") summary.conflict++;
        else summary.unresolved++;
      }
      summary.results.push(r);
    } catch (e) {
      summary.errors++;
      summary.actionCounts["error"] = (summary.actionCounts["error"] ?? 0) + 1;
      summary.results.push({
        candidateId: id, action: "error",
        reason: e instanceof Error ? e.message : String(e),
      });
      if (stopOnError) break; // stop the batch (errors already recorded)
    }
  }

  summary.apiCallsDexScreener = telemetry.dexScreener;
  summary.apiCallsHelius = telemetry.helius;
  summary.durationMs = Date.now() - startedAt;
  return summary;
}
