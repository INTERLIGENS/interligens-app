import { describe, it, expect } from "vitest";
import { renderHtmlV2 } from "./templateV2";
import type { ScanResult } from "@/app/api/scan/solana/route";

function baseScan(): ScanResult {
  return {
    mint: "TEST_MINT",
    chain: "solana",
    scanned_at: new Date().toISOString(),
    off_chain: { status: "Referenced", source: "case_db", case_id: "CASE-TEST", summary: null, claims: [], sources: [] },
    on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null, liquidity_usd: null, volume_24h_usd: null, fdv_usd: null, fetched_at: new Date().toISOString(), cache_hit: false } },
    risk: { score: 88, tier: "RED", breakdown: { base_score: 100, claim_penalty: 12, severity_multiplier: 1 }, flags: [] },
  };
}

describe("renderHtmlV2 — detective trade", () => {
  it("avec trade: affiche les 2 TX + notes + PnL", () => {
    const scan = baseScan() as any;
    scan.detective_trade = {
      buy_tx: "BUY_TX_HASH_123",
      sell_tx: "SELL_TX_HASH_456",
      wallet: "WALLET_123",
      pnl_usd: 4820,
      notes_en: "Insider bought 2h before launch.",
      notes_fr: "Insider acheté 2h avant.",
    };
    const html = renderHtmlV2(scan, "en");
    expect(html).toContain("BUY_TX_HASH_123");
    expect(html).toContain("SELL_TX_HASH_456");
    expect(html).toContain("DETECTIVE TRADE");
    expect(html).toContain("+$4,820");
    expect(html).toContain("Insider bought 2h before launch.");
  });

  it("sans trade: le bloc n'apparaît pas", () => {
    const scan = baseScan() as any;
    scan.detective_trade = null;
    const html = renderHtmlV2(scan, "en");
    expect(html).not.toContain("DETECTIVE TRADE");
    expect(html).not.toContain("BUY TX");
  });

  it("FR: affiche notes_fr + titre traduit", () => {
    const scan = baseScan() as any;
    scan.detective_trade = {
      buy_tx: "TX_A",
      sell_tx: "TX_B",
      wallet: "W",
      pnl_usd: -500,
      notes_fr: "Vente en perte.",
      notes_en: "Sold at loss.",
    };
    const html = renderHtmlV2(scan, "fr");
    expect(html).toContain("TRADE DÉTECTIVE");
    expect(html).toContain("Vente en perte.");
    expect(html).toContain("-$500");
  });
});

describe("renderHtmlV2 — market snapshot", () => {
  it("Test A — unavailable: microcopy forensic + pas de Market data unavailable", () => {
    const scan = baseScan() as any;
    scan.on_chain.markets = {
      source: null,
      price: null,
      liquidity_usd: null,
      volume_24h_usd: null,
      fdv_usd: null,
      pair_age_days: null,
      url: null,
      data_unavailable: true,
      reason: "DexScreener and GeckoTerminal both unavailable",
      primary_pool: null,
      dex: null,
      fetched_at: "2026-03-02T20:18:14.920Z",
      cache_hit: false,
    };
    const html = renderHtmlV2(scan, "en");
    expect(html).toContain("No active liquidity found");
    expect(html).toContain("DexScreener + GeckoTerminal returned no active pools");
    expect(html).toContain("Sources checked");
    expect(html).not.toContain("Market data unavailable");
  });

  it("Test B — data présente: price/liquidity/source/age formatés correctement", () => {
    const scan = baseScan() as any;
    scan.on_chain.markets = {
      source: "dexscreener",
      price: 0.00042,
      liquidity_usd: 50200,
      volume_24h_usd: 12500,
      fdv_usd: 980000,
      pair_age_days: 140,
      url: "https://dexscreener.com/solana/TEST",
      data_unavailable: false,
      reason: null,
      primary_pool: "TEST",
      dex: "raydium",
      fetched_at: new Date().toISOString(),
      cache_hit: false,
    };
    const html = renderHtmlV2(scan, "en");
    expect(html).toContain("$0.00042");
    expect(html).toContain("50.2K");
    expect(html).toContain("DEXSCREENER");
    expect(html).toContain("140d");
    expect(html).not.toContain("unavailable");
  });
});
