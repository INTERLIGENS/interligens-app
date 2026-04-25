// src/lib/kol/cexTracker.ts
// CEX deposit detector — supplements proceeds.ts with a broader address list
// and ETH chain support via Etherscan.
// SOL detection uses Helius; ETH detection uses Etherscan.

import { prisma } from "@/lib/prisma";
import { emitProceedsRecomputed } from "@/lib/events/producer";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "";
const ETH_RPC = "https://ethereum.publicnode.com";

export interface CexDepositResult {
  cex: string;
  confidence: "high" | "medium";
  address: string;
  chain: string;
}

// Publicly documented hot-wallet / deposit addresses per major CEX.
// Source: on-chain analytics (Etherscan, SolanaFM public labels).
const CEX_MAP: Record<string, { name: string; chains: string[] }> = {
  // Binance SOL
  "U5dmHQtEhVTHjBNRgZbKMkyPjBkqXBX8Bxu5YobqXpF": { name: "Binance", chains: ["SOL"] },
  "3g1hYfna2A1nj7WZctKeYYb5eNEQHobvFbwhRrnh5xQx": { name: "Binance", chains: ["SOL"] },
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": { name: "Binance", chains: ["SOL"] },
  "5tzFkiKscXHK5ZXCGbXZxdw7ghr81VzKdDCX45QoB6YW": { name: "Binance", chains: ["SOL"] },
  "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2": { name: "Binance", chains: ["SOL"] },
  // Coinbase SOL
  "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": { name: "Coinbase", chains: ["SOL"] },
  "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn39cS": { name: "Coinbase", chains: ["SOL"] },
  // OKX SOL
  "7MzxkMmHKVT6HPHRW4UBdnRNZwqbhNzEXXRxvf4Y9Jbr": { name: "OKX", chains: ["SOL"] },
  "3Tj2QRFBFNRGjDTCnSjKzuTCY1WRfNuZ7VFMUcB2vL2T": { name: "OKX", chains: ["SOL"] },
  // Bybit SOL
  "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": { name: "Bybit", chains: ["SOL"] },
  // Binance ETH (hot wallets)
  "0x28c6c06298d514db089934071355e5743bf21d60": { name: "Binance", chains: ["ETH"] },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": { name: "Binance", chains: ["ETH"] },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": { name: "Binance", chains: ["ETH"] },
  // Coinbase ETH
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": { name: "Coinbase", chains: ["ETH"] },
  "0x77696bb39917c91a0c3908d577d5e322095425ca": { name: "Coinbase", chains: ["ETH"] },
  // OKX ETH
  "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b": { name: "OKX", chains: ["ETH"] },
  "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3": { name: "OKX", chains: ["ETH"] },
  // Bybit ETH
  "0xf89d7b9c864f589bbf53a82105107622b35eaa40": { name: "Bybit", chains: ["ETH"] },
};

/**
 * Check if a destination address is a known CEX deposit address.
 * Also queries AddressLabel table for dynamically labeled addresses.
 */
export async function detectCexDeposit(
  toAddress: string,
  chain: string,
): Promise<CexDepositResult | null> {
  const normalized = toAddress.startsWith("0x") ? toAddress.toLowerCase() : toAddress;

  // 1. Static map
  const hit = CEX_MAP[normalized];
  if (hit) {
    return { cex: hit.name, confidence: "high", address: normalized, chain };
  }

  // 2. AddressLabel table
  try {
    const label = await prisma.addressLabel.findFirst({
      where: {
        address: { equals: normalized, mode: "insensitive" },
        chain,
        labelType: "cex",
        isActive: true,
      },
      select: { label: true, entityName: true },
    });
    if (label) {
      return {
        cex: label.entityName ?? label.label,
        confidence: "medium",
        address: normalized,
        chain,
      };
    }
  } catch {
    // AddressLabel lookup failure is non-fatal
  }

  return null;
}

async function fetchSolTransactions(address: string): Promise<{ txHash: string; toAddress: string; amountSol: number; timestamp: number }[]> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [address, { limit: 30 }] }),
      signal: AbortSignal.timeout(12000),
    });
    const { result: sigs } = await res.json();
    if (!sigs?.length) return [];

    const results: { txHash: string; toAddress: string; amountSol: number; timestamp: number }[] = [];
    for (const sig of sigs.slice(0, 15)) {
      try {
        const txRes = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }),
          signal: AbortSignal.timeout(10000),
        });
        const { result: tx } = await txRes.json();
        if (!tx?.meta || tx.meta.err) continue;

        const accountKeys: string[] = tx.transaction?.message?.accountKeys?.map((k: { pubkey?: string; accountKey?: string }) => k.pubkey ?? k.accountKey ?? "") ?? [];
        const preBalances: number[] = tx.meta.preBalances ?? [];
        const postBalances: number[] = tx.meta.postBalances ?? [];

        for (let i = 1; i < accountKeys.length; i++) {
          const delta = (postBalances[i] ?? 0) - (preBalances[i] ?? 0);
          if (delta > 10_000_000) { // > 0.01 SOL received
            results.push({
              txHash: sig.signature,
              toAddress: accountKeys[i],
              amountSol: delta / 1e9,
              timestamp: tx.blockTime ?? 0,
            });
          }
        }
      } catch { /* skip individual TX errors */ }
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchEthTransactions(address: string): Promise<{ txHash: string; toAddress: string; amountEth: number; timestamp: number }[]> {
  if (!ETHERSCAN_KEY) return [];
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=30&apikey=${ETHERSCAN_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const { result } = await res.json();
    if (!Array.isArray(result)) return [];

    return result
      .filter((tx: { isError: string }) => tx.isError === "0")
      .slice(0, 20)
      .map((tx: { hash: string; to: string; value: string; timeStamp: string }) => ({
        txHash: tx.hash,
        toAddress: (tx.to ?? "").toLowerCase(),
        amountEth: Number(tx.value) / 1e18,
        timestamp: Number(tx.timeStamp),
      }));
  } catch {
    return [];
  }
}

/**
 * Scans a wallet for CEX deposit transactions and persists new KolProceedsEvent rows.
 * Called from helius-scan cron after the main proceeds scan.
 * Non-throwing: failures are logged but don't propagate.
 */
export async function scanWalletForCexDeposits(
  walletAddress: string,
  chain: string,
  kolHandle: string,
): Promise<number> {
  let newEvents = 0;
  try {
    const isSol = chain === "SOL";
    const isEth = chain === "ETH";

    if (!isSol && !isEth) return 0;

    const txs = isSol
      ? await fetchSolTransactions(walletAddress)
      : await fetchEthTransactions(walletAddress);

    for (const tx of txs) {
      const cex = await detectCexDeposit(tx.toAddress, chain);
      if (!cex) continue;

      const amountUsd = isSol
        ? (tx as { amountSol: number }).amountSol * 150  // rough SOL price; pricing engine owns accuracy
        : (tx as { amountEth: number }).amountEth * 3000;  // rough ETH price

      const eventDate = new Date((isSol ? (tx as { timestamp: number }).timestamp : (tx as { timestamp: number }).timestamp) * 1000);

      try {
        await prisma.$executeRaw`
          INSERT INTO "KolProceedsEvent"
            (id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
             "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd",
             "priceUsdAtTime", "pricingSource", "eventType", "ambiguous", "caseId")
          VALUES
            (gen_random_uuid()::text, ${kolHandle}, ${walletAddress}, ${chain},
             ${tx.txHash}, ${eventDate},
             ${isSol ? "SOL" : "ETH"}, null, null, ${amountUsd},
             null, 'CEX_DETECTED', 'cex_deposit', true, null)
          ON CONFLICT ("txHash") DO NOTHING
        `;
        newEvents++;
      } catch { /* conflict or schema error — non-fatal */ }
    }

    if (newEvents > 0) {
      emitProceedsRecomputed(kolHandle, 0);
      console.log(`[cexTracker] ${newEvents} new CEX deposit(s) for @${kolHandle} wallet ${walletAddress.slice(0, 8)}...`);
    }
  } catch (err) {
    console.error(`[cexTracker] scanWalletForCexDeposits failed for ${walletAddress}`, err);
  }
  return newEvents;
}
