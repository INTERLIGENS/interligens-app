// src/lib/shill-correlation/resolve.ts
// PHASE 2 follow-up (Blocker A) — ticker -> mint resolution for ShillEvents.
//
// Many ShillEvents carry a ticker symbol in tokenMint (e.g. "PHOTO") rather
// than a base58 address, because SocialPostCandidate.detectedTokens stores
// cashtags. This resolver tags each event's tokenMint with a resolution status
// and, when possible, upgrades it to a real mint. Ticker-only events are never
// discarded — they are tagged "unresolved_ticker" and kept.
//
// Resolution sources, in order:
//   1. tokenMint is already base58            -> resolved_direct
//   2. CA_MAP (src/lib/kol/proceeds.ts)        -> resolved_from_ca_map
//   3. base58 CA(s) extracted from tweet text  -> resolved_from_tweet (1 match)
//                                              -> ambiguous_ticker   (>1 distinct)
//   4. otherwise                               -> unresolved_ticker
//
// detectSignals (watcher) is reused for tweet-text CA extraction — no new dep.

import { CA_MAP } from "@/lib/kol/proceeds";
import { detectSignals } from "@/lib/watcher/tokenDetector";
import { looksLikeSolanaMint } from "./buyers";

export type ResolutionStatus =
  | "resolved_direct"
  | "resolved_from_ca_map"
  | "resolved_from_tweet"
  | "unresolved_ticker"
  | "ambiguous_ticker";

export interface MintResolution {
  /** Resolved base58 mint, or null when unresolved/ambiguous. */
  mint: string | null;
  /** Original ticker symbol when the input was not already an address. */
  ticker: string | null;
  status: ResolutionStatus;
}

/** Resolve using only the direct-address check + CA_MAP (no tweet text). */
export function resolveTokenMint(raw: string): MintResolution {
  const value = (raw ?? "").trim();
  if (looksLikeSolanaMint(value)) {
    return { mint: value, ticker: null, status: "resolved_direct" };
  }
  const hit = CA_MAP[value.toUpperCase()];
  if (hit) {
    return { mint: hit, ticker: value, status: "resolved_from_ca_map" };
  }
  return { mint: null, ticker: value, status: "unresolved_ticker" };
}

/** Extract distinct base58 Solana CAs mentioned in a tweet's text. */
export function extractSolanaCAsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const { detectedAddresses } = detectSignals(text);
  return Array.from(
    new Set(detectedAddresses.filter((a) => looksLikeSolanaMint(a))),
  );
}

/**
 * Resolve, falling back to CA(s) found in the tweet text when CA_MAP misses.
 * A single distinct CA -> resolved_from_tweet; several -> ambiguous_ticker.
 */
export function resolveWithTweetText(
  raw: string,
  tweetText: string | null | undefined,
): MintResolution {
  const direct = resolveTokenMint(raw);
  if (direct.status !== "unresolved_ticker") return direct;

  const cas = extractSolanaCAsFromText(tweetText);
  const ticker = (raw ?? "").trim();
  if (cas.length === 1) {
    return { mint: cas[0], ticker, status: "resolved_from_tweet" };
  }
  if (cas.length > 1) {
    return { mint: null, ticker, status: "ambiguous_ticker" };
  }
  return direct; // still unresolved_ticker
}
