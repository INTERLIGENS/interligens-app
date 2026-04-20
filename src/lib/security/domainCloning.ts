/**
 * Domain-cloning shield.
 *
 * Phishing operations register lookalike domains of popular Solana/EVM
 * frontends (pumpfun.cc vs pump.fun, jup-ag.xyz vs jup.ag, etc.) and
 * serve malicious drainers from them. This module compares an input URL
 * against a curated list of LEGITIMATE domains and flags high similarity
 * + hostname mismatch as a DOMAIN_CLONE signal.
 *
 * Algorithm: classical Levenshtein edit distance → similarity ratio in
 * [0, 1] = 1 - (distance / max(len_a, len_b)). The legitimate domain is
 * compared hostname-to-hostname, stripped of the "www." prefix. If the
 * extracted hostname is an EXACT match, the URL is legitimate — not a
 * clone. Only hostnames that are STRICTLY similar but different are
 * flagged.
 */

/** Legitimate reference hosts (lowercase, no scheme, no www). */
export const LEGITIMATE_DOMAINS: readonly string[] = [
  "pump.fun",
  "jup.ag",
  "raydium.io",
  "birdeye.so",
  "dexscreener.com",
  "uniswap.org",
];

export interface DomainMatch {
  legitimate: string;
  similarity: number;
}

export interface DomainScanResult {
  url: string;
  host: string | null;
  /** True if the URL resolves to a known legitimate domain. */
  isLegitimate: boolean;
  /** High-similarity or same-root-different-TLD → clone. */
  isClone: boolean;
  /** How the clone was detected, when isClone=true. */
  cloneVector?: "similarity" | "tld_swap";
  bestMatch?: DomainMatch;
  reason?: "invalid_url" | "no_host";
}

// ── Levenshtein (iterative, no deps) ─────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter — saves memory on the rolling row.
  if (a.length > b.length) [a, b] = [b, a];

  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insertion
        prev[i] + 1, // deletion
        prev[i - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ── Host extraction ──────────────────────────────────────────────────────────

function extractHost(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ── Public entry ─────────────────────────────────────────────────────────────

/** Threshold for flagging a domain as a clone (similarity > threshold). */
export const CLONE_SIMILARITY_THRESHOLD = 0.8;

export function scanDomainForCloning(
  input: string,
  opts: { legitimate?: readonly string[]; threshold?: number } = {},
): DomainScanResult {
  const legit = opts.legitimate ?? LEGITIMATE_DOMAINS;
  const threshold = opts.threshold ?? CLONE_SIMILARITY_THRESHOLD;

  const host = extractHost(input);
  if (!host) {
    return {
      url: input,
      host: null,
      isLegitimate: false,
      isClone: false,
      reason: "invalid_url",
    };
  }

  // Exact-match (or sub-domain of a legitimate root) → legitimate.
  for (const l of legit) {
    if (host === l || host.endsWith("." + l)) {
      return { url: input, host, isLegitimate: true, isClone: false };
    }
  }

  // Two-vector clone detection:
  //   1. `similarity` — Levenshtein > threshold (catches typos like
  //      "uniswep.org" vs "uniswap.org").
  //   2. `tld_swap` — strip non-alphanumerics and compare the root.
  //      Catches "pumpfun.cc" vs "pump.fun" — phishers often drop the
  //      legitimate dot and register on a cheap TLD. The hostname
  //      isn't lexically close (Levenshtein ~0.6) but the alphanumeric
  //      root is identical, which is the giveaway.
  const hostRoot = host.replace(/[^a-z0-9]/g, "");
  let best: DomainMatch | undefined;
  let tldSwapHit: DomainMatch | undefined;
  for (const l of legit) {
    const score = similarity(host, l);
    if (!best || score > best.similarity) {
      best = { legitimate: l, similarity: score };
    }
    const legitRoot = l.replace(/[^a-z0-9]/g, "");
    // tld_swap: the hostname's alphanumeric root EQUALS the legit root,
    // OR starts with it (phishers drop the dot then append a new TLD:
    // "pump.fun" → "pumpfun" → "pumpfun.cc"). Requires the legit root
    // to be ≥5 chars so we don't false-positive on common short words.
    if (
      legitRoot.length >= 5 &&
      (hostRoot === legitRoot || hostRoot.startsWith(legitRoot))
    ) {
      tldSwapHit = { legitimate: l, similarity: 1 };
    }
  }

  if (tldSwapHit) {
    return {
      url: input,
      host,
      isLegitimate: false,
      isClone: true,
      cloneVector: "tld_swap",
      bestMatch: tldSwapHit,
    };
  }

  const isClone = !!best && best.similarity > threshold;
  return {
    url: input,
    host,
    isLegitimate: false,
    isClone,
    cloneVector: isClone ? "similarity" : undefined,
    bestMatch: best,
  };
}
