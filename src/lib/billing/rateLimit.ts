// Upstash Redis REST rate limiter.
// REST-only (no @upstash/redis SDK) to match the rest of the repo.
//
// Uses INCR + EXPIRE (atomic via PIPELINE) — fixed window.
// Returns { ok, remaining, resetAt } and on Upstash misconfig, FAIL-OPEN with
// a warning. The webhook + payment routes do additional gates (Turnstile,
// cap check) so a momentary Redis outage doesn't break the funnel.

type CheckResult = {
  ok: boolean;
  remaining: number;
  resetAt: number; // unix seconds
  bypass?: "no_url" | "no_token" | "network";
};

export interface RateLimitRule {
  bucket: string; // logical bucket name (e.g. "billing:checkout:ip")
  key: string; // identifying value (ip, email, userId)
  limit: number;
  windowSeconds: number;
}

function url(): string | null {
  return process.env.UPSTASH_REDIS_REST_URL ?? null;
}
function token(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
}

export async function checkRateLimit(rule: RateLimitRule): Promise<CheckResult> {
  const u = url();
  const t = token();
  if (!u) return { ok: true, remaining: rule.limit, resetAt: 0, bypass: "no_url" };
  if (!t) return { ok: true, remaining: rule.limit, resetAt: 0, bypass: "no_token" };

  const fullKey = `rl:${rule.bucket}:${normalize(rule.key)}`;
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + rule.windowSeconds;

  try {
    const res = await fetch(`${u}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", fullKey],
        ["EXPIRE", fullKey, String(rule.windowSeconds), "NX"],
      ]),
    });
    if (!res.ok) return { ok: true, remaining: rule.limit, resetAt, bypass: "network" };
    const json = (await res.json()) as Array<{ result: number | null; error?: string }>;
    const count = typeof json?.[0]?.result === "number" ? (json[0].result as number) : 0;
    if (count > rule.limit) {
      return { ok: false, remaining: 0, resetAt };
    }
    return { ok: true, remaining: Math.max(0, rule.limit - count), resetAt };
  } catch {
    return { ok: true, remaining: rule.limit, resetAt, bypass: "network" };
  }
}

function normalize(s: string): string {
  return s.toLowerCase().trim().slice(0, 256);
}

/**
 * Convenience: apply the three checkout rate limit rules in sequence.
 * Returns the first failure encountered, or ok with the IP rule's remaining.
 */
export async function checkCheckoutRateLimits(input: {
  ip: string;
  email: string;
  userId?: string | null;
}): Promise<CheckResult> {
  const ipRes = await checkRateLimit({
    bucket: "billing:checkout:ip",
    key: input.ip,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!ipRes.ok) return ipRes;

  const emailRes = await checkRateLimit({
    bucket: "billing:checkout:email",
    key: input.email,
    limit: 5,
    windowSeconds: 24 * 60 * 60,
  });
  if (!emailRes.ok) return emailRes;

  if (input.userId) {
    const userRes = await checkRateLimit({
      bucket: "billing:checkout:user",
      key: input.userId,
      limit: 10,
      windowSeconds: 24 * 60 * 60,
    });
    if (!userRes.ok) return userRes;
  }

  return ipRes;
}

export async function checkWaitlistRateLimit(input: { ip: string; email: string }): Promise<CheckResult> {
  const ipRes = await checkRateLimit({
    bucket: "billing:waitlist:ip",
    key: input.ip,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!ipRes.ok) return ipRes;
  return checkRateLimit({
    bucket: "billing:waitlist:email",
    key: input.email,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
}
