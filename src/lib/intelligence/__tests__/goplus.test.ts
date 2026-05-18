import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGoPlusToken, fetchGoPlusAddress } from "../sources/goplus";

// NOTE — the GoPlus ingestor is a realtime per-address lookup with no cache
// layer (see header comment in sources/goplus.ts: "Not a batch fetcher").
// There is therefore no cache behaviour to assert here; the relevant
// resilience contract is "cache miss → empty array, never throws", covered
// by the HTTP-error and abort tests below.
//
// The module timeout is 5_000ms (TIMEOUT_MS). The abort path is exercised
// by mocking fetch to reject with an "abort" error rather than by waiting
// on a real timer.

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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

  it("returns empty array on timeout/abort (never throws)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("abort"));
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns empty array when no risk signals found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
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
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns HIGH-risk SourceRaw for a honeypot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        code: 1,
        result: {
          "0xabc": { is_honeypot: "1", is_blacklisted: "0", buy_tax: "0", sell_tax: "0" },
        },
      })
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSlug).toBe("goplus");
    expect(result[0].riskClass).toBe("HIGH");
    expect(result[0].label).toContain("honeypot");
  });

  it("classifies hidden_owner as MEDIUM risk", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        code: 1,
        result: {
          "0xabc": { is_honeypot: "0", hidden_owner: "1", buy_tax: "0", sell_tax: "0" },
        },
      })
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toHaveLength(1);
    expect(result[0].riskClass).toBe("MEDIUM");
    expect(result[0].label).toContain("hidden_owner");
  });

  it("flags a high sell tax as a risk signal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        code: 1,
        result: {
          "0xabc": { is_honeypot: "0", buy_tax: "0", sell_tax: "0.25" },
        },
      })
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("high_sell_tax");
  });

  it("returns empty array when GoPlus reports a non-success code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ code: 0, message: "error", result: {} })
    );
    const result = await fetchGoPlusToken("0xabc", "ethereum");
    expect(result).toEqual([]);
  });
});

describe("fetchGoPlusAddress", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 })
    );
    const result = await fetchGoPlusAddress("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns empty array when the address has no risk signals", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ code: 1, result: { phishing_activities: "0", cybercrime: "0" } })
    );
    const result = await fetchGoPlusAddress("0xabc", "ethereum");
    expect(result).toEqual([]);
  });

  it("returns HIGH-risk SourceRaw for a phishing address", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ code: 1, result: { phishing_activities: "1" } })
    );
    const result = await fetchGoPlusAddress("0xabc", "ethereum");
    expect(result).toHaveLength(1);
    expect(result[0].sourceSlug).toBe("goplus");
    expect(result[0].entityType).toBe("ADDRESS");
    expect(result[0].riskClass).toBe("HIGH");
    expect(result[0].label).toContain("phishing");
  });

  it("never throws on a rejected fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const result = await fetchGoPlusAddress("0xabc", "ethereum");
    expect(result).toEqual([]);
  });
});
