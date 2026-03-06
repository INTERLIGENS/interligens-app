// Tests spécifiques au mapping wearekent_
import { describe, it, expect } from "vitest";
import { parseCsv } from "../parsers/csv";
import type { ParseOptions } from "../types";

// Simule le contenu CSV exporté du sheet wearekent
const WEAREKENT_CSV = `address,eth_amount,usd_value,rank
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.5,3200,1
0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B,0.8,1700,2
invalid_address,0.1,200,3
0x71C7656EC7ab88b098defB751B7401B5f6d8976F,2.0,4300,4`;

const KENT_OPTS: ParseOptions = {
  defaultChain: "ethereum",
  defaultLabelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  sourceName: "wearekent_",
  sourceUrl: "https://docs.google.com/spreadsheets/d/KENT_SHEET",
  visibility: "internal_only",
  confidence: "low",
};

describe("wearekent mapping", () => {
  it("mappe uniquement les adresses EVM valides", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    // 3 adresses valides sur 4 (invalid_address exclue)
    expect(result.rows).toHaveLength(3);
  });

  it("chain = ethereum pour toutes les lignes", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.chain).toBe("ethereum"));
  });

  it("labelType = airdrop_target", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.labelType).toBe("airdrop_target"));
  });

  it("label = kent_unclaimed_airdrop_list", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.label).toBe("kent_unclaimed_airdrop_list"));
  });

  it("confidence = low", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.confidence).toBe("low"));
  });

  it("sourceName = wearekent_", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => expect(r.sourceName).toBe("wearekent_"));
  });

  it("evidence contient eth + usd + rank", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    const first = result.rows[0];
    expect(first.evidence).toContain("eth=1.5");
    expect(first.evidence).toContain("usd=3200");
    expect(first.evidence).toContain("rank=1");
  });

  it("visibility = internal_only (JAMAIS scam/drainer)", () => {
    const result = parseCsv(WEAREKENT_CSV, KENT_OPTS);
    result.rows.forEach(r => {
      expect(r.visibility).toBe("internal_only");
      expect(r.labelType).not.toBe("scam");
      expect(r.labelType).not.toBe("drainer");
      expect(r.labelType).not.toBe("phishing");
    });
  });
});
