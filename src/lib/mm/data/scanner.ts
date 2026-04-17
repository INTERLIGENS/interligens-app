// ─── MM Tracker data layer — scanner orchestrator ────────────────────────
// Top-level entry points that wire: fetch (etherscan/helius/birdeye) →
// transform → runScan (engine) → persist (MmScanRun) → cache (MmScore).
//
// Key invariants:
//   • Every upstream error is caught, logged into the `errors` field of the
//     persisted scan run, and does NOT abort the whole scan — the detectors
//     still run on whatever data landed. Missing signals lower coverage.
//   • Scanner NEVER reaches into the Registry — attribution is the adapter's
//     responsibility.
//   • cohortKey is optional; when provided it's passed through to runScan.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runScan, runScanWithCohort } from "../engine/scanRun/runner";
import { persistScanRun } from "../engine/scanRun/persist";
import type { MmChain, MmSubjectType } from "../types";
import { MM_SCHEMA_VERSION } from "../types";
import type {
  CohortPercentiles,
  ScanRunInput,
  ScanRunResult,
} from "../engine/types";
import {
  fetchTokenTransfers,
  fetchWalletTransactions,
  type EtherscanFetchOptions,
} from "./etherscan";
import {
  fetchSolanaTransactions,
  type HeliusFetchOptions,
} from "./helius";
import {
  fetchTokenPriceHistory,
  fetchTokenVolumeByWallet,
  type BirdeyeFetchOptions,
} from "./birdeye";
import {
  toClusterInput,
  toConcentrationInput,
  toPostListingPumpInput,
  toPriceAsymmetryInput,
  toWashTradingInput,
} from "./transformer";

// ─── Shared options ──────────────────────────────────────────────────────

export interface ScannerOptions {
  etherscan?: EtherscanFetchOptions;
  helius?: HeliusFetchOptions;
  birdeye?: BirdeyeFetchOptions;
  cohortKey?: string;
  cohortPercentiles?: CohortPercentiles;
  walletAgeDays?: number;
  /** Override "now" for deterministic tests. */
  nowSeconds?: number;
  /** Don't write MmScanRun / MmScore rows. */
  persist?: boolean;
  /** Trigger source, defaults to API_PUBLIC. */
  triggeredBy?:
    | "CRON"
    | "API_PUBLIC"
    | "API_ADMIN"
    | "TIGERSCORE_INTEGRATION"
    | "BATCH_SCAN";
  triggeredByRef?: string | null;
  /** Skip token volume fetching (scanToken-specific gate). */
  skipBirdeye?: boolean;
}

interface Errors {
  list: Array<{ source: string; message: string }>;
}

function newErrors(): Errors {
  return { list: [] };
}

function capture(errors: Errors, source: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  errors.list.push({ source, message });
}

// ─── EVM wallet fetching ─────────────────────────────────────────────────

async function fetchEvmWalletData(
  address: string,
  chain: MmChain,
  errors: Errors,
  opts: ScannerOptions,
) {
  const txs: Awaited<ReturnType<typeof fetchWalletTransactions>> = [];
  let tokenTxs: Awaited<ReturnType<typeof fetchTokenTransfers>> = [];
  try {
    const plain = await fetchWalletTransactions(
      address,
      chain,
      { limit: 1_000 },
      opts.etherscan ?? {},
    );
    txs.push(...plain);
  } catch (err) {
    capture(errors, "etherscan.txlist", err);
  }
  try {
    tokenTxs = await fetchTokenTransfers(
      address,
      chain,
      undefined,
      { limit: 1_000 },
      opts.etherscan ?? {},
    );
  } catch (err) {
    capture(errors, "etherscan.tokentx", err);
  }
  return { txs, tokenTxs };
}

// ─── Solana wallet fetching ──────────────────────────────────────────────

async function fetchSolanaWalletData(
  address: string,
  errors: Errors,
  opts: ScannerOptions,
) {
  try {
    return await fetchSolanaTransactions(
      address,
      { limit: 100 },
      opts.helius ?? {},
    );
  } catch (err) {
    capture(errors, "helius.transactions", err);
    return [];
  }
}

// ─── Token-level fetching (volumes + price) ──────────────────────────────

async function fetchTokenContext(
  tokenAddress: string,
  chain: MmChain,
  errors: Errors,
  opts: ScannerOptions,
) {
  if (opts.skipBirdeye) {
    return { volumes: [], priceHistory: [] };
  }
  let volumes: Awaited<ReturnType<typeof fetchTokenVolumeByWallet>> = [];
  let priceHistory: Awaited<ReturnType<typeof fetchTokenPriceHistory>> = [];
  try {
    volumes = await fetchTokenVolumeByWallet(
      tokenAddress,
      chain,
      { limit: 200 },
      opts.birdeye ?? {},
    );
  } catch (err) {
    capture(errors, "birdeye.volumeByWallet", err);
  }
  try {
    priceHistory = await fetchTokenPriceHistory(
      tokenAddress,
      chain,
      { interval: "1H" },
      opts.birdeye ?? {},
    );
  } catch (err) {
    capture(errors, "birdeye.priceHistory", err);
  }
  return { volumes, priceHistory };
}

// ─── Persistence + cache ──────────────────────────────────────────────────

async function maybePersist(
  result: ScanRunResult,
  errors: Errors,
  opts: ScannerOptions,
): Promise<string | null> {
  if (opts.persist === false) return null;
  try {
    const run = await persistScanRun(result, {
      triggeredBy: opts.triggeredBy ?? "API_PUBLIC",
      triggeredByRef: opts.triggeredByRef ?? null,
      cohortKey: result.cohortKey ?? opts.cohortKey,
      cohortPercentiles:
        (result.cohortPercentiles as unknown as Record<string, unknown>) ?? undefined,
      dataSources: { errors: errors.list },
    });
    await refreshCache(result, run.id);
    return run.id;
  } catch (err) {
    capture(errors, "persist.scanRun", err);
    return null;
  }
}

async function refreshCache(
  result: ScanRunResult,
  scanRunId: string,
): Promise<void> {
  const computedAt = new Date();
  const expiresAt = new Date(computedAt.getTime() + 6 * 60 * 60 * 1_000);
  const snapshot = {
    registry: { entity: null, attribution: null, registryDrivenScore: 0 },
    engine: {
      behaviorDrivenScore: result.behaviorDrivenScore,
      rawBehaviorScore: result.rawBehaviorScore,
      confidence: result.confidence,
      coverage: result.coverage,
      signals: result.signals,
      detectorBreakdown: result.detectorBreakdown,
      capsApplied: result.capsApplied,
      coOccurrence: result.coOccurrence,
      cohortKey: result.cohortKey,
      cohortPercentiles: result.cohortPercentiles,
    },
    overall: {
      displayScore: result.behaviorDrivenScore,
      band:
        result.behaviorDrivenScore >= 70
          ? "RED"
          : result.behaviorDrivenScore >= 40
            ? "ORANGE"
            : result.behaviorDrivenScore >= 20
              ? "YELLOW"
              : "GREEN",
      dominantDriver: result.behaviorDrivenScore >= 20 ? "BEHAVIORAL" : "NONE",
      displayReason: "BEHAVIORAL_PATTERN_MEDIUM",
      disclaimer: "",
      freshness: {
        computedAt: computedAt.toISOString(),
        ageMinutes: 0,
        staleness: "fresh",
      },
    },
    subjectType: result.subjectType,
    subjectId: result.subjectId,
    chain: result.chain,
    scanRunId,
    schemaVersion: MM_SCHEMA_VERSION,
    computedAt: computedAt.toISOString(),
    source: "compute",
  };
  await prisma.mmScore.upsert({
    where: {
      subjectType_subjectId_chain: {
        subjectType: result.subjectType,
        subjectId: result.subjectId,
        chain: result.chain,
      },
    },
    update: {
      registryDrivenScore: 0,
      behaviorDrivenScore: result.behaviorDrivenScore,
      displayScore: result.behaviorDrivenScore,
      band: snapshot.overall.band as "GREEN" | "YELLOW" | "ORANGE" | "RED",
      confidence: result.confidence,
      coverage: result.coverage,
      dominantDriver: snapshot.overall.dominantDriver,
      displayReason: snapshot.overall.displayReason,
      breakdown: snapshot as unknown as Prisma.InputJsonValue,
      signalsCount: result.signals.length,
      scanRunId,
      computedAt,
      expiresAt,
      schemaVersion: MM_SCHEMA_VERSION,
    },
    create: {
      subjectType: result.subjectType,
      subjectId: result.subjectId,
      chain: result.chain,
      registryDrivenScore: 0,
      behaviorDrivenScore: result.behaviorDrivenScore,
      displayScore: result.behaviorDrivenScore,
      band: snapshot.overall.band as "GREEN" | "YELLOW" | "ORANGE" | "RED",
      confidence: result.confidence,
      coverage: result.coverage,
      dominantDriver: snapshot.overall.dominantDriver,
      displayReason: snapshot.overall.displayReason,
      breakdown: snapshot as unknown as Prisma.InputJsonValue,
      signalsCount: result.signals.length,
      scanRunId,
      computedAt,
      expiresAt,
      schemaVersion: MM_SCHEMA_VERSION,
    },
  });
}

// ─── scanWallet ──────────────────────────────────────────────────────────

export async function scanWallet(
  address: string,
  chain: MmChain,
  opts: ScannerOptions = {},
): Promise<ScanRunResult> {
  const errors = newErrors();
  const subjectType: MmSubjectType = "WALLET";

  let washTradingInput: ScanRunInput["washTrading"] | undefined;
  let clusterInput: ScanRunInput["cluster"] | undefined;

  if (chain === "SOLANA") {
    const solTxs = await fetchSolanaWalletData(address, errors, opts);
    if (solTxs.length > 0) {
      washTradingInput = toWashTradingInput(solTxs, address, {
        tokenId: "SOL:wallet",
        chain,
      });
      clusterInput = toClusterInput(solTxs, {
        targetWallet: address.toLowerCase(),
        chain,
      });
    }
  } else {
    const { txs, tokenTxs } = await fetchEvmWalletData(
      address,
      chain,
      errors,
      opts,
    );
    const combined = [...txs, ...tokenTxs];
    if (combined.length > 0) {
      washTradingInput = toWashTradingInput(combined, address, {
        tokenId: `${chain}:wallet`,
        chain,
      });
      clusterInput = toClusterInput(txs, {
        targetWallet: address.toLowerCase(),
        chain,
      });
    }
  }

  const input: ScanRunInput = {
    subjectType,
    subjectId: address,
    chain,
    washTrading: washTradingInput,
    cluster: clusterInput,
    walletAgeDays: opts.walletAgeDays,
    cohortKey: opts.cohortKey,
    cohortPercentiles: opts.cohortPercentiles,
    dataSources: { errors: errors.list },
  };

  const result =
    input.cohortKey && !input.cohortPercentiles
      ? await runScanWithCohort(input)
      : runScan(input);

  await maybePersist(result, errors, opts);
  return {
    ...result,
    signals: result.signals,
  };
}

// ─── scanToken ───────────────────────────────────────────────────────────

export async function scanToken(
  tokenAddress: string,
  chain: MmChain,
  opts: ScannerOptions = {},
): Promise<ScanRunResult> {
  const errors = newErrors();
  const subjectType: MmSubjectType = "TOKEN";

  const { volumes, priceHistory } = await fetchTokenContext(
    tokenAddress,
    chain,
    errors,
    opts,
  );

  // Wash-trading input — for a token subject, reuse top-volume wallet txs.
  let washTradingInput: ScanRunInput["washTrading"] | undefined;
  if (chain !== "SOLANA" && volumes.length > 0) {
    try {
      const top = volumes[0].wallet;
      const topTxs = await fetchTokenTransfers(
        top,
        chain,
        tokenAddress,
        { limit: 200 },
        opts.etherscan ?? {},
      );
      if (topTxs.length > 0) {
        washTradingInput = toWashTradingInput(topTxs, top, {
          tokenId: tokenAddress.toLowerCase(),
          chain,
        });
      }
    } catch (err) {
      capture(errors, "etherscan.topHolderTxs", err);
    }
  }

  const concentrationInput =
    volumes.length > 0
      ? toConcentrationInput(volumes, {
          tokenId: tokenAddress.toLowerCase(),
          chain,
        })
      : undefined;

  const priceAsymmetryInput =
    priceHistory.length > 0
      ? toPriceAsymmetryInput(priceHistory, {
          tokenId: tokenAddress.toLowerCase(),
          chain,
          nowSeconds: opts.nowSeconds,
        })
      : undefined;

  const postListingPumpInput =
    priceHistory.length > 0 && volumes.length > 0
      ? toPostListingPumpInput(priceHistory, volumes, {
          tokenId: tokenAddress.toLowerCase(),
          chain,
          listingDate: priceHistory[0].timestamp,
        })
      : undefined;

  const input: ScanRunInput = {
    subjectType,
    subjectId: tokenAddress,
    chain,
    washTrading: washTradingInput,
    concentration: concentrationInput,
    priceAsymmetry: priceAsymmetryInput,
    postListingPump: postListingPumpInput,
    cohortKey: opts.cohortKey,
    cohortPercentiles: opts.cohortPercentiles,
    dataSources: { errors: errors.list },
  };

  const result =
    input.cohortKey && !input.cohortPercentiles
      ? await runScanWithCohort(input)
      : runScan(input);

  await maybePersist(result, errors, opts);
  return result;
}
