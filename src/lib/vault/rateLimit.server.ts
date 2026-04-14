/**
 * In-memory per-workspace rate limiter for vault routes.
 *
 * Not distributed: each serverless instance holds its own bucket map. That's
 * intentional — these limits guard against bulk extraction from a single
 * session, not against globally coordinated abuse. Upstash-backed limits
 * cover the global case elsewhere.
 *
 * The bucket key is `${workspaceId}:${action}`. When a bucket expires it is
 * lazily reset on the next check. `remaining` starts at `limit` and
 * decrements to zero before returning allowed:false.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(
  workspaceId: string,
  action: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const key = `${workspaceId}:${action}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: fresh.resetAt,
      limit,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      limit,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    limit,
  };
}

/**
 * Build a standard 429 response body. Routes can either use this helper or
 * inline their own shape — the contract is `{ error, message, resetAt }`.
 */
export function rateLimitExceededBody(result: RateLimitResult, actionLabel: string) {
  return {
    error: "rate_limit_exceeded",
    message: `${actionLabel} limit reached. Try again later.`,
    resetAt: result.resetAt,
  };
}

/** Test-only helper — resets the in-memory bucket state. */
export function __resetRateLimitsForTest(): void {
  buckets.clear();
}
