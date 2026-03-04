/**
 * Sliding window rate limiter — in-memory (dev) + Upstash Redis (prod).
 *
 * Prod: définir UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN dans Vercel env.
 * Sans ces vars, store en mémoire (ne persiste pas entre lambdas serverless).
 *
 * Usage dans une route:
 *   const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.pdf);
 *   if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));
 */

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number; // secondes (0 si allowed)
  resetAt: number;    // timestamp ms
}

export const RATE_LIMIT_PRESETS = {
  /** Puppeteer PDF — 10 req / 5 min / IP */
  pdf:   { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "rl:pdf"   },
  /** Scans on-chain — 20 req / 1 min / IP */
  scan:  { windowMs:     60 * 1000, max: 20, keyPrefix: "rl:scan"  },
  /** OSINT / watchlist — 30 req / 1 min / IP */
  osint: { windowMs:     60 * 1000, max: 30, keyPrefix: "rl:osint" },
} satisfies Record<string, RateLimitConfig>;

// ── In-memory store (dev / CI) ───────────────────────────────────────────────

const _store = new Map<string, number[]>();

/** Réinitialise le store — tests uniquement */
export function __resetStoreForTest(): void {
  _store.clear();
}

function slidingWindowMemory(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now    = Date.now();
  const cutoff = now - cfg.windowMs;

  const ts      = (_store.get(key) ?? []).filter((t) => t > cutoff);
  const allowed = ts.length < cfg.max;

  if (allowed) ts.push(now);
  _store.set(key, ts);

  const oldest     = ts[0] ?? now;
  const resetAt    = oldest + cfg.windowMs;
  const retryAfter = allowed ? 0 : Math.ceil((resetAt - now) / 1000);

  return {
    allowed,
    remaining: Math.max(0, cfg.max - ts.length),
    limit: cfg.max,
    retryAfter,
    resetAt,
  };
}

// ── Upstash Redis adapter (prod) ─────────────────────────────────────────────

async function slidingWindowUpstash(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const url    = process.env.UPSTASH_REDIS_REST_URL!;
  const token  = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const now    = Date.now();
  const cutoff = now - cfg.windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 9)}`;

  const pipeline = [
    ["ZREMRANGEBYSCORE", key, "-inf",         cutoff.toString()   ],
    ["ZADD",             key,  now.toString(), member              ],
    ["ZCARD",            key                                       ],
    ["PEXPIRE",          key,  cfg.windowMs.toString()             ],
    ["ZRANGE",           key,  "0", "0", "WITHSCORES"              ],
  ];

  const res = await fetch(`${url}/pipeline`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(pipeline),
  });

  if (!res.ok) {
    console.error("[rateLimit] Upstash error", res.status);
    // Fail-closed pour PDF (coûteux/Puppeteer) — fail-open pour scan/osint
    if (cfg.keyPrefix === "rl:pdf") {
      const retryAfter = Math.ceil(cfg.windowMs / 1000);
      return { allowed: false, remaining: 0, limit: cfg.max, retryAfter, resetAt: now + cfg.windowMs };
    }
    return { allowed: true, remaining: cfg.max, limit: cfg.max, retryAfter: 0, resetAt: now + cfg.windowMs };
  }

  const data        = (await res.json()) as Array<{ result: unknown }>;
  const count       = (data[2]?.result as number) ?? 1;
  const oldestScore = Array.isArray(data[4]?.result)
    ? Number((data[4].result as string[])[1])
    : now;

  const allowed    = count <= cfg.max;
  const resetAt    = oldestScore + cfg.windowMs;
  const retryAfter = allowed ? 0 : Math.ceil((resetAt - now) / 1000);

  if (!allowed) {
    // Retire le hit qu'on vient d'ajouter — best-effort
    fetch(`${url}/zrem/${encodeURIComponent(key)}/${encodeURIComponent(member)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
  }

  return {
    allowed,
    remaining: Math.max(0, cfg.max - count),
    limit: cfg.max,
    retryAfter,
    resetAt,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(ip: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const key        = `${cfg.keyPrefix}:${ip}`;
  const useUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  return useUpstash ? slidingWindowUpstash(key, cfg) : slidingWindowMemory(key, cfg);
}

// ── Response helpers ─────────────────────────────────────────────────────────

const MESSAGES = {
  en: (s: number) => `Rate limit exceeded. Please retry in ${s} second${s !== 1 ? "s" : ""}.`,
  fr: (s: number) => `Limite de requêtes atteinte. Réessayez dans ${s} seconde${s !== 1 ? "s" : ""}.`,
};

export function rateLimitResponse(result: RateLimitResult, locale: "en" | "fr" = "en"): Response {
  return new Response(
    JSON.stringify({ error: MESSAGES[locale](result.retryAfter), retryAfter: result.retryAfter }),
    {
      status: 429,
      headers: {
        "Content-Type":          "application/json",
        "Retry-After":           result.retryAfter.toString(),
        "X-RateLimit-Limit":     result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     Math.ceil(result.resetAt / 1000).toString(),
      },
    }
  );
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export function detectLocale(req: Request): "en" | "fr" {
  return req.headers.get("accept-language")?.toLowerCase().includes("fr") ? "fr" : "en";
}
