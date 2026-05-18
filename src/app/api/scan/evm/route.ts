import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import {
  detectAddressType,
  detectActiveEvmChains,
} from "@/lib/evm/chainDetect";
import { emitScanCompleted } from "@/lib/events/producer";
import {
  isKnownBadEvm,
  getKnownBadGovernedStatus,
} from "@/lib/entities/knownBad";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import {
  deriveMotorSuggestedStatus,
  resolveGovernedStatus,
  GOVERNED_STATUS_LABELS,
  GOVERNED_STATUS_BASIS_LABELS,
  GOVERNED_STATUS_DISCLAIMER,
} from "@/lib/tigerscore/governedStatus";
import type { EvmChainKey } from "@/lib/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChainDetail = {
  balance: string;
  balanceRaw: string;
  isContract: boolean;
  transactionCount: number;
  explorerUrl: string;
  rpcDown: boolean;
};

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();

  const type = detectAddressType(address);
  if (type !== "evm") {
    return NextResponse.json(
      {
        error: "invalid_address",
        detail: "Address is not a valid EVM address (0x + 40 hex).",
      },
      { status: 400 }
    );
  }

  // 1) Fan-out RPC lookup across ETH / Base / Arbitrum in parallel.
  const { activeChains, details, allRpcDown } = await detectActiveEvmChains(
    address
  );

  // 2) Build per-chain detail block for the response.
  const chainDetails: Record<string, ChainDetail> = {};
  for (const chain of ["ethereum", "base", "arbitrum"] as EvmChainKey[]) {
    const d = details[chain];
    chainDetails[chain] = {
      balance: d.balance,
      balanceRaw: d.balanceRaw.toString(),
      isContract: d.isContract,
      transactionCount: d.transactionCount,
      explorerUrl: d.explorerUrl,
      rpcDown: d.rpcDown,
    };
  }

  // 3) Cross-check known-bad registry (all EVM chains share address space).
  const knownBadHit = isKnownBadEvm(address);

  // 4) Derive scoring inputs from aggregated chain data.
  //    - isContract: true if ANY chain reports contract code
  //    - balance: max balance across chains (in ETH)
  //    - txCount: max txCount across chains
  const isContractAny = Object.values(details).some((d) => d.isContract);
  const maxBalanceEth = Math.max(
    ...Object.values(details).map((d) => {
      const raw = d.balanceRaw;
      // Convert bigint wei → number ETH (safe for typical balances).
      return Number(raw / 10n ** 15n) / 1000;
    })
  );
  const maxTxCount = Math.max(
    ...Object.values(details).map((d) => d.transactionCount)
  );

  // 5) Run TigerScore engine with EVM signals + intelligence overlay.
  //    Use the primary active chain for the chain tag (spec: retain ETH by default).
  const primaryChain =
    activeChains[0] === "base"
      ? "BASE"
      : activeChains[0] === "arbitrum"
        ? "ARBITRUM"
        : "ETH";

  const tigerResult = await computeTigerScoreWithIntel(
    {
      chain: primaryChain as "ETH" | "BASE" | "ARBITRUM",
      deep: false,
      txCount: maxTxCount,
      evm_is_contract: isContractAny,
      evm_balance_eth: maxBalanceEth,
      evm_active_chains: activeChains,
      evm_known_bad: !!knownBadHit,
      evm_in_watchlist: false,
    },
    address
  );

  emitScanCompleted(address, primaryChain.toLowerCase(), tigerResult.finalScore);

  // 6) Compose final response (shape per spec).
  const signals = tigerResult.drivers.map((d) => ({
    id: d.id,
    label: d.label,
    severity: d.severity,
    delta: d.delta,
    why: d.why,
  }));

  const color: "RED" | "ORANGE" | "GREEN" =
    tigerResult.finalTier === "RED"
      ? "RED"
      : tigerResult.finalTier === "ORANGE"
        ? "ORANGE"
        : "GREEN";

  // 7) Governed Status — editorial layer, always computed alongside the score.
  //    - manual overlay (known-bad curated list) wins when present
  //    - otherwise the engine suggestion (never above corroborated_high_risk)
  //    The numeric TigerScore ceiling is untouched: evm_known_bad does NOT
  //    push the score to 100 here; the confirmation is carried as payload.
  const manualGoverned = getKnownBadGovernedStatus(address);
  const suggestedGovernedStatus = deriveMotorSuggestedStatus(
    tigerResult.finalScore,
    !!knownBadHit,
    signals.length
  );
  const governedStatus = resolveGovernedStatus(
    manualGoverned,
    suggestedGovernedStatus
  );
  const labelEntry = GOVERNED_STATUS_LABELS[governedStatus.governedStatus];
  const governedStatusLabel = {
    en: labelEntry.en,
    fr: labelEntry.fr,
    severity: labelEntry.severity,
    disclaimer: GOVERNED_STATUS_DISCLAIMER,
  };

  // Governed-status explanation block — only populated when a non-empty
  // status is attached. Consumed by the "why this score" UI panel.
  let governedStatusExplanation: { en: string; fr: string } | null = null;
  if (governedStatus.governedStatus !== "none") {
    const basisKey = governedStatus.governedStatusBasis;
    const basisLabels = basisKey ? GOVERNED_STATUS_BASIS_LABELS[basisKey] : null;
    const basisEn = basisLabels?.en ?? "engine-derived signals";
    const basisFr = basisLabels?.fr ?? "signaux moteur";
    governedStatusExplanation = {
      en: `Governed status\nThis address has been classified as ${labelEntry.en} based on ${basisEn}. This status is displayed separately from the numeric TigerScore.`,
      fr: `Statut gouverné\nCette adresse a été classée ${labelEntry.fr} sur la base de ${basisFr}. Ce statut est affiché séparément du score numérique TigerScore.`,
    };
  }

  return NextResponse.json({
    address,
    addressType: "evm" as const,
    activeChains,
    chainDetails,
    tigerScore: tigerResult.finalScore,
    color,
    tier: tigerResult.finalTier,
    signals,
    knownBad: !!knownBadHit,
    knownBadLabel: knownBadHit?.label ?? null,
    knownBadCategory: knownBadHit?.category ?? null,
    rpcDown: allRpcDown,
    ceilingApplied: tigerResult.intelligence?.ceilingApplied ?? false,
    intelligence: tigerResult.intelligence,
    governedStatus,
    suggestedGovernedStatus,
    governedStatusLabel,
    governedStatusExplanation,
  });
}
