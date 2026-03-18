/**
 * src/lib/surveillance/onchain/ingest.ts
 * Ingestion historique + sync incrémental
 */

import { prisma } from "@/lib/prisma";
import { fetchTxList, fetchTokenTx } from "../etherscan/client";
import { BATCH_WALLETS } from "../etherscan/config";

// ─── CEX DETECTION ───────────────────────────────────────────────────────────

let cexCache: Map<string, string> | null = null;

async function getCexMap(): Promise<Map<string, string>> {
  if (cexCache) return cexCache;
  const labels = await prisma.$queryRaw<{ address: string; name: string }[]>`
    SELECT address, name FROM cex_labels WHERE chain = 'ethereum'
  `;
  cexCache = new Map(labels.map((l) => [l.address.toLowerCase(), l.name]));
  return cexCache;
}

// ─── TRANSFORM TX ────────────────────────────────────────────────────────────

async function transformTx(tx: any, walletAddress: string, cexMap: Map<string, string>) {
  const wallet = walletAddress.toLowerCase();
  const from = tx.from?.toLowerCase() ?? "";
  const to = tx.to?.toLowerCase() ?? "";
  const direction = from === wallet ? "out" : "in";
  const counterparty = direction === "out" ? to : from;
  const isCexDeposit = direction === "out" && cexMap.has(counterparty);
  const cexName = isCexDeposit ? cexMap.get(counterparty) : null;

  return {
    chain: "ethereum",
    walletAddress: wallet,
    txHash: tx.hash,
    blockNumber: parseInt(tx.blockNumber),
    blockTimeUtc: new Date(parseInt(tx.timeStamp) * 1000),
    eventType: "native_tx" as const,
    direction,
    counterparty,
    tokenAddress: null,
    tokenSymbol: null,
    tokenDecimals: null,
    amountRaw: tx.value ?? "0",
    valueWei: tx.value ?? "0",
    isCexDeposit,
    cexName: cexName ?? null,
    rawJson: tx,
  };
}

async function transformTokenTx(tx: any, walletAddress: string, cexMap: Map<string, string>) {
  const wallet = walletAddress.toLowerCase();
  const from = tx.from?.toLowerCase() ?? "";
  const to = tx.to?.toLowerCase() ?? "";
  const direction = from === wallet ? "out" : "in";
  const counterparty = direction === "out" ? to : from;
  const isCexDeposit = direction === "out" && cexMap.has(counterparty);
  const cexName = isCexDeposit ? cexMap.get(counterparty) : null;

  return {
    chain: "ethereum",
    walletAddress: wallet,
    txHash: tx.hash,
    blockNumber: parseInt(tx.blockNumber),
    blockTimeUtc: new Date(parseInt(tx.timeStamp) * 1000),
    eventType: "erc20_transfer" as const,
    direction,
    counterparty,
    tokenAddress: tx.contractAddress?.toLowerCase() ?? null,
    tokenSymbol: tx.tokenSymbol ?? null,
    tokenDecimals: tx.tokenDecimal ? parseInt(tx.tokenDecimal) : null,
    amountRaw: tx.value ?? "0",
    valueWei: null,
    isCexDeposit,
    cexName: cexName ?? null,
    rawJson: tx,
  };
}

// ─── UPSERT EVENTS ───────────────────────────────────────────────────────────

async function upsertEvents(events: any[]): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const e of events) {
    await prisma.$executeRaw`
      INSERT INTO onchain_events (
        id, chain, "walletAddress", "txHash", "blockNumber", "blockTimeUtc",
        "eventType", direction, counterparty, "tokenAddress", "tokenSymbol",
        "tokenDecimals", "amountRaw", "valueWei", "isCexDeposit", "cexName", "rawJson", "createdAt"
      ) VALUES (
        gen_random_uuid()::text, ${e.chain}, ${e.walletAddress}, ${e.txHash},
        ${e.blockNumber}, ${e.blockTimeUtc}, ${e.eventType}::"EventType",
        ${e.direction}, ${e.counterparty}, ${e.tokenAddress}, ${e.tokenSymbol},
        ${e.tokenDecimals}, ${e.amountRaw}, ${e.valueWei}, ${e.isCexDeposit},
        ${e.cexName}, ${JSON.stringify(e.rawJson)}::jsonb, NOW()
      )
      ON CONFLICT ("txHash", "walletAddress") DO NOTHING
    `;
    inserted++;
  }
  return { inserted };
}

// ─── SYNC ONE WALLET ─────────────────────────────────────────────────────────

async function syncWallet(address: string, startBlock = 0) {
  const cexMap = await getCexMap();

  // Set status = syncing
  await prisma.$executeRaw`
    INSERT INTO wallet_sync_state ("walletAddress", chain, status, "lastSeenBlock")
    VALUES (${address}, 'ethereum', 'syncing'::"SyncStatus", ${startBlock})
    ON CONFLICT ("walletAddress") DO UPDATE SET status = 'syncing'::"SyncStatus"
  `;

  try {
    const [txList, tokenTxList] = await Promise.all([
      fetchTxList(address, startBlock),
      fetchTokenTx(address, startBlock),
    ]);

    const nativeTxs = await Promise.all(txList.map((tx) => transformTx(tx, address, cexMap)));
    const tokenTxs = await Promise.all(tokenTxList.map((tx) => transformTokenTx(tx, address, cexMap)));
    const allEvents = [...nativeTxs, ...tokenTxs];

    const { inserted } = await upsertEvents(allEvents);

    const maxBlock = allEvents.length > 0
      ? Math.max(...allEvents.map((e) => e.blockNumber))
      : startBlock;

    await prisma.$executeRaw`
      INSERT INTO wallet_sync_state ("walletAddress", chain, "lastSeenBlock", "lastSyncAt", status)
      VALUES (${address}, 'ethereum', ${maxBlock}, NOW(), 'idle'::"SyncStatus")
      ON CONFLICT ("walletAddress") DO UPDATE SET
        "lastSeenBlock" = ${maxBlock},
        "lastSyncAt" = NOW(),
        status = 'idle'::"SyncStatus",
        "errorMessage" = NULL
    `;

    return { address, inserted, maxBlock, error: null };
  } catch (err: any) {
    await prisma.$executeRaw`
      UPDATE wallet_sync_state SET status = 'error'::"SyncStatus", "errorMessage" = ${err.message}
      WHERE "walletAddress" = ${address}
    `;
    return { address, inserted: 0, maxBlock: startBlock, error: err.message };
  }
}

// ─── HISTORICAL INGEST ───────────────────────────────────────────────────────

export async function historicalIngest() {
  const wallets = await prisma.wallet.findMany({
    where: { chain: "ethereum", confidence: { gte: 0.9 } },
    select: { address: true },
  });

  const results = [];
  for (const w of wallets) {
    const result = await syncWallet(w.address, 0);
    results.push(result);
    console.log(`[ingest] ${w.address.slice(0, 10)}... → ${result.inserted} events`);
  }

  return {
    walletsProcessed: results.length,
    eventsInserted: results.reduce((s, r) => s + r.inserted, 0),
    errors: results.filter((r) => r.error).map((r) => ({ address: r.address, error: r.error })),
  };
}

// ─── INCREMENTAL SYNC ────────────────────────────────────────────────────────

export async function incrementalSync() {
  // Prendre les N wallets les moins récemment synchés
  const syncStates = await prisma.$queryRaw<{ walletAddress: string; lastSeenBlock: number }[]>`
    SELECT ws."walletAddress", ws."lastSeenBlock"
    FROM wallet_sync_state ws
    WHERE ws.status != 'syncing'::"SyncStatus"
    ORDER BY ws."lastSyncAt" ASC NULLS FIRST
    LIMIT ${BATCH_WALLETS}
  `;

  // Wallets pas encore dans wallet_sync_state
  const wallets = await prisma.wallet.findMany({
    where: { chain: "ethereum", confidence: { gte: 0.9 } },
    select: { address: true },
  });

  const synced = new Set(syncStates.map((s) => s.walletAddress));
  const notSynced = wallets
    .filter((w) => !synced.has(w.address))
    .slice(0, BATCH_WALLETS - syncStates.length);

  const targets = [
    ...syncStates.map((s) => ({ address: s.walletAddress, startBlock: s.lastSeenBlock })),
    ...notSynced.map((w) => ({ address: w.address, startBlock: 0 })),
  ];

  const results = [];
  for (const t of targets) {
    const result = await syncWallet(t.address, t.startBlock);
    results.push(result);
  }

  return {
    walletsProcessed: results.length,
    eventsInserted: results.reduce((s, r) => s + r.inserted, 0),
    errors: results.filter((r) => r.error),
  };
}
