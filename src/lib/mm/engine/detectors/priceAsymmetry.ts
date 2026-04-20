// ─── Price Asymmetry Detector (secondary corroborative, spec §7.4) ────────
// Pure function. No I/O.
//
// Over a 30-day lookback window, computes the ratio of volume traded during
// meaningful up-moves (>= +1%) vs. meaningful down-moves (<= -1%). A ratio
// ≥ 3.0 is considered suspicious.
//
// IMPORTANT (spec §7.4 — règle de co-occurrence): this detector is
// corroborative only. The output carries `corroborativeOnly: true` in its
// evidence and emits a `scoreIfCoOccurrent` field so the runner can decide
// whether to admit the points. The detector itself never adds to the final
// score unless at least one core detector emitted a HIGH signal.

import type {
  DetectorOutput,
  DetectorSignal,
  PriceAsymmetryInput,
  PriceMove,
  Severity,
} from "../types";
import { PRICE_ASYMMETRY_MAX } from "../scoring/weights";

const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3_600; // 30 days
const DEFAULT_RATIO_THRESHOLD = 3.0;
const MEANINGFUL_MOVE_PCT = 1.0;

interface AsymmetryMetrics {
  upVolumeUsd: number;
  downVolumeUsd: number;
  neutralVolumeUsd: number;
  ratio: number;
  moveCount: number;
  windowStart: number;
  windowEnd: number;
}

export function computeAsymmetry(
  moves: PriceMove[],
  windowSeconds: number = DEFAULT_WINDOW_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AsymmetryMetrics {
  const windowStart = nowSeconds - windowSeconds;
  let up = 0;
  let down = 0;
  let neutral = 0;
  let count = 0;
  for (const m of moves) {
    if (m.timestamp < windowStart || m.timestamp > nowSeconds) continue;
    count += 1;
    if (m.priceChangePct >= MEANINGFUL_MOVE_PCT) up += Math.max(0, m.volumeUsd);
    else if (m.priceChangePct <= -MEANINGFUL_MOVE_PCT)
      down += Math.max(0, m.volumeUsd);
    else neutral += Math.max(0, m.volumeUsd);
  }
  const ratio = down > 0 ? up / down : up > 0 ? Number.POSITIVE_INFINITY : 0;
  return {
    upVolumeUsd: up,
    downVolumeUsd: down,
    neutralVolumeUsd: neutral,
    ratio,
    moveCount: count,
    windowStart,
    windowEnd: nowSeconds,
  };
}

export function runPriceAsymmetryDetector(
  input: PriceAsymmetryInput,
): DetectorOutput {
  const started = performance.now();
  const windowSeconds = input.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const threshold = input.ratioThreshold ?? DEFAULT_RATIO_THRESHOLD;
  const nowSeconds =
    input.nowSeconds ?? Math.floor(Date.now() / 1000);

  const m = computeAsymmetry(input.moves, windowSeconds, nowSeconds);

  const signals: DetectorSignal[] = [];
  let scoreIfAdmitted = 0;

  if (m.moveCount > 0 && m.ratio >= threshold) {
    const severity: Severity = m.ratio >= 5.0 ? "HIGH" : "MEDIUM";
    signals.push({
      type: "PRICE_ASYMMETRY",
      severity,
      metric: Number.isFinite(m.ratio) ? m.ratio : threshold * 10,
      baseline: threshold,
      description: `Up/down volume ratio ${
        Number.isFinite(m.ratio) ? m.ratio.toFixed(2) : "∞"
      } over the window — asymmetric price behaviour.`,
      extra: {
        upVolumeUsd: m.upVolumeUsd,
        downVolumeUsd: m.downVolumeUsd,
        neutralVolumeUsd: m.neutralVolumeUsd,
        windowDays: Math.round(windowSeconds / 86_400),
      },
    });
    scoreIfAdmitted = PRICE_ASYMMETRY_MAX;
  }

  return {
    detectorType: "PRICE_ASYMMETRY",
    // Score is zero until a core detector co-occurs. The runner re-admits
    // `scoreIfCoOccurrent` when the gate passes.
    score: 0,
    maxScore: PRICE_ASYMMETRY_MAX,
    signals,
    evidence: {
      tokenId: input.tokenId,
      chain: input.chain,
      corroborativeOnly: true,
      scoreIfCoOccurrent: scoreIfAdmitted,
      ratio: Number.isFinite(m.ratio) ? m.ratio : null,
      upVolumeUsd: m.upVolumeUsd,
      downVolumeUsd: m.downVolumeUsd,
      neutralVolumeUsd: m.neutralVolumeUsd,
      moveCount: m.moveCount,
      thresholdUsed: threshold,
      windowStart: m.windowStart,
      windowEnd: m.windowEnd,
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
