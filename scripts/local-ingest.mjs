#!/usr/bin/env node
/**
 * INTERLIGENS — Local Etherscan Ingestion
 * Lance directement depuis ton Mac, pas de timeout Vercel
 * Usage: node scripts/local-ingest.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const { Client } = require('pg');
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY;
const DB_URL = process.env.DATABASE_URL_UNPOOLED;

if (!ETHERSCAN_KEY) { console.error('❌ ETHERSCAN_API_KEY manquante'); process.exit(1); }
if (!DB_URL) { console.error('❌ DATABASE_URL_UNPOOLED manquante'); process.exit(1); }

const client = new Client({ connectionString: DB_URL });
await client.connect();

// Récupérer les wallets
const { rows: wallets } = await client.query(
  `SELECT address FROM wallets WHERE chain = 'ethereum' ORDER BY "createdAt" ASC`
);

console.log(`=== INTERLIGENS Local Ingest ===`);
console.log(`${wallets.length} wallets à ingérer\n`);

// CEX labels
const { rows: cexRows } = await client.query(`SELECT address, name FROM cex_labels WHERE chain = 'ethereum'`);
const cexMap = new Map(cexRows.map(r => [r.address.toLowerCase(), r.name]));

let totalInserted = 0;
let totalErrors = 0;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchEtherscan(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.status === '0' && data.message === 'No transactions found') return [];
      if (data.status === '0') throw new Error(data.message);
      return data.result ?? [];
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

for (let i = 0; i < wallets.length; i++) {
  const { address } = wallets[i];
  console.log(`[${i+1}/${wallets.length}] ${address.slice(0,10)}...`);

  try {
    // Récupérer lastSeenBlock
    const { rows: syncRows } = await client.query(
      `SELECT "lastSeenBlock" FROM wallet_sync_state WHERE "walletAddress" = $1`, [address]
    );
    const startBlock = syncRows[0]?.lastSeenBlock ?? 0;

    // Fetch txlist + tokentx
    const [txList, tokenTx] = await Promise.all([
      fetchEtherscan(`https://api.etherscan.io/v2/api?module=account&action=txlist&address=${address}&startblock=${startBlock}&chainid=1&sort=asc&page=1&offset=100&apikey=${ETHERSCAN_KEY}`),
      fetchEtherscan(`https://api.etherscan.io/v2/api?module=account&action=tokentx&address=${address}&startblock=${startBlock}&chainid=1&sort=asc&page=1&offset=100&apikey=${ETHERSCAN_KEY}`),
    ]);

    await sleep(250); // rate limit 5 req/s

    let inserted = 0;
    let maxBlock = startBlock;

    // Ingérer txlist
    for (const tx of txList) {
      const blockNum = parseInt(tx.blockNumber);
      if (blockNum > maxBlock) maxBlock = blockNum;
      const direction = tx.from.toLowerCase() === address.toLowerCase() ? 'out' : 'in';
      const counterparty = direction === 'out' ? tx.to : tx.from;
      const isCex = direction === 'out' && cexMap.has(counterparty?.toLowerCase());
      const cexName = isCex ? cexMap.get(counterparty.toLowerCase()) : null;

      await client.query(`
        INSERT INTO onchain_events (
          id, chain, "walletAddress", "txHash", "blockNumber", "blockTimeUtc",
          "eventType", direction, counterparty, "amountRaw", "isCexDeposit", "cexName", "rawJson", "createdAt"
        ) VALUES (
          gen_random_uuid()::text, 'ethereum', $1, $2, $3, to_timestamp($4),
          'native_tx', $5, $6, $7, $8, $9, $10::jsonb, NOW()
        ) ON CONFLICT DO NOTHING
      `, [address.toLowerCase(), tx.hash, blockNum, parseInt(tx.timeStamp),
          direction, counterparty?.toLowerCase(), tx.value,
          isCex, cexName, JSON.stringify(tx)]);
      inserted++;
    }

    // Ingérer tokentx
    for (const tx of tokenTx) {
      const blockNum = parseInt(tx.blockNumber);
      if (blockNum > maxBlock) maxBlock = blockNum;
      const direction = tx.from.toLowerCase() === address.toLowerCase() ? 'out' : 'in';
      const counterparty = direction === 'out' ? tx.to : tx.from;
      const isCex = direction === 'out' && cexMap.has(counterparty?.toLowerCase());
      const cexName = isCex ? cexMap.get(counterparty.toLowerCase()) : null;

      await client.query(`
        INSERT INTO onchain_events (
          id, chain, "walletAddress", "txHash", "blockNumber", "blockTimeUtc",
          "eventType", direction, counterparty, "tokenAddress", "amountRaw",
          "isCexDeposit", "cexName", "rawJson", "createdAt"
        ) VALUES (
          gen_random_uuid()::text, 'ethereum', $1, $2, $3, to_timestamp($4),
          'erc20_transfer', $5, $6, $7, $8, $9, $10, $11::jsonb, NOW()
        ) ON CONFLICT DO NOTHING
      `, [address.toLowerCase(), tx.hash, blockNum, parseInt(tx.timeStamp),
          direction, counterparty?.toLowerCase(), tx.contractAddress?.toLowerCase(),
          tx.value, isCex, cexName, JSON.stringify(tx)]);
      inserted++;
    }

    // Update sync state
    await client.query(`
      INSERT INTO wallet_sync_state ("walletAddress", chain, "lastSeenBlock", "lastSyncAt", status)
      VALUES ($1, 'ethereum', $2, NOW(), 'idle')
      ON CONFLICT ("walletAddress") DO UPDATE SET
        "lastSeenBlock" = $2, "lastSyncAt" = NOW(), status = 'idle', "errorMessage" = NULL
    `, [address, maxBlock]);

    totalInserted += inserted;
    console.log(`  ✅ ${inserted} events (block ${maxBlock})`);

  } catch (e) {
    totalErrors++;
    console.log(`  ❌ ${e.message}`);
    await client.query(`
      INSERT INTO wallet_sync_state ("walletAddress", chain, status, "errorMessage")
      VALUES ($1, 'ethereum', 'error', $2)
      ON CONFLICT ("walletAddress") DO UPDATE SET status = 'error', "errorMessage" = $2
    `, [address, e.message]);
  }
}

await client.end();
console.log(`\n=== TERMINÉ ===`);
console.log(`✅ Total events insérés: ${totalInserted}`);
console.log(`❌ Erreurs: ${totalErrors}`);
