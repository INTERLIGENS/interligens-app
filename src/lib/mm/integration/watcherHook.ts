// ─── MM ↔ Watcher hook (Phase 9) ─────────────────────────────────────────
// Thin integration between the KOL Watcher and the MM scanner. When the
// Watcher detects that a KOL shills a token, this hook checks the MM cache;
// if the cache is stale or empty it runs a fresh scanToken() and, when the
// resulting displayScore lands in ORANGE or RED, logs an alert into
// MmReviewLog.
//
// Crucially: this module is NOT wired into the Watcher codebase yet. It
// only exists so the integration can be activated with one line once the
// MM scoring cadence is validated.
//
// All paths are defensive — any upstream error (DB, API, scan failure)
// returns { error: true, reason } instead of throwing so the Watcher's
// alert pipeline is never crashed by a MM failure.

import { prisma } from "@/lib/prisma";
import type { MmChain } from "../types";
import { scanToken } from "../data/scanner";
import { writeReviewLog } from "../registry/reviewLog";

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

export interface KolShillEvent {
  kolHandle: string;
  tokenAddress: string;
  chain: MmChain;
  tweetUrl?: string;
  detectedAt: Date | string;
}

export type AlertLevel = "ORANGE" | "RED";

export interface WatcherMmResult {
  ok: boolean;
  error?: true;
  reason?: string;
  source: "cache" | "compute" | "none";
  displayScore: number | null;
  band: "GREEN" | "YELLOW" | "ORANGE" | "RED" | null;
  alert: boolean;
  alertLevel?: AlertLevel;
  scanRunId: string | null;
  computedAt: string | null;
}

function bandOfScore(score: number): "GREEN" | "YELLOW" | "ORANGE" | "RED" {
  if (score < 20) return "GREEN";
  if (score < 40) return "YELLOW";
  if (score < 70) return "ORANGE";
  return "RED";
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface WatcherHookOptions {
  /**
   * Override the 6h cache TTL in ms (tests only).
   */
  cacheTtlMs?: number;
  /**
   * Force a recompute even when the cache is fresh (useful for investigators
   * who want to double-check a tweet).
   */
  forceRecompute?: boolean;
  /**
   * Now() override for deterministic tests.
   */
  nowMs?: number;
}

function err(reason: string): WatcherMmResult {
  return {
    ok: false,
    error: true,
    reason,
    source: "none",
    displayScore: null,
    band: null,
    alert: false,
    scanRunId: null,
    computedAt: null,
  };
}

export async function onKolShillDetected(
  event: KolShillEvent,
  opts: WatcherHookOptions = {},
): Promise<WatcherMmResult> {
  if (!event.kolHandle || !event.tokenAddress || !event.chain) {
    return err("invalid_event");
  }
  const ttl = opts.cacheTtlMs ?? CACHE_TTL_MS;
  const now = opts.nowMs ?? Date.now();
  const cutoff = new Date(now - ttl);

  // 1. Try the cache first.
  if (!opts.forceRecompute) {
    try {
      const row = await prisma.mmScore.findUnique({
        where: {
          subjectType_subjectId_chain: {
            subjectType: "TOKEN",
            subjectId: event.tokenAddress,
            chain: event.chain,
          },
        },
        select: {
          scanRunId: true,
          displayScore: true,
          band: true,
          computedAt: true,
        },
      });
      if (row && row.computedAt > cutoff) {
        const band = row.band as WatcherMmResult["band"];
        const alert = row.displayScore >= 40;
        const alertLevel: AlertLevel | undefined =
          row.displayScore >= 70
            ? "RED"
            : row.displayScore >= 40
              ? "ORANGE"
              : undefined;
        if (alert) {
          await logAlertSafe(event, row.displayScore, band, row.scanRunId);
        }
        return {
          ok: true,
          source: "cache",
          displayScore: row.displayScore,
          band,
          alert,
          alertLevel,
          scanRunId: row.scanRunId,
          computedAt: row.computedAt.toISOString(),
        };
      }
    } catch (e) {
      return err(
        `cache_lookup_failed:${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // 2. Fresh scan via the data layer.
  let scanRunId: string | null = null;
  let displayScore = 0;
  try {
    const result = await scanToken(event.tokenAddress, event.chain, {
      triggeredBy: "TIGERSCORE_INTEGRATION",
      triggeredByRef: `watcher:${event.kolHandle}`,
    });
    displayScore = result.behaviorDrivenScore;
  } catch (e) {
    return err(
      `scan_failed:${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 3. Re-read MmScore to pick up the canonical scanRunId persisted by the
  //    scanner (avoids touching the internal ScanRunResult shape).
  try {
    const row = await prisma.mmScore.findUnique({
      where: {
        subjectType_subjectId_chain: {
          subjectType: "TOKEN",
          subjectId: event.tokenAddress,
          chain: event.chain,
        },
      },
      select: {
        scanRunId: true,
        displayScore: true,
        band: true,
        computedAt: true,
      },
    });
    if (row) {
      scanRunId = row.scanRunId;
      displayScore = row.displayScore;
    }
  } catch {
    // non-fatal — we'll still report the in-memory scan result.
  }

  const band = bandOfScore(displayScore);
  const alert = displayScore >= 40;
  const alertLevel: AlertLevel | undefined =
    displayScore >= 70 ? "RED" : displayScore >= 40 ? "ORANGE" : undefined;
  if (alert) {
    await logAlertSafe(event, displayScore, band, scanRunId);
  }

  const computedAt = toDate(new Date(now))?.toISOString() ?? null;
  return {
    ok: true,
    source: "compute",
    displayScore,
    band,
    alert,
    alertLevel,
    scanRunId,
    computedAt,
  };
}

async function logAlertSafe(
  event: KolShillEvent,
  displayScore: number,
  band: string | null,
  scanRunId: string | null,
): Promise<void> {
  try {
    await writeReviewLog({
      targetType: "SCAN_RUN",
      targetId: scanRunId ?? `alert:${event.tokenAddress}:${event.chain}`,
      action: "CREATED",
      actorUserId: `kol:${event.kolHandle}`,
      actorRole: "watcher_mm_alert",
      notes:
        `KOL shill on MM-flagged token — ` +
        `displayScore=${displayScore} band=${band ?? "?"}`,
      snapshotAfter: {
        kolHandle: event.kolHandle,
        tokenAddress: event.tokenAddress,
        chain: event.chain,
        tweetUrl: event.tweetUrl ?? null,
        detectedAt:
          event.detectedAt instanceof Date
            ? event.detectedAt.toISOString()
            : event.detectedAt,
        displayScore,
        band,
      },
    });
  } catch (e) {
    console.error("[mm/watcher] alert logging failed", e);
  }
}
