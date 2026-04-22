// src/lib/kol/proceeds.ts
// Observed Proceeds computation engine — v1 methodology

import { PrismaClient } from "@prisma/client";
import { getPriceAtDate, clearPriceCache } from "@/lib/kol/pricing";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

const CEX_ADDRESSES = new Set([
  "U5dmHQtEhVTHjBNRgZbKMkyPjBkqXBX8Bxu5YobqXpF",
  "3g1hYfna2A1nj7WZctKeYYb5eNEQHobvFbwhRrnh5xQx",
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
]);

const CA_MAP: Record<string, string> = {
  "BOTIFY":        "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  "BOTIFY-MAIN":   "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  "GHOST":         "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump",
  "GHOST-RUG":     "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump",
  "DIONE-RUG":     "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump",
  "SERIAL-12RUGS": "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
};

async function helius(method: string, params: any[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  return j.result ?? null;
}

async function fetchSOLEventsForCA(
  walletAddress: string,
  tokenCA: string,
  caseId: string,
  knownWalletAddresses: Set<string>
): Promise<any[]> {
  const events: any[] = [];

  const tokenAccounts = await helius("getTokenAccountsByOwner", [
    walletAddress,
    { mint: tokenCA },
    { encoding: "jsonParsed" },
  ]);

  if (!tokenAccounts?.value?.length) return events;
  const tokenAccount = tokenAccounts.value[0].pubkey;

  const sigs = await helius("getSignaturesForAddress", [tokenAccount, { limit: 100 }]);
  if (!sigs?.length) return events;

  for (const sigInfo of sigs.slice(0, 50)) {
    try {
      const tx = await helius("getTransaction", [
        sigInfo.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx || tx.meta?.err) continue;

      const blockTime = tx.blockTime;
      if (!blockTime) continue;
      const eventDate = new Date(blockTime * 1000).toISOString();
      const txHash = sigInfo.signature;
      const accountKeys = tx.transaction?.message?.accountKeys ?? [];

      const walletIndex = accountKeys.findIndex(
        (k: any) => (k.pubkey ?? k) === walletAddress
      );
      if (walletIndex < 0) continue;

      const preSol = (tx.meta?.preBalances?.[walletIndex] ?? 0) / 1e9;
      const postSol = (tx.meta?.postBalances?.[walletIndex] ?? 0) / 1e9;
      const solDiff = postSol - preSol;

      const pre = tx.meta?.preTokenBalances ?? [];
      const post = tx.meta?.postTokenBalances ?? [];
      let tokenSold = false;
      let amountTokens = 0;

      for (const preEntry of pre) {
        if (preEntry.mint !== tokenCA) continue;
        const postEntry = post.find((p: any) => p.accountIndex === preEntry.accountIndex);
        const preBal = parseFloat(preEntry.uiTokenAmount?.uiAmountString ?? "0");
        const postBal = parseFloat(postEntry?.uiTokenAmount?.uiAmountString ?? "0");
        const diff = postBal - preBal;
        if (diff < -0.01) {
          tokenSold = true;
          amountTokens = Math.abs(diff);
          break;
        }
      }

      if (!tokenSold) continue;

      const destination = accountKeys[1]?.pubkey ?? accountKeys[1] ?? "";
      let eventType = "dex_sell";
      let ambiguous = false;

      if (knownWalletAddresses.has(destination)) continue;
      if (CEX_ADDRESSES.has(destination)) eventType = "cex_deposit";
      else if (solDiff < 0.001 && solDiff > -0.001) { eventType = "swap"; ambiguous = true; }

      let amountUsd = null;
      let priceUsdAtTime = null;
      let pricingSource = null;

      if (solDiff > 0.001) {
        const { price, source } = await getPriceAtDate("SOL", eventDate);
        if (price > 0) {
          priceUsdAtTime = price;
          amountUsd = parseFloat((solDiff * price).toFixed(2));
          pricingSource = source;
        }
      }

      events.push({
        walletAddress, chain: "SOL", txHash, eventDate,
        tokenSymbol: caseId, tokenAddress: tokenCA,
        amountTokens, amountUsd, priceUsdAtTime, pricingSource,
        eventType, ambiguous, caseId,
      });
    } catch { continue; }
  }

  return events;
}

export async function computeProceedsForHandle(handle: string): Promise<{
  success: boolean;
  totalProceedsUsd: number;
  eventCount: number;
  error?: string;
}> {
  clearPriceCache();

  try {
    const profile = await prisma.kolProfile.findUnique({
      where: { handle },
      include: { kolWallets: true, kolCases: true },
    });

    if (!profile) return { success: false, totalProceedsUsd: 0, eventCount: 0, error: "Profile not found" };

    const activeWallets = profile.kolWallets.filter((w: any) => w.status === "active");
    if (!activeWallets.length) return { success: false, totalProceedsUsd: 0, eventCount: 0, error: "No active wallets" };

    const knownAddresses = new Set(activeWallets.map((w: any) => w.address));

    await prisma.$executeRawUnsafe(`DELETE FROM "KolProceedsEvent" WHERE "kolHandle" = $1`, handle);

    const caseIds = profile.kolCases.map((c: any) => c.caseId);
    const caseCAs = caseIds
      .map((id: string) => ({ caseId: id, ca: CA_MAP[id] }))
      .filter((x: any) => x.ca);

    console.log(`[proceeds] ${handle} — ${activeWallets.length} wallets, ${caseCAs.length} CAs`);

    const allEvents: any[] = [];

    for (const wallet of activeWallets) {
      if (wallet.chain?.toUpperCase() === "SOL") {
        for (const { caseId, ca } of caseCAs) {
          console.log(`  wallet ${wallet.address.slice(0,8)}... × CA ${caseId}`);
          const events = await fetchSOLEventsForCA(wallet.address, ca, caseId, knownAddresses);
          console.log(`  → ${events.length} events`);
          allEvents.push(...events);
        }
      }
    }

    const seen = new Set<string>();
    const dedupedEvents = allEvents.filter((e) => {
      if (seen.has(e.txHash)) return false;
      seen.add(e.txHash);
      return true;
    });

    for (const ev of dedupedEvents) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "KolProceedsEvent" (id, "kolHandle", "walletAddress", chain, "txHash", "eventDate", "tokenSymbol", "tokenAddress", "amountTokens", "amountUsd", "priceUsdAtTime", "pricingSource", "eventType", "ambiguous", "caseId")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::timestamptz, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("txHash") DO NOTHING
      `, handle, ev.walletAddress, ev.chain, ev.txHash, ev.eventDate, ev.tokenSymbol, ev.tokenAddress, ev.amountTokens, ev.amountUsd, ev.priceUsdAtTime, ev.pricingSource, ev.eventType, ev.ambiguous, ev.caseId);
    }

    const validEvents = dedupedEvents.filter((e) => e.amountUsd && e.amountUsd > 0 && !e.ambiguous);
    const totalProceedsUsd = validEvents.reduce((sum: number, e: any) => sum + (e.amountUsd ?? 0), 0);

    const proceedsByYear: Record<string, number> = {};
    for (const e of validEvents) {
      const year = e.eventDate.slice(0, 4);
      proceedsByYear[year] = (proceedsByYear[year] ?? 0) + (e.amountUsd ?? 0);
    }

    const walletTotals: Record<string, number> = {};
    for (const e of validEvents) {
      walletTotals[e.walletAddress] = (walletTotals[e.walletAddress] ?? 0) + (e.amountUsd ?? 0);
    }
    const topWalletAddress = Object.entries(walletTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topWalletProceedsUsd = topWalletAddress ? walletTotals[topWalletAddress] : null;
    const topWalletLabel = activeWallets.find((w: any) => w.address === topWalletAddress)?.label ?? null;

    const largest = [...validEvents].sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))[0] ?? null;

    const ambiguousRatio = dedupedEvents.length > 0 ? dedupedEvents.filter((e) => e.ambiguous).length / dedupedEvents.length : 0;
    const hasAnalytical = activeWallets.some((w: any) => w.claimType === "analytical_estimate");
    const hasVerifiedOnly = activeWallets.every((w: any) => w.claimType === "verified_onchain");
    let confidence = "medium"; // default for source_attributed
    if (hasAnalytical || ambiguousRatio > 0.4) confidence = "low";
    else if (hasVerifiedOnly && ambiguousRatio <= 0.1) confidence = "high";

    await prisma.$executeRawUnsafe(`
      INSERT INTO "KolProceedsSummary" (id, "kolHandle", "computedAt", "totalProceedsUsd", "proceedsByYear", "topWalletAddress", "topWalletLabel", "topWalletProceedsUsd", "largestEventUsd", "largestEventTxHash", "largestEventDate", "walletCount", "caseCount", "eventCount", confidence, "methodologyVersion", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, now(), $2, $3::jsonb, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, $12, $13, 'v1', now())
      ON CONFLICT ("kolHandle") DO UPDATE SET
        "computedAt" = now(), "totalProceedsUsd" = EXCLUDED."totalProceedsUsd",
        "proceedsByYear" = EXCLUDED."proceedsByYear", "topWalletAddress" = EXCLUDED."topWalletAddress",
        "topWalletLabel" = EXCLUDED."topWalletLabel", "topWalletProceedsUsd" = EXCLUDED."topWalletProceedsUsd",
        "largestEventUsd" = EXCLUDED."largestEventUsd", "largestEventTxHash" = EXCLUDED."largestEventTxHash",
        "largestEventDate" = EXCLUDED."largestEventDate", "walletCount" = EXCLUDED."walletCount",
        "caseCount" = EXCLUDED."caseCount", "eventCount" = EXCLUDED."eventCount",
        confidence = EXCLUDED.confidence, "updatedAt" = now()
    `, handle, totalProceedsUsd, JSON.stringify(proceedsByYear), topWalletAddress, topWalletLabel,
    topWalletProceedsUsd, largest?.amountUsd ?? null, largest?.txHash ?? null,
    largest?.eventDate ?? null, activeWallets.length, profile.kolCases.length, dedupedEvents.length, confidence);

    // Keep KolProfile.totalDocumented in lockstep with the authoritative
    // KolProceedsEvent sum. The public Explorer reads this column, so any
    // drift here leaves retail-facing counters stale.
    await prisma.$executeRawUnsafe(
      `UPDATE "KolProfile" SET "totalDocumented" = $1 WHERE handle = $2`,
      Math.round(totalProceedsUsd),
      handle,
    );

    return { success: true, totalProceedsUsd, eventCount: dedupedEvents.length };
  } catch (err: any) {
    console.error("[computeProceeds]", err);
    return { success: false, totalProceedsUsd: 0, eventCount: 0, error: err.message };
  } finally {
    await prisma.$disconnect();
  }
}
