// src/lib/vault/ratelimit/store.ts
export interface RateLimitEntry {
  count: number;
  resetAt: number;
  matchCount?: number;
  cooldownUntil?: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, value: RateLimitEntry, ttlMs: number): Promise<void>;
}
