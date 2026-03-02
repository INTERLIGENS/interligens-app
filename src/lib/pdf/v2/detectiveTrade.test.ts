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
