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
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
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
    intelligence: tigerResult.intelligence,
  });
}
