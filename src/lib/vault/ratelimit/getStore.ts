// src/lib/vault/ratelimit/getStore.ts
import { hasRedis, env } from "@/lib/config/env";
import { memoryStore } from "./memoryStore";
import { createUpstashStore } from "./upstashStore";
import type { RateLimitStore } from "./store";

let _store: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (_store) return _store;
  if (hasRedis()) {
    _store = createUpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  } else {
    _store = memoryStore;
  }
  return _store;
}

export function _resetStoreCache() { _store = null; }
