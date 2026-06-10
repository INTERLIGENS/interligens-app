// src/lib/shill-correlation/enrich.ts
// PHASE 2 follow-up (Blocker C) — recover real tweet timestamps via X API.
//
// 56 ShillEvents carry a date-only tweetTimestamp (00:00:00 UTC) inherited from
// KolPromotionMention.postedAt, which breaks the +/- minute correlation window.
// All ShillEvents have a tweetId, so we batch-look-up tweets via the existing
// X client (src/lib/xapi/client.ts — no new dependency) to fetch created_at,
// and surface the tweet text so the resolver can extract a CA when CA_MAP misses.

import { getTweetsByIds, type XTweet } from "@/lib/xapi/client";

/** Provenance of a ShillEvent.tweetTimestamp after enrichment. */
export type TimestampSource = "source" | "x_api" | "date_only";

export interface TweetMeta {
  tweetId: string;
  createdAt: Date | null; // parsed X created_at, null if unavailable
  text: string | null;
}

/** True when a Date is exactly 00:00:00.000 UTC (date-only, no time-of-day). */
export function isDateOnly(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function parseCreatedAt(t: XTweet): Date | null {
  if (!t.created_at) return null;
  const d = new Date(t.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Batch-fetch tweet metadata by id. Returns a map keyed by tweetId; ids that
 * X could not resolve (deleted/protected/invalid) are simply absent.
 */
export async function fetchTweetMeta(
  tweetIds: string[],
): Promise<Map<string, TweetMeta>> {
  const unique = Array.from(new Set(tweetIds.filter(Boolean)));
  const tweets = await getTweetsByIds(unique);
  const map = new Map<string, TweetMeta>();
  for (const t of tweets) {
    map.set(t.id, {
      tweetId: t.id,
      createdAt: parseCreatedAt(t),
      text: t.text ?? null,
    });
  }
  return map;
}
