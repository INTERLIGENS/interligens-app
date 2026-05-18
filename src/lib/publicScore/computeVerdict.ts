import { isValidEvmAddress } from "./schema";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { prisma } from "@/lib/prisma";
import type { SwapVerdict } from "@/lib/safe-swap/types";

function toVerdict(score: number): SwapVerdict {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

async function getScamLineage(mint: string): Promise<"CONFIRMED" | "REFERENCED" | "NONE"> {
  try {
    const graphCase = await prisma.graphCase.findFirst({
      where: { pivotAddress: mint },
      include: { nodes: { select: { flagged: true } } },
    });
    if (!graphCase) return "NONE";
    const flaggedNodes = graphCase.nodes.filter((n) => n.flagged);
    return flaggedNodes.length > 0 ? "CONFIRMED" : "NONE";
  } catch {
    return "NONE";
  }
}

export async function computeVerdict(mint: string): Promise<SwapVerdict> {
  const isEvm = isValidEvmAddress(mint);

  if (isEvm) {
    const normalized = mint.toLowerCase();
    const knownBad = isKnownBadEvm(normalized);
    const intel = await computeTigerScoreWithIntel(
      { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false },
      normalized,
    );
    return toVerdict(intel.finalScore);
  }

  const [caseFile, market, scamLineage] = await Promise.all([
    Promise.resolve(loadCaseByMint(mint)),
    getMarketSnapshot("solana", mint),
    getScamLineage(mint),
  ]);

  const tigerScan = computeTigerScoreFromScan({
    chain: "SOL",
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: mint,
    market_url: market.url,
    pair_age_days: market.pair_age_days,
    liquidity_usd: market.liquidity_usd,
    fdv_usd: market.fdv_usd,
    volume_24h_usd: market.volume_24h_usd,
    scam_lineage: scamLineage,
    signals: {
      confirmedCriticalClaims:
        (caseFile?.claims ?? []).filter(
          (cl) =>
            cl.severity === "CRITICAL" &&
            (cl.status === "CONFIRMED" || cl.status === "DISPUTED"),
        ).length,
      knownBadAddresses: 0,
    },
  });

  const intel = await computeTigerScoreWithIntel(
    { chain: "SOL", scan_type: "token", no_casefile: !caseFile, mint_address: mint },
    mint,
  );

  return toVerdict(Math.max(tigerScan.score, intel.finalScore));
}
