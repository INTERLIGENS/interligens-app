/**
 * src/lib/surveillance/etherscan/client.ts
 */

import { getEtherscanApiKey, BASE_URL, RATE_PER_SEC } from "./config";

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────

const MIN_DELAY = Math.ceil(1000 / RATE_PER_SEC);
let lastCallAt = 0;

async function throttle() {
  const now = Date.now();
  const wait = MIN_DELAY - (now - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── FETCH ───────────────────────────────────────────────────────────────────

async function safeFetchJson(url: string, retries = 3): Promise<any> {
  await throttle();
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 2_000_000) throw new Error("Response too large");
      return JSON.parse(text);
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  gas: string;
  gasUsed: string;
}

export interface EtherscanTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
  logIndex?: string;
}

// ─── API CALLS ───────────────────────────────────────────────────────────────

export async function fetchTxList(
  address: string,
  startBlock = 0
): Promise<EtherscanTx[]> {
  const key = getEtherscanApiKey();
  const url =
    `${BASE_URL}?module=account&action=txlist` +
    `&address=${address}` +
    `&startblock=${startBlock}` +
    `&endblock=99999999` +
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${key}`;

  const data = await safeFetchJson(url);

  if (data.status === "0") {
    if (data.message === "No transactions found") return [];
    throw new Error(`[etherscan] txlist error: ${data.message}`);
  }
  return data.result ?? [];
}

export async function fetchTokenTx(
  address: string,
  startBlock = 0
): Promise<EtherscanTokenTx[]> {
  const key = getEtherscanApiKey();
  const url =
    `${BASE_URL}?module=account&action=tokentx` +
    `&address=${address}` +
    `&startblock=${startBlock}` +
    `&endblock=99999999` +
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${key}`;

  const data = await safeFetchJson(url);

  if (data.status === "0") {
    if (data.message === "No transactions found") return [];
    throw new Error(`[etherscan] tokentx error: ${data.message}`);
  }
  return data.result ?? [];
}
