import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findExchange, type Chain } from "@/lib/chains/exchanges";
import { getPriceAtDate } from "@/lib/kol/pricing";

export const maxDuration = 300; // SEC-010

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WalletOutflow {
  amountUsd: number;
  exchangeSlug: string;
  when: Date;
}

const MS_DAY = 24 * 3600 * 1000;
const WINDOW_DAYS_MAX = 365;

interface WalletResult {
  walletId: string;
  handle: string;
  chain: string;
  address: string;
  outflows: number;
  outflowUsd24h: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const wallets = await prisma.kolWallet.findMany({
    where: { status: "active" },
    select: { id: true, address: true, chain: true, kolHandle: true },
  });

  const perHandle = new Map<
    string,
    { amount24h: number; amount7d: number; amount30d: number; amount365d: number }
  >();
  const results: WalletResult[] = [];

  for (const w of wallets) {
    const chain = normalizeChain(w.chain);
    if (!chain) {
      results.push({
        walletId: w.id, handle: w.kolHandle, chain: w.chain, address: w.address,
        outflows: 0, outflowUsd24h: 0, error: "unknown chain",
      });
      continue;
    }
    try {
      const outflows = await fetchOutflowsWindow(chain, w.address, WINDOW_DAYS_MAX);
      const now = Date.now();
      let sum24h = 0, sum7d = 0, sum30d = 0, sum365d = 0;
      for (const o of outflows) {
        const ageMs = now - o.when.getTime();
        if (ageMs < 0) continue;
        if (ageMs <= 1 * MS_DAY)   sum24h += o.amountUsd;
        if (ageMs <= 7 * MS_DAY)   sum7d  += o.amountUsd;
        if (ageMs <= 30 * MS_DAY)  sum30d += o.amountUsd;
        if (ageMs <= 365 * MS_DAY) sum365d += o.amountUsd;
      }
      const bucket = perHandle.get(w.kolHandle) ?? { amount24h: 0, amount7d: 0, amount30d: 0, amount365d: 0 };
      bucket.amount24h  += sum24h;
      bucket.amount7d   += sum7d;
      bucket.amount30d  += sum30d;
      bucket.amount365d += sum365d;
      perHandle.set(w.kolHandle, bucket);
      results.push({
        walletId: w.id, handle: w.kolHandle, chain, address: w.address,
        outflows: outflows.length, outflowUsd24h: sum24h,
      });
    } catch (err) {
      results.push({
        walletId: w.id, handle: w.kolHandle, chain, address: w.address,
        outflows: 0, outflowUsd24h: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let updated = 0;
  for (const [handle, bucket] of perHandle) {
    try {
      await upsertRollingSummary(handle, bucket);
      updated++;
    } catch (err) {
      console.error("[daily-flow] upsert failed", handle, err);
    }
  }

  return NextResponse.json({
    ok: true,
    walletsProcessed: wallets.length,
    handlesUpdated: updated,
    errors: results.filter((r) => r.error).length,
    elapsedMs: Date.now() - startedAt,
    results: process.env.DAILY_FLOW_VERBOSE === "1" ? results : undefined,
  });
}

function normalizeChain(raw: string): Chain | null {
  const up = raw.toUpperCase();
  if (up === "SOL" || up === "SOLANA") return "SOL";
  if (up === "ETH" || up === "ETHEREUM") return "ETH";
  if (up === "BSC" || up === "BNB") return "BSC";
  if (up === "TRON" || up === "TRX") return "TRON";
  return null;
}

async function fetchOutflowsWindow(chain: Chain, address: string, days: number): Promise<WalletOutflow[]> {
  const since = Date.now() - days * MS_DAY;
  if (chain === "SOL") return fetchSolanaOutflows(address, since);
  if (chain === "ETH") return fetchEtherscanOutflows(address, since, "ETH");
  if (chain === "BSC") return fetchEtherscanOutflows(address, since, "BSC");
  if (chain === "TRON") return fetchTronOutflows(address, since);
  return [];
}

async function fetchSolanaOutflows(address: string, sinceMs: number): Promise<WalletOutflow[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return [];
  const url = `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(apiKey)}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`helius ${res.status}`);
  const txs = (await res.json()) as Array<{
    timestamp?: number;
    nativeTransfers?: { fromUserAccount?: string; toUserAccount?: string; amount?: number }[];
    tokenTransfers?: { fromUserAccount?: string; toUserAccount?: string; tokenAmount?: number; mint?: string }[];
  }>;
  const out: WalletOutflow[] = [];
  for (const tx of Array.isArray(txs) ? txs : []) {
    const whenMs = (tx.timestamp ?? 0) * 1000;
    if (whenMs < sinceMs) continue;
    const when = new Date(whenMs);
    for (const t of tx.nativeTransfers ?? []) {
      if (t.fromUserAccount !== address) continue;
      const exch = findExchange("SOL", t.toUserAccount ?? "");
      if (!exch) continue;
      const sol = (t.amount ?? 0) / 1e9;
      const price = await safePrice("SOL", when);
      out.push({ amountUsd: sol * price, exchangeSlug: exch.exchangeSlug, when });
    }
    for (const t of tx.tokenTransfers ?? []) {
      if (t.fromUserAccount !== address) continue;
      const exch = findExchange("SOL", t.toUserAccount ?? "");
      if (!exch) continue;
      const amt = t.tokenAmount ?? 0;
      const price = await safePrice(guessSymbolFromMint(t.mint ?? ""), when);
      out.push({ amountUsd: amt * price, exchangeSlug: exch.exchangeSlug, when });
    }
  }
  return out;
}

async function fetchEtherscanOutflows(
  address: string, sinceMs: number, chain: "ETH" | "BSC"
): Promise<WalletOutflow[]> {
  const apiKey = chain === "ETH" ? process.env.ETHERSCAN_API_KEY : process.env.BSCSCAN_API_KEY;
  if (!apiKey) return [];
  const base = chain === "ETH" ? "https://api.etherscan.io/api" : "https://api.bscscan.com/api";
  const url = `${base}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${chain} scan ${res.status}`);
  const json = (await res.json()) as { status?: string; result?: Array<{ timeStamp?: string; from?: string; to?: string; value?: string }> };
  if (json.status !== "1" || !Array.isArray(json.result)) return [];
  const out: WalletOutflow[] = [];
  for (const tx of json.result) {
    const whenMs = Number(tx.timeStamp ?? 0) * 1000;
    if (whenMs < sinceMs) continue;
    if ((tx.from ?? "").toLowerCase() !== address.toLowerCase()) continue;
    const exch = findExchange(chain, tx.to ?? "");
    if (!exch) continue;
    const wei = BigInt(tx.value ?? "0");
    const native = Number(wei) / 1e18;
    const when = new Date(whenMs);
    const symbol = chain === "ETH" ? "ETH" : "BNB";
    const price = await safePrice(symbol, when);
    out.push({ amountUsd: native * price, exchangeSlug: exch.exchangeSlug, when });
  }
  return out;
}

async function fetchTronOutflows(address: string, sinceMs: number): Promise<WalletOutflow[]> {
  const key = process.env.TRONGRID_API_KEY;
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) headers["TRON-PRO-API-KEY"] = key;
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=100&only_from=true`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`trongrid ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ block_timestamp?: number; raw_data?: { contract?: Array<{ parameter?: { value?: { to_address?: string; amount?: number } } }> } }> };
  const out: WalletOutflow[] = [];
  for (const tx of json.data ?? []) {
    const whenMs = tx.block_timestamp ?? 0;
    if (whenMs < sinceMs) continue;
    const contract = tx.raw_data?.contract?.[0]?.parameter?.value;
    const toHex = contract?.to_address;
    if (!toHex) continue;
    const to = hexToTronBase58(toHex);
    const exch = findExchange("TRON", to);
    if (!exch) continue;
    const trx = (contract?.amount ?? 0) / 1e6;
    const when = new Date(whenMs);
    const price = await safePrice("TRX", when);
    out.push({ amountUsd: trx * price, exchangeSlug: exch.exchangeSlug, when });
  }
  return out;
}

function hexToTronBase58(_hex: string): string {
  // Intentionally simplified — matching is done against a small set; production
  // code should use tronweb. For now, return the hex as-is so no false match.
  return "";
}

async function safePrice(symbol: string, when: Date): Promise<number> {
  try {
    const r = await getPriceAtDate(symbol, when.toISOString());
    return r?.price ?? 0;
  } catch {
    return 0;
  }
}

function guessSymbolFromMint(mint: string): string {
  const known: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  };
  return known[mint] ?? "USDC";
}

async function upsertRollingSummary(
  handle: string,
  bucket: { amount24h: number; amount7d: number; amount30d: number; amount365d: number }
) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "KolProceedsSummary" WHERE "kolHandle" = $1 LIMIT 1`,
    handle
  );
  if (rows.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "KolProceedsSummary"
         SET "rolling24hUsd" = $2,
             "rolling7dUsd"  = $3,
             "rolling30dUsd" = $4,
             "rolling365dUsd" = $5,
             "lastFlowComputedAt" = NOW(),
             "updatedAt" = NOW()
       WHERE "kolHandle" = $1`,
      handle, bucket.amount24h, bucket.amount7d, bucket.amount30d, bucket.amount365d
    );
  } else {
    // No existing summary — skip. Full summary creation is owned by
    // src/lib/kol/proceeds.ts; daily-flow only updates rolling columns.
  }
}
