/**
 * Address poisoning detector.
 *
 * Address-poisoning attacks spoof a target's transaction history with a
 * cosmetically-similar address — same first-4 and last-4 characters as a
 * legitimate wallet the target interacts with — so a user copying from
 * their tx history paste into a transfer destination lands funds on the
 * attacker's wallet instead.
 *
 * This signal checks an incoming address against two corpora:
 *  - `KolWallet` rows in the DB (filtered by chain)
 *  - The static `KNOWN_BAD` list in `src/lib/entities/knownBad.ts`
 *    (also used as a "known legitimate" reference for prefix/suffix match)
 *
 * Matching is strict on first-4 + last-4 hex/base58 chars, case-sensitive
 * for SOL (base58) and case-insensitive for EVM (hex). Full-address
 * identity is NOT a poisoning signal — it's the same wallet and should be
 * scored by other detectors.
 *
 * Fallback policy: DB timeout or thrown error → skip the signal. The
 * detector NEVER throws to the caller. The engine stays sync and safe.
 */

import { KNOWN_BAD, type KnownBadEntry } from "@/lib/entities/knownBad";

export interface PoisoningMatch {
  /** The address that the input cosmetically impersonates. */
  lookalikeOf: string;
  /** Source of the match. */
  source: "kol_wallet" | "known_bad";
  /** Chain the match belongs to. */
  chain: string;
  /** Optional label when the source can describe it (KOL handle, drainer name). */
  label?: string;
}

export interface PoisoningResult {
  poisoned: boolean;
  match?: PoisoningMatch;
  /** True if the detector bailed (DB timeout, etc.) — caller should treat as "unknown", not "clean". */
  skipped?: boolean;
  reason?: "timeout" | "db_error" | "invalid_input";
}

interface DbShape {
  kolWallet: {
    findMany: (args: {
      where: { chain?: string };
      select: { address: true; chain: true; kolHandle: true };
      take?: number;
    }) => Promise<Array<{ address: string; chain: string; kolHandle: string }>>;
  };
}

export interface DetectOptions {
  /** Override the default Prisma client (used in tests). */
  db?: DbShape;
  /**
   * Override the KNOWN_BAD corpus (used in tests). Defaults to the shipped list.
   */
  knownBad?: readonly KnownBadEntry[];
  /** Hard ceiling on the DB query, ms. Default 1500 ms — graph still feels instant. */
  timeoutMs?: number;
  /** Normalised chain tag for comparison ("ETH" | "SOL" | "BSC" | ...). */
  chain?: string;
}

const DEFAULT_TIMEOUT_MS = 1500;

function normaliseAddress(addr: string): string {
  // EVM addresses are hex, case-insensitive. SOL addresses are base58,
  // case-sensitive. We detect which by prefix: EVM starts with 0x.
  if (addr.startsWith("0x") || addr.startsWith("0X")) {
    return addr.toLowerCase();
  }
  return addr;
}

function prefixSuffixKey(addr: string): string | null {
  const s = addr.trim();
  if (s.length < 10) return null; // need at least 4 + 4 + something in the middle
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function isLookalike(candidate: string, reference: string): boolean {
  const a = normaliseAddress(candidate);
  const b = normaliseAddress(reference);
  if (a === b) return false; // same wallet — not poisoning
  const ka = prefixSuffixKey(a);
  const kb = prefixSuffixKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}

/**
 * Run the detector. Never throws. Returns `{ poisoned: true, match }` when
 * a lookalike is found; `{ poisoned: false, skipped: true, reason }` when
 * the DB side couldn't respond; `{ poisoned: false }` otherwise.
 */
export async function detectAddressPoisoning(
  address: string,
  opts: DetectOptions = {},
): Promise<PoisoningResult> {
  if (!address || typeof address !== "string") {
    return { poisoned: false, skipped: true, reason: "invalid_input" };
  }

  const chain = opts.chain;
  const corpus = opts.knownBad ?? KNOWN_BAD;

  // ── 1. Static corpus first — always fast, never throws. ─────────────
  for (const entry of corpus) {
    if (chain && entry.chain !== chain) continue;
    if (isLookalike(address, entry.address)) {
      return {
        poisoned: true,
        match: {
          lookalikeOf: entry.address,
          source: "known_bad",
          chain: entry.chain,
          label: entry.label,
        },
      };
    }
  }

  // ── 2. DB KolWallet, behind a timeout. Skip on failure. ─────────────
  const db = opts.db ?? (await loadDbSafely());
  if (!db) return { poisoned: false, skipped: true, reason: "db_error" };

  const rows = await withTimeout(
    db.kolWallet.findMany({
      where: chain ? { chain } : {},
      select: { address: true, chain: true, kolHandle: true },
      take: 5000,
    }),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  if (rows === null) {
    // Timeout or rejection — don't block scoring, don't claim clean.
    return { poisoned: false, skipped: true, reason: "timeout" };
  }

  for (const row of rows) {
    if (isLookalike(address, row.address)) {
      return {
        poisoned: true,
        match: {
          lookalikeOf: row.address,
          source: "kol_wallet",
          chain: row.chain,
          label: row.kolHandle,
        },
      };
    }
  }

  return { poisoned: false };
}

async function loadDbSafely(): Promise<DbShape | null> {
  try {
    const mod = await import("@/lib/prisma");
    return mod.prisma as unknown as DbShape;
  } catch {
    return null;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}
