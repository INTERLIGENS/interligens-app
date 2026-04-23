// src/lib/shill-to-exit/engine.ts
// Adapter layer: converts ShillToExitSignal[] → ShillToExitResult with timeline.
// Pure computation — no DB calls. Use detectShillToExit() from detector.ts for data.

import type { ShillToExitSignal } from "./detector";

export interface ShillToExitInput {
  kolHandle: string;
  tokenMint?: string;
  tokenSymbol?: string;
}

export interface TimelineEvent {
  type: "SHILL" | "SELL" | "CASHOUT" | "PRICE_DROP";
  timestamp: Date;
  label_en: string;
  label_fr: string;
  amount_usd?: number;
  delta_minutes?: number;
  evidence_url?: string;
  tx_hash?: string;
}

export interface ShillToExitResult {
  detected: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  kolHandle: string;
  tokenSymbol?: string;
  timeline: TimelineEvent[];
  total_proceeds_usd: number;
  max_delta_minutes: number;
  computed_at: Date;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function confidenceFromHours(hours: number): "HIGH" | "MEDIUM" | "LOW" {
  if (hours < 24)  return "HIGH";
  if (hours < 72)  return "MEDIUM";
  return "LOW";
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtDelay(minutes: number, lang: "en" | "fr"): string {
  if (minutes < 60) return lang === "fr" ? `${minutes} min` : `${minutes} min`;
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ── Pure builder — testable without Prisma ──────────────────────────────────

export function buildShillToExitResult(
  kolHandle: string,
  signals: ShillToExitSignal[],
  tokenMint?: string,
  tokenSymbol?: string,
): ShillToExitResult {
  const now = new Date();

  // Filter by mint if provided
  const filtered = tokenMint
    ? signals.filter(
        (s) =>
          s.tokenCA?.toLowerCase() === tokenMint.toLowerCase() ||
          (tokenSymbol && s.tokenSymbol?.toUpperCase() === tokenSymbol.toUpperCase()),
      )
    : signals;

  if (filtered.length === 0) {
    return {
      detected: false,
      confidence: "NONE",
      kolHandle,
      tokenSymbol,
      timeline: [],
      total_proceeds_usd: 0,
      max_delta_minutes: 0,
      computed_at: now,
    };
  }

  // Build timeline from signals
  const timeline: TimelineEvent[] = [];
  let total_proceeds_usd = 0;
  let max_delta_minutes = 0;
  const shillTs = filtered.reduce((min, s) => Math.min(min, s.shillDate.getTime()), Infinity);

  for (const sig of filtered) {
    const shillDelta = Math.round((sig.shillDate.getTime() - shillTs) / 60_000);
    const exitDelta = Math.round((sig.exitDate.getTime() - shillTs) / 60_000);

    // SHILL event
    timeline.push({
      type: "SHILL",
      timestamp: sig.shillDate,
      label_en: `Promoted $${sig.tokenSymbol ?? "TOKEN"}`,
      label_fr: `A promu $${sig.tokenSymbol ?? "TOKEN"}`,
      delta_minutes: shillDelta,
      evidence_url: sig.postUrl,
    });

    // SELL or CASHOUT event
    const isCashout = sig.laundryEnrichment !== null;
    const eventType: TimelineEvent["type"] = isCashout ? "CASHOUT" : "SELL";
    const deltaMinutes = Math.round(sig.hoursToExit * 60);

    timeline.push({
      type: eventType,
      timestamp: sig.exitDate,
      label_en: isCashout
        ? `${fmtUsd(sig.amountUsd)} sent to CEX · ${fmtDelay(exitDelta, "en")} after shill`
        : `${fmtUsd(sig.amountUsd)} sold · ${fmtDelay(exitDelta, "en")} after shill`,
      label_fr: isCashout
        ? `${fmtUsd(sig.amountUsd)} envoyés vers CEX · ${fmtDelay(exitDelta, "fr")} après le shill`
        : `${fmtUsd(sig.amountUsd)} vendus · ${fmtDelay(exitDelta, "fr")} après le shill`,
      amount_usd: sig.amountUsd,
      delta_minutes: deltaMinutes,
      tx_hash: sig.txHash,
    });

    total_proceeds_usd += sig.amountUsd;
    if (deltaMinutes > max_delta_minutes) max_delta_minutes = deltaMinutes;
  }

  // Sort by timestamp ascending
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Deduplicate SHILL events for the same token appearing multiple times
  const seen = new Set<string>();
  const deduped: TimelineEvent[] = [];
  for (const e of timeline) {
    const key = `${e.type}:${e.timestamp.getTime()}:${e.tx_hash ?? e.evidence_url ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  const minHours = filtered.reduce((min, s) => Math.min(min, s.hoursToExit), Infinity);
  const confidence = confidenceFromHours(minHours);

  return {
    detected: true,
    confidence,
    kolHandle,
    tokenSymbol: filtered[0]?.tokenSymbol ?? tokenSymbol,
    timeline: deduped,
    total_proceeds_usd,
    max_delta_minutes,
    computed_at: now,
  };
}

// ── DB-backed entry point ────────────────────────────────────────────────────

export async function computeShillToExitResult(
  input: ShillToExitInput,
): Promise<ShillToExitResult> {
  try {
    const { detectShillToExit } = await import("./detector");
    const signals = await detectShillToExit(input.kolHandle);
    return buildShillToExitResult(input.kolHandle, signals, input.tokenMint, input.tokenSymbol);
  } catch {
    return {
      detected: false,
      confidence: "NONE",
      kolHandle: input.kolHandle,
      tokenSymbol: input.tokenSymbol,
      timeline: [],
      total_proceeds_usd: 0,
      max_delta_minutes: 0,
      computed_at: new Date(),
    };
  }
}
