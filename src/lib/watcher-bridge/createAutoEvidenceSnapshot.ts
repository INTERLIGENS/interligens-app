// ─── Watcher Bridge — auto EvidenceSnapshot creation (Sprint 3) ─────────────
//
// For every Watcher SocialPostCandidate carrying a token signal, preserve an
// INTERNAL E1 EvidenceSnapshot so a captured signal is never lost. This is the
// first AUTO DB writer of the Evidence Intake Bridge.
//
// HARD INVARIANTS:
//   • isPublic = false ALWAYS (literal in the INSERT — cannot be flipped here).
//   • reviewStatus = 'internal' — never surfaces on the public scan/Watchlist.
//   • Idempotent by (sourceRefId = candidate.id, sourceType = 'watcher_x_post').
//     A re-run creates zero duplicates.
//
// Raw SQL on purpose: the Sprint-1 columns live in ep-square-band but the
// schema.prod.prisma reflecting them is not on every branch; raw INSERT is
// drift-proof and matches the repo's existing EvidenceSnapshot write pattern.
//
// NOT wired into the cron this sprint — exposed as a function + manual batch.

// Minimal DB surface this module needs (PrismaClient satisfies it).
export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

import type { S3Client } from "@aws-sdk/client-s3";
import type { EvidenceStore } from "../evidence-chain/types";
import { ingestBuffer } from "../evidence-chain/ingest";
import { stableStringify } from "../evidence-chain/manifest";

// Chaîne de preuve (CC-OFFLINE-56, opt-in) : l'artefact d'un candidate est son
// JSON canonique (il n'existe aucun fichier de capture — la source est l'API X).
// capturedAt = discoveredAtUtc (quand NOTRE watcher a récupéré le post) ;
// postedAtUtc reste déclaratif dans l'artefact. timestampMode=at-ingestion.
export interface ChainOpts {
  store: EvidenceStore;
  r2?: { s3: S3Client; bucket: string } | null;
  tsaEnabled?: boolean;
}

const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type AutoEvidenceAction = "created" | "skipped_exists" | "no_signal" | "dry_run" | "not_found";

export interface AutoEvidenceResult {
  candidateId: string;
  action: AutoEvidenceAction;
  snapshotId?: string;
  tokenSymbol?: string | null;
  canonicalMint?: string | null;
}

interface CandidateRow {
  id: string;
  handle: string;
  postUrl: string | null;
  postedAtUtc: Date | null;
  discoveredAtUtc: Date | null;
  toks: string | null; // detectedTokens jsonb ::text
  addrs: string | null; // detectedAddresses text (JSON string)
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

function firstValidMint(addresses: string[]): string | null {
  for (const a of addresses) {
    const t = (a ?? "").trim();
    if (SOL_MINT_RE.test(t)) return t;
  }
  return null;
}

// UTC YYYYMMDD for the session id.
function sessionDateUtc(now: Date): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

const NOTES =
  "Auto-created from Watcher V2. Internal evidence only. Not legal-reviewed.";

// Create one internal E1 EvidenceSnapshot for a SocialPostCandidate.
// Idempotent: skips if a watcher_x_post snapshot already exists for this id.
export async function createAutoEvidenceSnapshot(
  db: RawDb,
  candidateId: string,
  opts: { dryRun?: boolean; now?: Date; chain?: ChainOpts | null } = {},
): Promise<AutoEvidenceResult> {
  const now = opts.now ?? new Date();

  const rows = await db.$queryRawUnsafe<CandidateRow[]>(
    `SELECT c.id, i.handle, c."postUrl", c."postedAtUtc", c."discoveredAtUtc",
            c."detectedTokens"::text AS toks, c."detectedAddresses" AS addrs
       FROM "social_post_candidates" c
       JOIN "influencers" i ON i.id = c."influencerId"
      WHERE c.id = $1
      LIMIT 1`,
    candidateId,
  );
  const cand = rows[0];
  if (!cand) return { candidateId, action: "not_found" };

  const tokens = parseJsonArray(cand.toks);
  const addresses = parseJsonArray(cand.addrs);
  const canonicalMint = firstValidMint(addresses);
  const tokenSymbol = tokens[0] ?? null;

  // No token signal at all → nothing to preserve.
  if (!tokenSymbol && !canonicalMint) {
    return { candidateId, action: "no_signal" };
  }

  // ── Idempotency guard ──────────────────────────────────────────────────
  const existing = await db.$queryRawUnsafe<Array<{ one: number }>>(
    `SELECT 1 AS one FROM "EvidenceSnapshot"
      WHERE "sourceRefId" = $1 AND "sourceType" = 'watcher_x_post'
      LIMIT 1`,
    candidateId,
  );
  if (existing.length > 0) {
    return { candidateId, action: "skipped_exists", tokenSymbol, canonicalMint };
  }

  const symLabel = tokenSymbol ?? "(CA)";
  const relationKey = `${cand.handle}:${tokenSymbol ?? "CA"}`;
  const title = `${cand.handle} × $${symLabel} — Watcher signal`;
  const caption =
    `Auto-captured Watcher V2 X post signal for $${symLabel}` +
    (canonicalMint ? ` (CA ${canonicalMint})` : "") +
    (cand.postUrl ? `. ${cand.postUrl}` : ".");
  const sessionId = `WATCHER_${sessionDateUtc(now)}_AUTO_001`;

  if (opts.dryRun) {
    return { candidateId, action: "dry_run", tokenSymbol, canonicalMint };
  }

  // ── Insert (isPublic=false LITERAL, reviewStatus='internal') ────────────
  const inserted = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "EvidenceSnapshot"
       ("id","relationType","relationKey","snapshotType","title","caption",
        "sourceLabel","sourceUrl","observedAt","isPublic","reviewStatus",
        "kolHandle","tokenSymbol","localFilePath","sha256","sessionId","notes",
        "evidenceLevel","sourceType","sourceRefId","canonicalMint",
        "captureQuality","hashStatus")
     VALUES
       (gen_random_uuid()::text,'kol_token',$1,'watcher_x_post',$2,$3,
        $4,$5,$6,false,'internal',
        $7,$8,NULL,NULL,$9,$10,
        'E1','watcher_x_post',$11,$12,
        'watcher_raw','not_hashed')
     RETURNING id`,
    relationKey,
    title,
    caption,
    "X (Twitter) — Watcher V2 API",
    cand.postUrl,
    cand.postedAtUtc,
    cand.handle,
    tokenSymbol,
    sessionId,
    NOTES,
    candidateId,
    canonicalMint,
  );

  const snapshotId = inserted[0]?.id;

  // ── Chaîne de preuve (opt-in) — artefact JSON canonique du candidate ──
  if (opts.chain && snapshotId) {
    try {
      const artifact = stableStringify({
        kind: "watcher-v2-candidate",
        candidateId: cand.id,
        handle: cand.handle,
        postUrl: cand.postUrl,
        postedAtUtc: cand.postedAtUtc ? cand.postedAtUtc.toISOString() : null,
        discoveredAtUtc: cand.discoveredAtUtc ? cand.discoveredAtUtc.toISOString() : null,
        detectedTokens: tokens,
        detectedAddresses: addresses,
        snapshotId,
      });
      const res = await ingestBuffer(
        {
          buffer: Buffer.from(artifact, "utf8"),
          fileName: `watcher-candidate-${cand.id}.json`,
          mimeType: "application/json",
          sourceType: "X_POST",
          sourceUrl: cand.postUrl,
          capturedAt: cand.discoveredAtUtc ?? null,
          capturedBy: "watcher-v2:x-api",
          captureTool: "watcher-bridge",
          captureToolVersion: "v1",
          provenanceType: "FIRST_PARTY_CAPTURE",
          timestampMode: "at-ingestion",
          notes: `Artefact JSON canonique du SocialPostCandidate (aucun fichier de capture — source X API). postedAtUtc déclaratif ; capturedAt=discoveredAtUtc.`,
          criticality: "OTHER",
        },
        opts.chain.store,
        { r2: opts.chain.r2 ?? null, tsa: opts.chain.tsaEnabled ? { enabled: true } : null, actor: "watcher-bridge" },
      );
      if (!res.duplicate) {
        await opts.chain.store.insertLink({
          evidenceItemId: res.item.id, linkType: "X_API_RECORD",
          externalId: cand.id, externalUrl: cand.postUrl ?? null,
          corroborationLevel: "SINGLE_SOURCE",
        });
        await opts.chain.store.insertLink({
          evidenceItemId: res.item.id, linkType: "MANUAL",
          externalId: snapshotId, externalUrl: null,
        });
      }
    } catch (e) {
      // Jamais bloquant : le snapshot existe, la pièce sera re-chaînée au run suivant
      // (dedup par sha256 de l'artefact canonique).
      console.error("[watcher-bridge] chaîne de preuve non créée (non bloquant):", e instanceof Error ? e.message : e);
    }
  }

  return {
    candidateId,
    action: "created",
    snapshotId,
    tokenSymbol,
    canonicalMint,
  };
}

export interface BatchSummary {
  processed: number;
  created: number;
  skipped_exists: number;
  no_signal: number;
  not_found: number;
  dry_run: number;
  results: AutoEvidenceResult[];
}

// Process a batch. Pass explicit candidateIds, or a limit to pull the most
// recent candidates that carry a token signal. dryRun never writes.
export async function runAutoEvidenceBatch(
  db: RawDb,
  opts: { candidateIds?: string[]; limit?: number; dryRun?: boolean; now?: Date; chain?: ChainOpts | null } = {},
): Promise<BatchSummary> {
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

  const summary: BatchSummary = {
    processed: 0,
    created: 0,
    skipped_exists: 0,
    no_signal: 0,
    not_found: 0,
    dry_run: 0,
    results: [],
  };

  for (const id of ids) {
    const r = await createAutoEvidenceSnapshot(db, id, { dryRun: opts.dryRun, now: opts.now, chain: opts.chain });
    summary.processed++;
    summary[r.action]++;
    summary.results.push(r);
  }
  return summary;
}
