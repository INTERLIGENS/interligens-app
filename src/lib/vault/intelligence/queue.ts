/**
 * In-memory per-case orchestration queue.
 *
 * v1 limitation: this state lives in the Node process, so on Vercel it is
 * per-lambda-instance. Two concurrent lambdas CAN both run a job for the
 * same case. The DB-level soft lock (VaultCaseIntelligenceSummary
 * orchestrationStatus = "RUNNING") covers that gap — see orchestrator.ts.
 *
 * The queue guarantees:
 *   - Max 1 active in-process job per case
 *   - 500ms debounce coalescing bursty triggers into one run
 *   - rerunRequested flag: if a trigger arrives mid-run, schedule one more
 *     pass after the current one finishes, merging the incoming trigger.
 */

import type {
  OrchestratorInput,
  OrchestratorResult,
} from "./types";

const DEBOUNCE_MS = 500;

type Job = {
  runner: (input: OrchestratorInput) => Promise<OrchestratorResult>;
  pending: OrchestratorInput;
  debounceTimer: NodeJS.Timeout | null;
  active: boolean;
  rerunRequested: OrchestratorInput | null;
  resolvers: Array<(r: OrchestratorResult) => void>;
};

const jobs = new Map<string, Job>();

export async function enqueueOrchestration(
  input: OrchestratorInput,
  runner: (input: OrchestratorInput) => Promise<OrchestratorResult>
): Promise<OrchestratorResult> {
  return new Promise<OrchestratorResult>((resolve) => {
    const key = input.caseId;
    const existing = jobs.get(key);

    if (existing) {
      // Coalesce the incoming trigger with the pending one.
      existing.pending = coalesce(existing.pending, input);
      existing.resolvers.push(resolve);

      if (existing.active) {
        // Mid-run — remember that we need one more pass.
        existing.rerunRequested = existing.rerunRequested
          ? coalesce(existing.rerunRequested, input)
          : input;
        return;
      }

      // Not running yet — restart debounce timer.
      if (existing.debounceTimer) clearTimeout(existing.debounceTimer);
      existing.debounceTimer = setTimeout(
        () => fire(key),
        DEBOUNCE_MS
      );
      return;
    }

    const job: Job = {
      runner,
      pending: input,
      debounceTimer: setTimeout(() => fire(key), DEBOUNCE_MS),
      active: false,
      rerunRequested: null,
      resolvers: [resolve],
    };
    jobs.set(key, job);
  });
}

function coalesce(
  a: OrchestratorInput,
  b: OrchestratorInput
): OrchestratorInput {
  // Priority: LEAD_ADDED (full fanout) beats everything else.
  const priority: Record<OrchestratorInput["triggerType"], number> = {
    LEAD_ADDED: 5,
    MANUAL_ENGINE_RUN: 4,
    EVIDENCE_ADDED: 3,
    NOTE_ADDED: 2,
    CASE_OPENED: 1,
  };
  const winner = priority[a.triggerType] >= priority[b.triggerType] ? a : b;
  return {
    ...winner,
    // Prefer the most recent entityId if the winner lost it.
    entityId: winner.entityId ?? b.entityId ?? a.entityId,
  };
}

async function fire(key: string): Promise<void> {
  const job = jobs.get(key);
  if (!job) return;
  job.debounceTimer = null;
  if (job.active) return;
  job.active = true;

  let result: OrchestratorResult;
  try {
    result = await job.runner(job.pending);
  } catch (err) {
    result = {
      success: false,
      eventsCreated: 0,
      error: err instanceof Error ? err.message : "orchestrator_failed",
    };
  }

  // Drain waiters with the result of THIS run.
  const resolvers = job.resolvers;
  job.resolvers = [];
  for (const r of resolvers) r(result);

  const rerun = job.rerunRequested;
  job.rerunRequested = null;

  if (rerun) {
    // Schedule the rerun with a fresh debounce so any further triggers
    // arriving in the next 500ms still merge in.
    job.active = false;
    job.pending = rerun;
    job.debounceTimer = setTimeout(() => fire(key), DEBOUNCE_MS);
    return;
  }

  // Done — release the slot.
  jobs.delete(key);
}

// Exposed for tests only.
export const __queueInternals = { jobs };
