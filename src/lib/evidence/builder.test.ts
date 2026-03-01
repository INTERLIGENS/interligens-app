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

  it("labels official spender correctly", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      spenders: ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d"],
    });
    const cp = items.find(i => i.id === "counterparty");
    expect(cp?.badge).toBe("OFFICIAL");
    expect(cp?.severity).toBe("low");
  });

  it("labels unknown spender as UNKNOWN high severity", () => {
    const items = buildOnChainEvidence({
      chain: "ETH",
      spenders: ["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
    });
    const cp = items.find(i => i.id === "counterparty");
    expect(cp?.badge).toBe("UNKNOWN");
    expect(cp?.severity).toBe("high");
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
});
