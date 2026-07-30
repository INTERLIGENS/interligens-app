/**
 * Phase 4 — X API attachment. From a handle + capture time, return candidate
 * Watcher V2 records (social_post_candidates) in a time window. The operator
 * batch-validates AFTER capture → EvidenceLink rows. Zero extra clicks during
 * collection. READ-ONLY on the watcher tables (no writes there).
 */
import type { EvidenceStore, EvidenceLinkRecord, CorroborationLevel } from "./types";

export interface WatcherCandidate {
  candidateId: string;
  postId: string;
  postUrl: string;
  handle: string;
  postedAtUtc: Date | null;
  discoveredAtUtc: Date;
  snippet: string;
}

export interface RawSqlDb {
  $queryRawUnsafe<T = unknown>(query: string, ...args: unknown[]): Promise<T>;
}

/** Candidate watcher posts for a handle within ±windowHours of the capture. */
export async function findWatcherCandidates(
  db: RawSqlDb,
  opts: { handle: string; capturedAt: Date; windowHours?: number },
): Promise<WatcherCandidate[]> {
  const windowMs = (opts.windowHours ?? 48) * 3_600_000;
  const from = new Date(opts.capturedAt.getTime() - windowMs);
  const to = new Date(opts.capturedAt.getTime() + windowMs);
  const rows = await db.$queryRawUnsafe<Array<{
    id: string; postId: string; postUrl: string; handle: string;
    postedAtUtc: Date | null; discoveredAtUtc: Date; snippet: string | null;
  }>>(
    `SELECT spc.id AS "id", spc."postId" AS "postId", spc."postUrl" AS "postUrl",
            inf.handle AS "handle", spc."postedAtUtc" AS "postedAtUtc",
            spc."discoveredAtUtc" AS "discoveredAtUtc", LEFT(spc."rawText", 140) AS "snippet"
       FROM social_post_candidates spc
       JOIN influencers inf ON inf.id = spc."influencerId"
      WHERE LOWER(inf.handle) = LOWER($1)
        AND spc."sourceProvider" = 'x_api_v2'
        AND spc."postedAtUtc" BETWEEN $2 AND $3
      ORDER BY spc."postedAtUtc" ASC`,
    opts.handle, from, to,
  );
  return rows.map((r) => ({
    candidateId: r.id, postId: r.postId, postUrl: r.postUrl, handle: r.handle,
    postedAtUtc: r.postedAtUtc ? new Date(r.postedAtUtc) : null,
    discoveredAtUtc: new Date(r.discoveredAtUtc), snippet: r.snippet ?? "",
  }));
}

/** Operator-approved batch → EvidenceLink rows (X_API_RECORD). */
export async function createLinksFromCandidates(
  evidenceItemId: string,
  candidates: WatcherCandidate[],
  store: EvidenceStore,
  opts: { corroborationLevel?: CorroborationLevel; actor?: string | null } = {},
): Promise<EvidenceLinkRecord[]> {
  const level: CorroborationLevel = opts.corroborationLevel ?? (candidates.length > 1 ? "CORROBORATED" : "SINGLE_SOURCE");
  const out: EvidenceLinkRecord[] = [];
  for (const c of candidates) {
    const link = await store.insertLink({
      evidenceItemId, linkType: "X_API_RECORD", externalId: c.postId, externalUrl: c.postUrl, corroborationLevel: level,
    });
    await store.insertAccessLog(evidenceItemId, "LINK", opts.actor ?? null, `X_API_RECORD post=${c.postId}`);
    out.push(link);
  }
  return out;
}
