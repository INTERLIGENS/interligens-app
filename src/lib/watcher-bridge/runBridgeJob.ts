// ─── Watcher Bridge — cron safety layer (job runner) ────────────────────────
//
// Env-gated wrapper around promoteWatcherSignalsToDraft. NOT wired into a cron
// yet — this is the control layer the cron will eventually call.
//
// Kill switch: WATCHER_BRIDGE_ENABLED (default false). When not enabled the job
// is a NO-OP but STILL writes one JobRunLog row with status='disabled' — so a
// disabled run is visible in the audit, not a silent skip.
//
// Defaults from env: WATCHER_BRIDGE_LIMIT (25), WATCHER_BRIDGE_MIN_PRIORITY
// (HIGH), WATCHER_BRIDGE_DRY_RUN. dryRun writes NOTHING except this run's own
// JobRunLog row.

import {
  promoteWatcherSignalsToDraft,
  type PromoteSummary,
  type PromoteOptions,
} from "@/lib/watcher-bridge/promoteWatcherSignalsToDraft";

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

const JOB_NAME = "watcher_bridge_promote";

export type BridgeJobStatus = "success" | "error" | "disabled";

export interface BridgeJobResult {
  jobRunLogId: string | null;
  status: BridgeJobStatus;
  dryRun: boolean;
  summary: PromoteSummary | null;
  reason?: string;
}

function envBool(v: string | undefined, def: boolean): boolean {
  if (v == null || v === "") return def;
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

async function insertJobRunLog(
  db: RawDb,
  row: { dryRun: boolean; status: BridgeJobStatus | "running"; limitN: number; finished: boolean },
): Promise<string> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "JobRunLog" ("jobName","dryRun","status","limitN","finishedAt")
     VALUES ($1,$2,$3,$4, ${row.finished ? "now()" : "NULL"})
     RETURNING id`,
    JOB_NAME,
    row.dryRun,
    row.status,
    row.limitN,
  );
  return rows[0]?.id ?? "";
}

async function finishJobRunLog(
  db: RawDb,
  id: string,
  status: BridgeJobStatus,
  summary: PromoteSummary | null,
): Promise<void> {
  await db.$queryRawUnsafe(
    `UPDATE "JobRunLog"
        SET status = $2, "finishedAt" = now(),
            "processed" = $3, "createdDrafts" = $4, "ambiguous" = $5,
            "conflicts" = $6, "errors" = $7, "summaryJson" = $8::jsonb
      WHERE id = $1`,
    id,
    status,
    summary?.processed ?? 0,
    summary?.createdDraftLinks ?? 0,
    summary?.ambiguous ?? 0,
    summary?.conflict ?? 0,
    summary?.errors ?? 0,
    JSON.stringify(summary ?? {}),
  );
}

export async function runBridgeJob(
  db: RawDb,
  overrides: Partial<PromoteOptions> = {},
): Promise<BridgeJobResult> {
  const enabled = envBool(process.env.WATCHER_BRIDGE_ENABLED, false);
  const dryRun = overrides.dryRun ?? envBool(process.env.WATCHER_BRIDGE_DRY_RUN, false);
  const limit = overrides.limit ?? parseInt(process.env.WATCHER_BRIDGE_LIMIT ?? "25", 10);
  const minPriorityEnv = (process.env.WATCHER_BRIDGE_MIN_PRIORITY ?? "HIGH").toUpperCase();
  const minPriority: "HIGH" | "CRITICAL" =
    overrides.minPriority ?? (minPriorityEnv === "CRITICAL" ? "CRITICAL" : "HIGH");

  // ── Kill switch ──────────────────────────────────────────────────────────
  if (!enabled) {
    const id = await insertJobRunLog(db, { dryRun, status: "disabled", limitN: limit, finished: true });
    return {
      jobRunLogId: id,
      status: "disabled",
      dryRun,
      summary: null,
      reason: "WATCHER_BRIDGE_ENABLED is not true — job disabled (no-op)",
    };
  }

  const runId = await insertJobRunLog(db, { dryRun, status: "running", limitN: limit, finished: false });
  try {
    const summary = await promoteWatcherSignalsToDraft(db, {
      ...overrides,
      dryRun,
      limit,
      minPriority,
      onlyUnprocessed: overrides.onlyUnprocessed ?? true,
    });
    await finishJobRunLog(db, runId, "success", summary);
    return { jobRunLogId: runId, status: "success", dryRun, summary };
  } catch (e) {
    await finishJobRunLog(db, runId, "error", null);
    return {
      jobRunLogId: runId,
      status: "error",
      dryRun,
      summary: null,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
