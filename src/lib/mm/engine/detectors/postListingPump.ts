// ─── Post-Listing Pump Detector (secondary corroborative, spec §7.5) ──────
// Pure function. No I/O.
//
// Flags tokens that have pumped > +100% within 7 days of listing AND whose
// volume is concentrated in a small number of wallets (top-N > 70%). Like
// priceAsymmetry this detector is corroborative only: its score is zero
// unless a core detector emits a HIGH signal in the same scan.

import type {
  DetectorOutput,
  DetectorSignal,
  PostListingPumpInput,
} from "../types";
import { POST_LISTING_PUMP_MAX } from "../scoring/weights";

const DEFAULT_PUMP_THRESHOLD = 1.0; // +100%
const DEFAULT_CONCENTRATION_THRESHOLD = 0.7; // top-N > 70%
const DEFAULT_TOPN = 10;

export function computePumpMetrics(input: PostListingPumpInput): {
  performancePct: number;
  topNShare: number;
  topNWallets: string[];
  totalVolumeUsd: number;
} {
  const performance =
    input.priceAtListing > 0
      ? (input.priceAt7Days - input.priceAtListing) / input.priceAtListing
      : 0;

  const topN = input.topN ?? DEFAULT_TOPN;
  const sorted = [...input.volumeByWallet].sort(
    (a, b) => b.volumeUsd - a.volumeUsd,
  );
  const top = sorted.slice(0, topN);
  const totalUsd =
    input.totalVolumeUsd > 0
      ? input.totalVolumeUsd
      : sorted.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  const topSum = top.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  const share = totalUsd > 0 ? topSum / totalUsd : 0;
  return {
    performancePct: performance,
    topNShare: share,
    topNWallets: top.map((v) => v.wallet),
    totalVolumeUsd: totalUsd,
  };
}

export function runPostListingPumpDetector(
  input: PostListingPumpInput,
): DetectorOutput {
  const started = performance.now();

  const pumpThreshold = input.pumpThreshold ?? DEFAULT_PUMP_THRESHOLD;
  const concentrationThreshold =
    input.concentrationThreshold ?? DEFAULT_CONCENTRATION_THRESHOLD;
  const topN = input.topN ?? DEFAULT_TOPN;

  const m = computePumpMetrics(input);
  const signals: DetectorSignal[] = [];
  let scoreIfAdmitted = 0;

  const pumpHit = m.performancePct > pumpThreshold;
  const concentrationHit = m.topNShare > concentrationThreshold;

  if (pumpHit && concentrationHit) {
    signals.push({
      type: "POST_LISTING_PUMP",
      severity: "HIGH",
      metric: m.performancePct,
      baseline: pumpThreshold,
      description: `+${(m.performancePct * 100).toFixed(0)}% within 7 days with top-${topN} share ${(m.topNShare * 100).toFixed(1)}% — classic post-listing pump pattern.`,
      extra: {
        topNShare: m.topNShare,
        topNWallets: m.topNWallets,
        totalVolumeUsd: m.totalVolumeUsd,
      },
    });
    scoreIfAdmitted = POST_LISTING_PUMP_MAX;
  } else if (pumpHit || concentrationHit) {
    signals.push({
      type: "POST_LISTING_PUMP_PARTIAL",
      severity: "LOW",
      description: pumpHit
        ? `Pump ${(m.performancePct * 100).toFixed(0)}% but volume distribution is diverse.`
        : `Concentration ${(m.topNShare * 100).toFixed(1)}% but price has not pumped.`,
      extra: { pumpHit, concentrationHit },
    });
  }

  return {
    detectorType: "POST_LISTING_PUMP",
    score: 0,
    maxScore: POST_LISTING_PUMP_MAX,
    signals,
    evidence: {
      tokenId: input.tokenId,
      chain: input.chain,
      corroborativeOnly: true,
      scoreIfCoOccurrent: scoreIfAdmitted,
      performancePct: m.performancePct,
      topNShare: m.topNShare,
      topNWallets: m.topNWallets,
      totalVolumeUsd: m.totalVolumeUsd,
      listingDate: input.listingDate,
      priceAtListing: input.priceAtListing,
      priceAt7Days: input.priceAt7Days,
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
