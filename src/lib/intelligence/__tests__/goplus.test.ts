import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGoPlusToken } from "../sources/goplus";

describe("fetchGoPlusToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array on HTTP error (cache miss → scoring continues)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns empty array on timeout (cache miss → scoring continues)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("abort"));
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns empty array when no risk signals found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 1,
          result: {
            "0xabc": {
              is_honeypot: "0",
              is_blacklisted: "0",
              is_mintable: "0",
              owner_change_balance: "0",
              can_take_back_ownership: "0",
              hidden_owner: "0",
              selfdestruct: "0",
              external_call: "0",
              cannot_sell_all: "0",
              buy_tax: "0",
              sell_tax: "0",
            },
          },
        })
      )
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns SourceRaw for honeypot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 1,
          result: {
            "0xabc": {
              is_honeypot: "1",
              is_blacklisted: "0",
              buy_tax: "0",
              sell_tax: "0",
            },
          },
        })
      )
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSlug).toBe("goplus");
    expect(result[0].riskClass).toBe("HIGH");
    expect(result[0].label).toContain("honeypot");
  });
});
