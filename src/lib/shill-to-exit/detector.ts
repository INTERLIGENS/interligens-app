/**
 * Shill-to-Exit Detector — V0
 *
 * Detects when a KOL has promoted a token on social (via SocialPostCandidate)
 * AND then sold / cex-deposited the same token shortly after (via KolProceedsEvent).
 * This is the INTERLIGENS MOAT signal — the combination of social intent data
 * and on-chain exit proof.
 *
 * Severity mapping:
 *   CRITICAL : exit  < 24 h after shill
 *   HIGH     : exit  < 72 h
 *   MEDIUM   : exit  < 7 days (168 h)
 *   no signal: exit  >= 168 h, or exit BEFORE the shill date
 *
 * Demo-safe: never throws, always returns an array (empty on missing data).
 */

import { prisma } from "@/lib/prisma";

export interface ShillEvent {
  handle: string;
  tokenCA: string;
  tokenSymbol: string | null;
  shillDate: Date;
  postUrl?: string;
}

export interface ExitEvent {
  handle: string;
  tokenCA: string;
  tokenSymbol: string | null;
  walletAddress: string;
  sellDate: Date;
  amountUsd: number;
  txHash: string;
  eventType: string;
}

export interface ShillToExitSignal {
  handle: string;
  tokenCA: string;
  tokenSymbol: string;
  shillDate: Date;
  exitDate: Date;
  hoursToExit: number;
  amountUsd: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  /** V1 — HIGH: direct proof (shill post + sell tx + matching laundry trail).
   *        MEDIUM: time-correlated (shill + sell on same handle, no trail).
   *        LOW: inferred via symbol-only match, no CA. */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** V1 — when the seller wallet is present in a LaundryTrail for the same handle. */
  laundryEnrichment: {
    walletAddress: string;
    chain: string;
    trailType: string;
    laundryRisk: string;
    recoveryDifficulty: string;
  } | null;
  evidence: string[];
  postUrl?: string;
  txHash: string;
  walletAddress: string;
}

type LaundryTrailHit = {
  walletAddress: string;
  chain: string;
  trailType: string;
  laundryRisk: string;
  recoveryDifficulty: string;
};

type ProceedsRow = {
  eventDate: Date;
  amountUsd: number | null;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  txHash: string;
  walletAddress: string;
  eventType: string;
};

/**
 * Normalize a token identifier: lowercase for EVM, preserved for base58.
 * Both shill and exit sides should be normalized consistently.
 */
function normalizeToken(token: string): string {
  const t = token.trim();
  if (t.startsWith("0x") && t.length === 42) return t.toLowerCase();
  return t;
}

function severityFromHours(hours: number): ShillToExitSignal["severity"] | null {
  if (hours < 0) return null; // exit happened BEFORE the shill → not a shill-to-exit
  if (hours < 24) return "CRITICAL";
  if (hours < 72) return "HIGH";
  if (hours < 168) return "MEDIUM";
  return null;
}

/**
 * Decide confidence from the available proof artifacts.
 *
 *   HIGH   — matched by token contract AND the seller wallet is in a
 *            LaundryTrail for the same handle (direct proof the exit
 *            funds fed a known laundering pattern).
 *   MEDIUM — matched by token contract, no laundry trail (plain
 *            shill-to-exit correlation on the same handle).
 *   LOW    — matched by symbol only, no contract address (weakest link).
 */
function decideConfidence(
  matchedByCa: boolean,
  laundryHit: LaundryTrailHit | null,
): "HIGH" | "MEDIUM" | "LOW" {
  if (matchedByCa && laundryHit) return "HIGH";
  if (matchedByCa) return "MEDIUM";
  return "LOW";
}

/**
 * Pure function used by the tests and by detectShillToExit. Separating it
 * lets us unit-test the correlation logic without spinning up Prisma.
 *
 * V1: accepts an optional laundry-trail map keyed by seller wallet. When a
 * signal's seller wallet hits the map, the trail is attached verbatim and
 * confidence climbs to HIGH.
 */
export function correlate(
  handle: string,
  shills: ShillEvent[],
  exits: ExitEvent[],
  laundryByWallet?: Map<string, LaundryTrailHit>,
): ShillToExitSignal[] {
  if (shills.length === 0 || exits.length === 0) return [];

  // Index shills by normalized token CA, then by symbol as a fallback.
  const shillByCa = new Map<string, ShillEvent[]>();
  const shillBySymbol = new Map<string, ShillEvent[]>();
  for (const s of shills) {
    if (s.tokenCA) {
      const k = normalizeToken(s.tokenCA);
      const arr = shillByCa.get(k) ?? [];
      arr.push(s);
      shillByCa.set(k, arr);
    }
    if (s.tokenSymbol) {
      const k = s.tokenSymbol.toUpperCase();
      const arr = shillBySymbol.get(k) ?? [];
      arr.push(s);
      shillBySymbol.set(k, arr);
    }
  }

  const signals: ShillToExitSignal[] = [];
  const seen = new Set<string>();

  for (const exit of exits) {
    const candidates: ShillEvent[] = [];
    let matchedByCa = false;
    if (exit.tokenCA) {
      const byCa = shillByCa.get(normalizeToken(exit.tokenCA));
      if (byCa) {
        candidates.push(...byCa);
        matchedByCa = true;
      }
    }
    if (candidates.length === 0 && exit.tokenSymbol) {
      const bySym = shillBySymbol.get(exit.tokenSymbol.toUpperCase());
      if (bySym) candidates.push(...bySym);
    }
    if (candidates.length === 0) continue;

    // Pick the MOST RECENT shill that still precedes the exit — that is the
    // tightest window and therefore the strongest signal for this token.
    const valid = candidates.filter((s) => s.shillDate.getTime() < exit.sellDate.getTime());
    if (valid.length === 0) continue;
    valid.sort((a, b) => b.shillDate.getTime() - a.shillDate.getTime());
    const shill = valid[0];

    const hoursToExit =
      (exit.sellDate.getTime() - shill.shillDate.getTime()) / (1000 * 60 * 60);
    const severity = severityFromHours(hoursToExit);
    if (!severity) continue;

    const dedupKey = `${shill.tokenCA}:${exit.txHash}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const evidence: string[] = [];
    evidence.push(
      `Shilled ${shill.tokenSymbol ?? shill.tokenCA} on ${shill.shillDate.toISOString().slice(0, 10)}`,
    );
    evidence.push(
      `${exit.eventType === "cex_deposit" ? "Deposited to CEX" : "Sold"} on ${exit.sellDate.toISOString().slice(0, 10)} — $${Math.round(exit.amountUsd).toLocaleString("en-US")}`,
    );
    evidence.push(
      `Delay: ${hoursToExit < 24 ? `${Math.round(hoursToExit)} h` : `${(hoursToExit / 24).toFixed(1)} days`}`,
    );

    const laundryHit = laundryByWallet?.get(exit.walletAddress.toLowerCase()) ?? null;
    const confidence = decideConfidence(matchedByCa, laundryHit);
    if (laundryHit) {
      evidence.push(
        `Laundry trail detected: ${laundryHit.trailType} · risk=${laundryHit.laundryRisk}`,
      );
    }

    signals.push({
      handle,
      tokenCA: shill.tokenCA,
      tokenSymbol: shill.tokenSymbol ?? exit.tokenSymbol ?? "UNKNOWN",
      shillDate: shill.shillDate,
      exitDate: exit.sellDate,
      hoursToExit,
      amountUsd: exit.amountUsd,
      severity,
      confidence,
      laundryEnrichment: laundryHit,
      evidence,
      postUrl: shill.postUrl,
      txHash: exit.txHash,
      walletAddress: exit.walletAddress,
    });
  }

  // Strongest first: lower hoursToExit = worse.
  signals.sort((a, b) => a.hoursToExit - b.hoursToExit);
  return signals;
}

async function loadShillEvents(handle: string): Promise<ShillEvent[]> {
  try {
    const candidates = await prisma.socialPostCandidate.findMany({
      where: {
        influencer: { handle },
        postedAtUtc: { not: null },
        detectedTokens: { not: "[]" },
      },
      select: {
        postedAtUtc: true,
        postUrl: true,
        detectedTokens: true,
      },
      take: 500,
      orderBy: { postedAtUtc: "desc" },
    });

    const events: ShillEvent[] = [];
    for (const c of candidates) {
      if (!c.postedAtUtc) continue;
      let tokens: unknown;
      try {
        tokens = JSON.parse(c.detectedTokens);
      } catch {
        continue;
      }
      if (!Array.isArray(tokens)) continue;

      for (const t of tokens) {
        if (typeof t === "string") {
          events.push({
            handle,
            tokenCA: t,
            tokenSymbol: null,
            shillDate: c.postedAtUtc,
            postUrl: c.postUrl,
          });
        } else if (t && typeof t === "object") {
          const obj = t as { address?: string; symbol?: string; ca?: string };
          const ca = obj.address ?? obj.ca ?? "";
          if (!ca && !obj.symbol) continue;
          events.push({
            handle,
            tokenCA: ca,
            tokenSymbol: obj.symbol ?? null,
            shillDate: c.postedAtUtc,
            postUrl: c.postUrl,
          });
        }
      }
    }
    return events;
  } catch (err) {
    console.error("[shill-to-exit] loadShillEvents failed", err);
    return [];
  }
}

async function loadExitEvents(handle: string): Promise<ExitEvent[]> {
  try {
    const rows = await prisma.$queryRaw<ProceedsRow[]>`
      SELECT
        "eventDate",
        "amountUsd",
        "tokenSymbol",
        "tokenAddress",
        "txHash",
        "walletAddress",
        "eventType"
      FROM "KolProceedsEvent"
      WHERE "kolHandle" = ${handle}
        AND "eventType" IN ('sell', 'cex_deposit')
        AND "amountUsd" > 0
        AND "ambiguous" = false
      ORDER BY "eventDate" DESC
      LIMIT 500
    `;

    return rows
      .filter((r) => r.tokenAddress || r.tokenSymbol)
      .map((r) => ({
        handle,
        tokenCA: r.tokenAddress ?? "",
        tokenSymbol: r.tokenSymbol,
        walletAddress: r.walletAddress,
        sellDate: r.eventDate,
        amountUsd: Number(r.amountUsd ?? 0),
        txHash: r.txHash,
        eventType: r.eventType,
      }));
  } catch (err) {
    console.error("[shill-to-exit] loadExitEvents failed", err);
    return [];
  }
}

async function loadLaundryByWallet(handle: string): Promise<Map<string, LaundryTrailHit>> {
  try {
    const trails = await prisma.laundryTrail.findMany({
      where: { kolHandle: handle },
      select: {
        walletAddress: true,
        chain: true,
        trailType: true,
        laundryRisk: true,
        recoveryDifficulty: true,
      },
      take: 200,
    });
    const m = new Map<string, LaundryTrailHit>();
    for (const t of trails) {
      m.set(t.walletAddress.toLowerCase(), {
        walletAddress: t.walletAddress,
        chain: t.chain,
        trailType: t.trailType,
        laundryRisk: String(t.laundryRisk),
        recoveryDifficulty: String(t.recoveryDifficulty),
      });
    }
    return m;
  } catch (err) {
    console.error("[shill-to-exit] loadLaundryByWallet failed", err);
    return new Map();
  }
}

/**
 * Public API — returns an array of shill-to-exit signals for the given KOL.
 * Always resolves; never throws.
 */
export async function detectShillToExit(
  handle: string,
): Promise<ShillToExitSignal[]> {
  if (!handle || typeof handle !== "string") return [];
  const normalized = handle.replace(/^@+/, "").trim();
  if (!normalized) return [];

  try {
    const [shills, exits, laundryByWallet] = await Promise.all([
      loadShillEvents(normalized),
      loadExitEvents(normalized),
      loadLaundryByWallet(normalized),
    ]);
    return correlate(normalized, shills, exits, laundryByWallet);
  } catch (err) {
    console.error("[shill-to-exit] detectShillToExit failed", err);
    return [];
  }
}
