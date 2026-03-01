import { describe, it, expect } from "vitest";
import { buildOnChainEvidence } from "./builder";

describe("Evidence Builder", () => {
  it("returns provider item when data_source+source_detail given", () => {
    const items = buildOnChainEvidence({ chain: "ETH", data_source: "etherscan", source_detail: "api.etherscan.io" });
    expect(items.some(i => i.id === "provider")).toBe(true);
    expect(items[0].value).toContain("Etherscan");
  });

  it("backward-compat: provider_used still works", () => {
    const items = buildOnChainEvidence({ chain: "ETH", provider_used: "https://eth.llamarpc.com" });
    expect(items.some(i => i.id === "provider")).toBe(true);
  });

  it("Uniswap spender => OFFICIAL + correct label + explorer link", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      spenders: ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d"],
    });
    const sp = items.find(i => i.id === "spender_0");
    expect(sp?.badge).toBe("OFFICIAL");
    expect(sp?.severity).toBe("low");
    expect(sp?.value).toContain("Uniswap");
    expect(sp?.explorer_url).toContain("etherscan.io");
    expect(sp?.explorer_url).toContain("0x7a250d5630b4cf539739df2c5dacb4c659f2488d");
  });

  it("unknown spender => UNKNOWN + high severity + explorer link", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      spenders: ["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
    });
    const sp = items.find(i => i.id === "spender_0");
    expect(sp?.badge).toBe("UNKNOWN");
    expect(sp?.severity).toBe("high");
    expect(sp?.explorer_url).toContain("etherscan.io");
  });

  it("BSC spender => bscscan explorer link", () => {
    const items = buildOnChainEvidence({
      chain: "BSC",
      spenders: ["0x10ed43c718714eb63d5aa57b78b54704e256024e"],
    });
    const sp = items.find(i => i.id === "spender_0");
    expect(sp?.badge).toBe("OFFICIAL");
    expect(sp?.explorer_url).toContain("bscscan.com");
  });

  it("no spenders => no spender items", () => {
    const items = buildOnChainEvidence({ chain: "ETH" });
    expect(items.some(i => i.id.startsWith("spender_"))).toBe(false);
  });

  it("adds freeze_auth item when freezeAuthority=true", () => {
    const items = buildOnChainEvidence({ chain: "SOL", freezeAuthority: true });
    expect(items.some(i => i.id === "freeze_auth")).toBe(true);
  });

  it("caps at 3 items max", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      provider_used: "https://eth.llamarpc.com",
      spenders: ["0xdeadbeef00000000000000000000000000000000"],
      freezeAuthority: true,
      mintAuthority: true,
      unlimitedCount: 2,
    });
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it("known bad spender => CRITICAL item + explorer_url", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      spenders: ["0xba5ddd1f9d7f570dc94a51479a000e3bce967196"], // Angel Drainer v2
    });
    const bad = items.find(i => i.id === "known_bad_0");
    expect(bad?.badge).toBe("CRITICAL");
    expect(bad?.severity).toBe("critical");
    expect(bad?.explorer_url).toContain("etherscan.io");
    expect(bad?.value).toContain("Angel Drainer");
  });

  it("known bad counterparty => CRITICAL item", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      counterparties: ["0x0000db5c8b030ae20308ac975898e09741e70000"], // Inferno Drainer
    });
    const bad = items.find(i => i.id === "known_bad_0");
    expect(bad?.badge).toBe("CRITICAL");
    expect(bad?.value).toContain("Inferno");
  });

  it("official counterparty => OFFICIAL label + explorer_url", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      counterparties: ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d"],
    });
    const cp = items.find(i => i.id === "counterparty_0");
    expect(cp?.badge).toBe("OFFICIAL");
    expect(cp?.value).toContain("Uniswap");
    expect(cp?.explorer_url).toContain("etherscan.io");
  });

  it("known bad preempts cap — appears first", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      data_source: "etherscan",
      source_detail: "api.etherscan.io",
      spenders: ["0xba5ddd1f9d7f570dc94a51479a000e3bce967196"],
      counterparties: ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d"],
    });
    expect(items.length).toBeLessThanOrEqual(3);
    const badIdx = items.findIndex(i => i.id === "known_bad_0");
    expect(badIdx).toBeGreaterThanOrEqual(0);
  });
});
