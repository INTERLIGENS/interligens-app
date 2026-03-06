// src/lib/solanaGraph/cache.ts
import { GraphReport, HopsDepth, DaysWindow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
let _redis: any = null;
let _checked = false;

async function getRedis(): Promise<any> {
  if (_checked) return _redis;
  _checked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { console.warn("[cache] Redis non configuré — cache mémoire"); return null; }
  try {
    // eval empêche webpack de résoudre @upstash/redis à la compilation
    const mod = await eval('import("@upstash/redis")');
    _redis = new mod.Redis({ url, token });
    return _redis;
  } catch { console.warn("[cache] @upstash/redis absent — cache mémoire"); return null; }
}

const mem = new Map<string, { value: string; expires: number }>();
const mget = (k: string) => { const e = mem.get(k); if (!e) return null; if (Date.now() > e.expires) { mem.delete(k); return null; } return e.value; };
const mset = (k: string, v: string, ttl: number) => mem.set(k, { value: v, expires: Date.now() + ttl * 1000 });

export function graphTTL(hops: HopsDepth, days: DaysWindow): number {
  if (hops === 2 && days >= 90) return 21_600;
  if (hops === 2) return 7_200;
  return 900;
}
export const INVESTIGATION_TTL = 86_400;
export const JOB_TTL = 86_400;
export const graphKey = (v: string, type: "mint"|"wallet", hops: HopsDepth, days: DaysWindow) => `graph:sol:${type}:${v}:h${hops}:d${days}`;
export const jobKey = (id: string) => `graph:sol:job:${id}`;

export async function cacheGetGraph(key: string): Promise<GraphReport | null> {
  const r = await getRedis(); const raw = r ? await r.get(key) : mget(key);
  if (!raw) return null; try { return JSON.parse(raw); } catch { return null; }
}
export async function cacheSetGraph(key: string, report: GraphReport, ttl: number): Promise<void> {
  const raw = JSON.stringify(report); const r = await getRedis();
  if (r) { await r.set(key, raw, { ex: ttl }); } else { mset(key, raw, ttl); }
}
export async function cacheGetJob(jobId: string): Promise<any | null> {
  const r = await getRedis(); const raw = r ? await r.get(jobKey(jobId)) : mget(jobKey(jobId));
  if (!raw) return null; try { return JSON.parse(raw); } catch { return null; }
}
export async function cacheSetJob(job: any): Promise<void> {
  const raw = JSON.stringify(job); const r = await getRedis();
  if (r) { await r.set(jobKey(job.id), raw, { ex: JOB_TTL }); } else { mset(jobKey(job.id), raw, JOB_TTL); }
}
export async function cacheDelKey(key: string): Promise<void> {
  const r = await getRedis(); if (r) { await r.del(key); } else { mem.delete(key); }
}
export async function cacheListGraphKeys(prefix = "graph:sol:"): Promise<string[]> {
  const r = await getRedis();
  if (r) return r.keys(`${prefix}*`);
  return Array.from(mem.keys()).filter(k => k.startsWith(prefix));
}
