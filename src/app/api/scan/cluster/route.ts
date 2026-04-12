import { NextRequest, NextResponse } from "next/server";
import { isKnownBad } from "@/lib/entities/knownBad";
import { prisma } from "@/lib/prisma";
import { isPumpLikeToken } from "@/lib/tigerscore/engine";

export const dynamic = "force-dynamic";

type ClusterRiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

interface ClusterResult {
  deployerAddress: string | null;
  deployerKnown: boolean;
  kolHandle: string | null;
  relatedTokens: number;
  redTokens: number;
  clusterRisk: ClusterRiskLevel;
  signal: string;
  signalFr: string;
  fallback: boolean;
}

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const HELIUS_TIMEOUT = 3000;

const FALLBACK: ClusterResult = {
  deployerAddress: null,
  deployerKnown: false,
  kolHandle: null,
  relatedTokens: 0,
  redTokens: 0,
  clusterRisk: "UNKNOWN",
  signal: "No cluster signal detected",
  signalFr: "Signal cluster indisponible",
  fallback: true,
};

async function heliusDas(method: string, params: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HELIUS_TIMEOUT);
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    return j.result ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function buildSignal(
  deployerKnown: boolean,
  kolHandle: string | null,
  relatedTokens: number,
  redTokens: number,
  risk: ClusterRiskLevel,
): { signal: string; signalFr: string } {
  if (risk === "HIGH") {
    if (deployerKnown && kolHandle) {
      return {
        signal: `Deployer linked to @${kolHandle} — ${redTokens} prior rug${redTokens !== 1 ? "s" : ""} detected`,
        signalFr: `Déployeur lié à @${kolHandle} — ${redTokens} rug${redTokens !== 1 ? "s" : ""} précédent${redTokens !== 1 ? "s" : ""} détecté${redTokens !== 1 ? "s" : ""}`,
      };
    }
    return {
      signal: `Related deployers found — deployer linked to ${redTokens} prior rug${redTokens !== 1 ? "s" : ""}`,
      signalFr: `Déployeur lié à ${redTokens} rug${redTokens !== 1 ? "s" : ""} précédent${redTokens !== 1 ? "s" : ""}`,
    };
  }
  if (risk === "MEDIUM") {
    return {
      signal: `Deployer pattern detected — ${relatedTokens} related token${relatedTokens !== 1 ? "s" : ""} found`,
      signalFr: `Pattern de déploiement détecté — ${relatedTokens} token${relatedTokens !== 1 ? "s" : ""} lié${relatedTokens !== 1 ? "s" : ""}`,
    };
  }
  return {
    signal: "No significant cluster risk detected",
    signalFr: "Aucun risque cluster significatif",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim();
  const chain = (searchParams.get("chain") ?? "").toLowerCase();

  if (!address || chain !== "sol") {
    return NextResponse.json(FALLBACK);
  }

  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json(FALLBACK);
  }

  try {
    // 1. Get asset info (DAS API) to find deployer/authority
    const asset = await heliusDas("getAsset", { id: address });
    if (!asset) return NextResponse.json(FALLBACK);

    // Extract deployer: first authority, or first creator
    let deployerAddress: string | null = null;
    const authorities: { address: string; scopes: string[] }[] =
      asset.authorities ?? [];
    const creators: { address: string; share: number; verified: boolean }[] =
      asset.creators ?? [];

    if (authorities.length > 0) {
      deployerAddress = authorities[0].address;
    }
    if (!deployerAddress && creators.length > 0) {
      deployerAddress = creators[0].address;
    }
    if (!deployerAddress) return NextResponse.json(FALLBACK);

    // 2. Check deployer against knownBad + KolWallet
    const badEntry = isKnownBad("SOL", deployerAddress);
    let kolHandle: string | null = null;
    try {
      const kolWallet = await prisma.kolWallet.findFirst({
        where: { address: deployerAddress },
        select: { kolHandle: true },
      });
      if (kolWallet) kolHandle = kolWallet.kolHandle;
    } catch {
      // DB error is soft — don't crash
    }
    const deployerKnown = !!badEntry || !!kolHandle;

    // 3. Get all tokens by this authority (DAS API)
    const byAuth = await heliusDas("getAssetsByAuthority", {
      authorityAddress: deployerAddress,
      page: 1,
      limit: 100,
    });

    let relatedTokens = 0;
    let redTokens = 0;

    if (byAuth && Array.isArray(byAuth.items)) {
      const items = byAuth.items;
      relatedTokens = items.length;

      for (const item of items) {
        const id: string = item.id ?? "";
        if (id === address) continue; // skip the scanned token itself

        // Check pump-like
        const symbol: string = item.content?.metadata?.symbol ?? "";
        const uri: string = item.content?.json_uri ?? "";
        if (isPumpLikeToken(id, uri)) {
          redTokens++;
          continue;
        }

        // Check if mutable metadata or freeze authority present
        const frozen = item.ownership?.frozen === true;
        const mutable = item.mutable === true;
        if (frozen || mutable) {
          redTokens++;
        }
      }
    }

    // 4. Compute risk level
    let clusterRisk: ClusterRiskLevel = "LOW";
    if (deployerKnown || redTokens >= 3) {
      clusterRisk = "HIGH";
    } else if (relatedTokens >= 5 || redTokens >= 1) {
      clusterRisk = "MEDIUM";
    }

    const { signal, signalFr } = buildSignal(
      deployerKnown,
      kolHandle,
      relatedTokens,
      redTokens,
      clusterRisk,
    );

    const result: ClusterResult = {
      deployerAddress,
      deployerKnown,
      kolHandle,
      relatedTokens,
      redTokens,
      clusterRisk,
      signal,
      signalFr,
      fallback: false,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.warn("[cluster] error", err);
    return NextResponse.json(FALLBACK);
  }
}
