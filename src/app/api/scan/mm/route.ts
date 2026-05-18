/**
 * GET /api/scan/mm
 *
 * Returns an MMScore for a target SOL / EVM address. The response never
 * throws — on missing API key, timeout, or upstream error it falls back
 * to a "CLEAN + fallback:true" payload so the UI can degrade gracefully.
 *
 * Query params:
 *   address     — required
 *   chain       — "sol" (default) | "eth"
 *   mock        — "mm-red" | "mm-green" (dev / demo only)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { computeMMScore, type MMScoreResult } from "@/lib/mm-tracker";
import type { FundingEvent } from "@/lib/mm-tracker/cluster_mapper";
import type { WashTransfer } from "@/lib/mm-tracker/wash_detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HELIUS_TIMEOUT_MS = 4_000;

interface MMScanResponse {
  ok: boolean;
  address: string;
  chain: "sol" | "eth";
  mmScore: number;
  verdict: MMScoreResult["verdict"];
  signals: string[];
  signalsFr: string[];
  drivers: MMScoreResult["drivers"];
  sampleSize: number;
  fallback: boolean;
  fallbackReason?: string;
}

function finalize(
  address: string,
  chain: "sol" | "eth",
  score: MMScoreResult,
  fallback: boolean,
  reason?: string,
): MMScanResponse {
  return {
    ok: true,
    address,
    chain,
    mmScore: score.mmScore,
    verdict: score.verdict,
    signals: score.signals,
    signalsFr: score.signalsFr,
    drivers: score.drivers,
    sampleSize: score.wash.sampleSize,
    fallback,
    fallbackReason: reason,
  };
}

function fallbackClean(address: string, chain: "sol" | "eth", reason: string): MMScanResponse {
  const score = computeMMScore({
    chain: chain === "sol" ? "SOL" : "ETH",
    target: address,
    transfers: [],
    fundingEvents: [],
    relatedWallets: [],
  });
  return finalize(address, chain, score, true, reason);
}

// ── Mock payloads for demo / UI screenshots ─────────────────────────────
function mockRed(address: string, chain: "sol" | "eth"): MMScanResponse {
  const transfers: WashTransfer[] = Array.from({ length: 60 }, (_, i) => ({
    counterparty: i < 45 ? "mockPartnerA" : i < 55 ? "mockPartnerB" : `mock${i}`,
    amount: 1000 + (i % 7) * 25,
    timestamp: Date.now() - i * 60_000,
  }));
  const fundingEvents: FundingEvent[] = Array.from({ length: 6 }, (_, i) => ({
    wallet: `relatedMock${i}`,
    source: "mockFundingSource",
    amount: 100,
    timestamp: Date.now() - i * 3600_000,
  }));
  const score = computeMMScore({
    chain: chain === "sol" ? "SOL" : "ETH",
    target: address,
    transfers,
    fundingEvents,
    relatedWallets: Array.from({ length: 6 }, (_, i) => `relatedMock${i}`),
  });
  return finalize(address, chain, score, false);
}

function mockGreen(address: string, chain: "sol" | "eth"): MMScanResponse {
  const transfers: WashTransfer[] = Array.from({ length: 80 }, (_, i) => ({
    counterparty: `distinctPartner${i}`,
    amount: 500 + (i % 20) * 10,
    timestamp: Date.now() - i * 30_000,
  }));
  const score = computeMMScore({
    chain: chain === "sol" ? "SOL" : "ETH",
    target: address,
    transfers,
    fundingEvents: [],
    relatedWallets: [],
  });
  return finalize(address, chain, score, false);
}

// ── Helius fetch (SOL) with hard timeout ────────────────────────────────
interface HeliusTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number;
  mint?: string;
}

interface HeliusTx {
  timestamp?: number;
  nativeTransfers?: HeliusTransfer[];
  tokenTransfers?: HeliusTransfer[];
}

async function fetchHeliusTransfers(
  address: string,
  apiKey: string,
): Promise<HeliusTx[]> {
  const url = `https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(apiKey)}&limit=100`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), HELIUS_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`helius_${res.status}`);
    const json = (await res.json()) as HeliusTx[];
    return Array.isArray(json) ? json : [];
  } finally {
    clearTimeout(to);
  }
}

function extractWashTransfers(target: string, txs: HeliusTx[]): WashTransfer[] {
  const out: WashTransfer[] = [];
  for (const tx of txs) {
    const ts = (tx.timestamp ?? 0) * 1000;
    for (const t of tx.tokenTransfers ?? []) {
      if (!t.fromUserAccount || !t.toUserAccount) continue;
      if (t.fromUserAccount !== target && t.toUserAccount !== target) continue;
      const counterparty = t.fromUserAccount === target ? t.toUserAccount : t.fromUserAccount;
      const amount = typeof t.amount === "number" && t.amount > 0 ? t.amount : 1;
      out.push({ counterparty, amount, timestamp: ts });
    }
  }
  return out;
}

function extractFundingEvents(txs: HeliusTx[], targetSet: Set<string>): FundingEvent[] {
  const out: FundingEvent[] = [];
  for (const tx of txs) {
    const ts = (tx.timestamp ?? 0) * 1000;
    for (const t of tx.nativeTransfers ?? []) {
      if (!t.toUserAccount || !t.fromUserAccount) continue;
      if (!targetSet.has(t.toUserAccount)) continue;
      if (t.fromUserAccount === t.toUserAccount) continue;
      out.push({
        wallet: t.toUserAccount,
        source: t.fromUserAccount,
        amount: t.amount,
        timestamp: ts,
      });
    }
  }
  return out;
}

// ── Handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  const chainParam = (url.searchParams.get("chain") ?? "sol").toLowerCase();
  const chain: "sol" | "eth" = chainParam === "eth" ? "eth" : "sol";
  const mock = url.searchParams.get("mock");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  if (mock === "mm-red") return NextResponse.json(mockRed(address, chain));
  if (mock === "mm-green") return NextResponse.json(mockGreen(address, chain));

  // Only SOL is wired to Helius at V1. EVM path returns CLEAN + fallback.
  if (chain !== "sol") {
    return NextResponse.json(fallbackClean(address, chain, "evm_not_implemented"));
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackClean(address, chain, "missing_helius_key"));
  }

  try {
    const txs = await fetchHeliusTransfers(address, apiKey);
    const transfers = extractWashTransfers(address, txs);

    const related = new Set<string>();
    for (const t of transfers) related.add(t.counterparty);
    related.delete(address);
    const relatedWallets = Array.from(related).slice(0, 50);

    const targetSet = new Set<string>([address, ...relatedWallets]);
    const fundingEvents = extractFundingEvents(txs, targetSet);

    const score = computeMMScore({
      chain: "SOL",
      target: address,
      transfers,
      fundingEvents,
      relatedWallets,
    });

    return NextResponse.json(finalize(address, chain, score, false));
  } catch (err) {
    const message = err instanceof Error ? err.name : "unknown";
    return NextResponse.json(fallbackClean(address, chain, `helius_error_${message}`));
  }
}
