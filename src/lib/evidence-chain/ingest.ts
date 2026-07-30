/**
 * Phase 2 — Ingestion. Order: SHA-256 (as-is) → dedup → EvidenceItem → R2 copy
 * → access log. TSA (Phase 3) is attempted but NEVER blocks ingestion.
 * The original file is NEVER modified/cropped/recompressed/annotated.
 */
import { statSync } from "fs";
import { basename, extname } from "path";
import type { S3Client } from "@aws-sdk/client-s3";
import { sha256File } from "./hash";
import { contentAddressedKey, putEvidenceObject } from "./r2";
import { timestampWithRouting, type TsaRouting, type Criticality } from "./tsa";
import type { EvidenceStore, EvidenceItemRecord, EvidenceSourceType } from "./types";
import { readFile } from "fs/promises";

export interface IngestInput {
  filePath: string;
  sourceType: EvidenceSourceType;
  sourceUrl?: string | null;
  casefileId?: string | null;
  capturedAt?: Date | null;
  capturedBy?: string | null;
  captureHost?: string | null;
  captureTool?: string | null;
  captureToolVersion?: string | null;
  mimeType?: string | null;
  notes?: string | null;
  /** P0 routes to the commercial primary TSA; anything else uses the fallback. */
  criticality?: Criticality;
}

export interface IngestOptions {
  r2?: { s3: S3Client; bucket: string } | null;
  tsa?: { enabled?: boolean; routing?: TsaRouting } | null;
  actor?: string;
}

export interface IngestResult {
  item: EvidenceItemRecord;
  duplicate: boolean;
  r2Key: string | null;
  tsa: { attempted: boolean; done: boolean; pending: boolean; provider?: string; tsaUsed?: "primary" | "fallback" };
}

export async function ingestFile(input: IngestInput, store: EvidenceStore, opts: IngestOptions = {}): Promise<IngestResult> {
  const actor = opts.actor ?? null;
  // 1. SHA-256 of the file AS-IS (before any transformation).
  const sha256 = await sha256File(input.filePath);
  const byteSize = statSync(input.filePath).size;

  // 2. Dedup — signalled, never duplicated.
  const existing = await store.findBySha256(sha256);
  if (existing) {
    await store.insertAccessLog(existing.id, "READ", actor, `duplicate ingest skipped for ${basename(input.filePath)}`);
    return { item: existing, duplicate: true, r2Key: existing.r2Key, tsa: { attempted: false, done: !!existing.tsaToken, pending: !existing.tsaToken } };
  }

  // 3. EvidenceItem written.
  const item = await store.insertItem({
    casefileId: input.casefileId ?? null, sha256, filePath: input.filePath, mimeType: input.mimeType ?? null,
    byteSize, sourceType: input.sourceType, sourceUrl: input.sourceUrl ?? null, capturedAt: input.capturedAt ?? null,
    capturedBy: input.capturedBy ?? null, captureHost: input.captureHost ?? null, captureTool: input.captureTool ?? null,
    captureToolVersion: input.captureToolVersion ?? null, notes: input.notes ?? null,
  });

  // 4. Copy to the evidence bucket (content-addressed). Degraded retention: not WORM.
  let r2Key: string | null = null;
  if (opts.r2) {
    r2Key = contentAddressedKey(sha256, extname(input.filePath).replace(/^\./, ""));
    const body = await readFile(input.filePath);
    await putEvidenceObject(opts.r2.s3, opts.r2.bucket, r2Key, body, input.mimeType ?? undefined);
    await store.setR2(item.id, r2Key, false, "degraded:no-object-lock");
    item.r2Key = r2Key;
  }

  // 5. Access log (INGEST).
  await store.insertAccessLog(item.id, "INGEST", actor, `sha256=${sha256} bytes=${byteSize} src=${input.sourceType}`);

  // 3bis (Phase 3) — timestamp; never blocks ingestion.
  const tsaEnabled = opts.tsa?.enabled ?? !!opts.tsa;
  const result: IngestResult = { item, duplicate: false, r2Key, tsa: { attempted: tsaEnabled, done: false, pending: tsaEnabled } };
  if (tsaEnabled) {
    const routed = await timestampWithRouting(sha256, { criticality: input.criticality ?? "OTHER", routing: opts.tsa?.routing });
    if (routed) {
      const { result: ts, tsaUsed } = routed;
      await store.setTsa(item.id, ts.token, ts.provider, ts.genTime, ts.certChainPem);
      item.tsaToken = ts.token; item.tsaProvider = ts.provider; item.tsaTimestampedAt = ts.genTime; item.tsaCertChain = ts.certChainPem;
      await store.insertAccessLog(item.id, "VERIFY", actor, `tsa via ${tsaUsed} (${ts.provider}); cert chain archived`);
      result.tsa = { attempted: true, done: true, pending: false, provider: ts.provider, tsaUsed };
    } else {
      // pending: retry task will pick up rows WHERE tsaToken IS NULL.
      await store.insertAccessLog(item.id, "INGEST", actor, "tsa pending (all authorities unreachable)");
    }
  }
  return result;
}
