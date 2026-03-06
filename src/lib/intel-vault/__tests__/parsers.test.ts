import { describe, it, expect } from "vitest";
import { parseCsv } from "../parsers/csv";
import { parseJson } from "../parsers/json";
import { parseText } from "../parsers/text";
import { toExportUrl } from "../parsers/sheet";

const OPTS = {
  sourceName: "test",
  label: "test_label",
  defaultLabelType: "other" as const,
  visibility: "internal_only" as const,
};

// ── CSV parser ──────────────────────────────────────────────────────────────────
describe("parseCsv", () => {
  it("parse un CSV simple avec colonne address", () => {
    const csv = `address,amount\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.5\n0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B,2.0`;
    const result = parseCsv(csv, OPTS);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].chain).toBe("ethereum");
    expect(result.rows[0].label).toBe("test_label");
    expect(result.warnings).toHaveLength(0);
  });

  it("ignore les lignes sans adresse valide", () => {
    const csv = `address,name\nnot-valid,Alice\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,Bob`;
    const result = parseCsv(csv, OPTS);
    expect(result.rows).toHaveLength(1);
  });

  it("extrait evidence eth/usd/rank pour wearekent-style", () => {
    const csv = `address,eth_amount,usd_value,rank\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,1.2,3000,5`;
    const result = parseCsv(csv, {
      ...OPTS,
      sourceName: "wearekent_",
      label: "kent_unclaimed_airdrop_list",
      defaultLabelType: "airdrop_target",
      defaultChain: "ethereum",
    });
    expect(result.rows[0].evidence).toContain("eth=1.2");
    expect(result.rows[0].evidence).toContain("usd=3000");
    expect(result.rows[0].evidence).toContain("rank=5");
  });

  it("retourne warning si aucune adresse trouvée", () => {
    const csv = `name,amount\nAlice,1\nBob,2`;
    const result = parseCsv(csv, OPTS);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warn sur chains mixtes EVM + Solana", () => {
    const csv = `address\n0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\nBYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb`;
    const result = parseCsv(csv, OPTS);
    const hasChainWarn = result.warnings.some(w => w.includes("Chains mixtes"));
    expect(hasChainWarn).toBe(true);
  });
});

// ── JSON parser ─────────────────────────────────────────────────────────────────
describe("parseJson", () => {
  it("extrait adresses d'un tableau plat", () => {
    const json = JSON.stringify([
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    ]);
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(2);
  });

  it("extrait adresses imbriquées dans des objets", () => {
    const json = JSON.stringify({
      wallets: [{ addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }],
    });
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(1);
  });

  it("déduplique les adresses", () => {
    const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const json = JSON.stringify([addr, addr, addr]);
    const result = parseJson(json, OPTS);
    expect(result.rows).toHaveLength(1);
  });
});

// ── Text parser ─────────────────────────────────────────────────────────────────
describe("parseText", () => {
  it("extrait adresses EVM d'un thread", () => {
    const text = `
      Attention scam détecté sur 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
      et aussi 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B — évitez ces wallets!
    `;
    const result = parseText(text, OPTS);
    expect(result.rows).toHaveLength(2);
  });

  it("retourne warning si aucune adresse dans le texte", () => {
    const result = parseText("Rien ici, juste du texte.", OPTS);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });
});

// ── Sheet URL converter ─────────────────────────────────────────────────────────
describe("toExportUrl", () => {
  it("convertit une URL /edit en export CSV", () => {
    const url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0";
    const exportUrl = toExportUrl(url);
    expect(exportUrl).toContain("/export?format=csv");
    expect(exportUrl).toContain("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms");
    expect(exportUrl).toContain("gid=0");
  });

  it("convertit une URL /pub", () => {
    const url = "https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=123456789";
    const exportUrl = toExportUrl(url);
    expect(exportUrl).toContain("gid=123456789");
  });

  it("lève une erreur pour une URL invalide", () => {
    expect(() => toExportUrl("https://example.com/not-a-sheet")).toThrow();
  });
});
