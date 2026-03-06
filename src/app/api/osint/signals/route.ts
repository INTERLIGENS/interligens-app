import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/security/auth";

interface OsintItem { id: string; tags: string[]; why_en: string; why_fr: string; links: string[] }
interface CacheEntry { items: OsintItem[]; fetched_at: string; ts: number }
const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60_000;
export const dynamic = "force-dynamic";

const BOTIFY_ITEMS: OsintItem[] = [
  {
    id: "botify-dex",
    tags: ["pump.fun", "LOW_LIQUIDITY", "RAPID_LAUNCH"],
    why_en: "Token launched on pump.fun with abnormal FDV/liquidity ratio and coordinated KOL push.",
    why_fr: "Token lancé sur pump.fun avec ratio FDV/liquidité anormal et poussée KOL coordonnée.",
    links: ["https://dexscreener.com/solana/botify"]
  },
  {
    id: "botify-thread",
    tags: ["SHILL_PATTERN", "FAKE_METRICS"],
    why_en: "Coordinated shill pattern detected: fake volume signals + multiple CTA posts within 1h.",
    why_fr: "Schéma de shill coordonné : signaux de volume factices + plusieurs CTA en moins d'1h.",
    links: []
  }
];

const GENERIC_ITEM: OsintItem[] = [
  {
    id: "generic-no-signal",
    tags: ["LOW"],
    why_en: "No strong OSINT signals detected (demo).",
    why_fr: "Aucun signal OSINT significatif détecté (démo).",
    links: []
  }
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mock = searchParams.get("mock") === "1";
  if (!mock) {
    const _auth = await checkAuth(req);
    if (!_auth.authorized) return _auth.response!;
  }
  const q = searchParams.get("q")?.trim() ?? "";
  const lang = searchParams.get("lang") === "fr" ? "fr" : "en";
  const cacheKey = q + ":" + lang;
  const hit = cache.get(cacheKey);
  if (!mock && hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ ok: true, q, lang, items: hit.items, source: "cache", fetched_at: hit.fetched_at, cache_hit: true });

  const isBotify = q.toLowerCase().includes("botify") || q === "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb";
  const items = (isBotify ? BOTIFY_ITEMS : GENERIC_ITEM).slice(0, 2);
  const fetched_at = new Date().toISOString();
  cache.set(cacheKey, { items, fetched_at, ts: Date.now() });
  return NextResponse.json({ ok: true, q, lang, items, source: "fixtures", fetched_at, cache_hit: false });
}
