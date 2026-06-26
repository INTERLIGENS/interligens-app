// ─── Watcher Bridge — SocialPostCandidate state machine (Sprint 5) ──────────
//
// A real lifecycle for each Watcher signal in the bridge. Transitions are
// written by the bridge (Sprint 4) and later by the admin (Sprint 6-7). Every
// transition is validated against ALLOWED_TRANSITIONS and audited in
// CandidateStatusLog. Illegal transition → throw, NO write. Idempotent: a
// transition into the current status is a no-op.
//
// Flow:
//   new → parsed → clustered ─┬→ resolution_pending
//                             └→ draft_ready → draft_link_created → needs_review
//                                ┌→ approved_public → archived
//   needs_review ──────────────┤
//                                └→ rejected
//
// below_threshold is NOT a state — a clustered candidate that misses the
// promotion bar stays 'clustered' and the reason is recorded as a log
// annotation (logCandidateEvent), so it stays re-evaluable.

export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export type CandidateStatus =
  | "new"
  | "parsed"
  | "clustered"
  | "resolution_pending"
  | "draft_ready"
  | "draft_link_created"
  | "needs_review"
  | "approved_public"
  | "rejected"
  | "archived";

// The ONLY authorized transitions. Anything else is illegal.
export const ALLOWED_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  new: ["parsed"],
  parsed: ["clustered"],
  clustered: ["resolution_pending", "draft_ready"],
  resolution_pending: [], // terminal this sprint (admin opens it in Sprint 6)
  draft_ready: ["draft_link_created"],
  draft_link_created: ["needs_review"],
  needs_review: ["approved_public", "rejected"],
  approved_public: ["archived"],
  rejected: [], // terminal
  archived: [], // terminal
};

export function isAllowedTransition(from: CandidateStatus, to: CandidateStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(public from: string, public to: string) {
    super(`Illegal candidate transition: ${from} → ${to} (not in ALLOWED_TRANSITIONS)`);
    this.name = "IllegalTransitionError";
  }
}
export class StaleStatusError extends Error {
  constructor(public expected: string, public actual: string) {
    super(`Stale fromStatus: expected ${expected} but candidate is ${actual}`);
    this.name = "StaleStatusError";
  }
}

export type TransitionAction = "transitioned" | "noop" | "not_found";
export interface TransitionResult {
  candidateId: string;
  action: TransitionAction;
  from?: string;
  to?: string;
}

const DEFAULT_ACTOR = "watcher_bridge";

async function currentStatus(db: RawDb, candidateId: string): Promise<string | null> {
  const rows = await db.$queryRawUnsafe<Array<{ status: string }>>(
    `SELECT status FROM "social_post_candidates" WHERE id = $1 LIMIT 1`,
    candidateId,
  );
  return rows[0]?.status ?? null;
}

async function writeLog(
  db: RawDb,
  candidateId: string,
  from: string,
  to: string,
  reason: string | null,
  actorId: string,
): Promise<void> {
  await db.$queryRawUnsafe(
    `INSERT INTO "CandidateStatusLog"
       ("candidateId","fromStatus","toStatus","reason","actorId")
     VALUES ($1,$2,$3,$4,$5)`,
    candidateId,
    from,
    to,
    reason,
    actorId,
  );
}

// Single validated hop. Idempotent (current === to → noop). Illegal or stale →
// throws, no write.
export async function transitionCandidate(
  db: RawDb,
  candidateId: string,
  fromStatus: CandidateStatus,
  toStatus: CandidateStatus,
  reason?: string,
  actorId: string = DEFAULT_ACTOR,
): Promise<TransitionResult> {
  const current = await currentStatus(db, candidateId);
  if (current === null) return { candidateId, action: "not_found" };

  // Idempotence: already at the target.
  if (current === toStatus) return { candidateId, action: "noop", from: current, to: toStatus };

  if (current !== fromStatus) throw new StaleStatusError(fromStatus, current);
  if (!isAllowedTransition(fromStatus, toStatus)) throw new IllegalTransitionError(fromStatus, toStatus);

  // Optimistic write guarded by the expected current status.
  const updated = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "social_post_candidates" SET status = $2, "updatedAt" = now()
      WHERE id = $1 AND status = $3 RETURNING id`,
    candidateId,
    toStatus,
    fromStatus,
  );
  if (updated.length === 0) {
    // Lost a race; re-read and treat a concurrent arrival at target as noop.
    const now = await currentStatus(db, candidateId);
    if (now === toStatus) return { candidateId, action: "noop", from: fromStatus, to: toStatus };
    throw new StaleStatusError(fromStatus, now ?? "unknown");
  }
  await writeLog(db, candidateId, fromStatus, toStatus, reason ?? null, actorId);
  return { candidateId, action: "transitioned", from: fromStatus, to: toStatus };
}

// BFS shortest legal path from the current status to `target`, applying each hop.
// Idempotent (already at target → noop). No legal path → throws.
export async function advanceCandidateTo(
  db: RawDb,
  candidateId: string,
  target: CandidateStatus,
  reason?: string,
  actorId: string = DEFAULT_ACTOR,
): Promise<{ candidateId: string; action: "advanced" | "noop" | "not_found"; from?: string; to?: string; hops?: string[] }> {
  const start = await currentStatus(db, candidateId);
  if (start === null) return { candidateId, action: "not_found" };
  if (start === target) return { candidateId, action: "noop", from: start, to: target };

  // BFS over ALLOWED_TRANSITIONS.
  const prev = new Map<string, string>();
  const queue: string[] = [start];
  const seen = new Set<string>([start]);
  let found = false;
  while (queue.length) {
    const node = queue.shift()!;
    if (node === target) { found = true; break; }
    for (const next of ALLOWED_TRANSITIONS[node as CandidateStatus] ?? []) {
      if (!seen.has(next)) { seen.add(next); prev.set(next, node); queue.push(next); }
    }
  }
  if (!found) throw new Error(`No legal path from ${start} to ${target} for candidate ${candidateId}`);

  // Reconstruct path.
  const path: string[] = [target];
  let cur = target as string;
  while (cur !== start) { cur = prev.get(cur)!; path.unshift(cur); }

  const hops: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    await transitionCandidate(db, candidateId, path[i] as CandidateStatus, path[i + 1] as CandidateStatus, reason, actorId);
    hops.push(`${path[i]}→${path[i + 1]}`);
  }
  return { candidateId, action: "advanced", from: start, to: target, hops };
}

// Audit annotation WITHOUT a state change (e.g. reason='below_threshold'). The
// candidate stays in its current status. Idempotent: skips if the same
// (status, reason) annotation already exists for this candidate.
export async function logCandidateEvent(
  db: RawDb,
  candidateId: string,
  reason: string,
  actorId: string = DEFAULT_ACTOR,
): Promise<{ action: "logged" | "noop" | "not_found" }> {
  const current = await currentStatus(db, candidateId);
  if (current === null) return { action: "not_found" };
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "CandidateStatusLog"
      WHERE "candidateId" = $1 AND "toStatus" = $2 AND "fromStatus" = $2 AND "reason" = $3 LIMIT 1`,
    candidateId,
    current,
    reason,
  );
  if (existing.length > 0) return { action: "noop" };
  await writeLog(db, candidateId, current, current, reason, actorId);
  return { action: "logged" };
}
