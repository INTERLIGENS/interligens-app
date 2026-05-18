import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanBeforeConnect } from "../preConnectScan";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(score: number, tier: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ score, tier }),
  }));
}

describe("scanBeforeConnect", () => {
  it("returns allow=false and HIGH RISK for RED tier", async () => {
    mockFetch(80, "RED");
    const result = await scanBeforeConnect("0xdeadbeef1234567890123456789012345678abcd");
    expect(result.allow).toBe(false);
    expect(result.warning).toBe("HIGH RISK");
    expect(result.tier).toBe("RED");
  });

  it("returns allow=true and CAUTION for ORANGE tier", async () => {
    mockFetch(50, "ORANGE");
    const result = await scanBeforeConnect("0xdeadbeef1234567890123456789012345678abcd");
    expect(result.allow).toBe(true);
    expect(result.warning).toBe("CAUTION");
    expect(result.tier).toBe("ORANGE");
  });

  it("returns allow=true and no warning for GREEN tier", async () => {
    mockFetch(20, "GREEN");
    const result = await scanBeforeConnect("0xdeadbeef1234567890123456789012345678abcd");
    expect(result.allow).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.tier).toBe("GREEN");
  });

  it("infers RED tier from score >= 70 even if tier field missing", async () => {
    mockFetch(75, "");
    const result = await scanBeforeConnect("0xdeadbeef1234567890123456789012345678abcd");
    expect(result.tier).toBe("RED");
    expect(result.allow).toBe(false);
  });

  it("fail-open when API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await scanBeforeConnect("0xdeadbeef1234567890123456789012345678abcd");
    expect(result.allow).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.tier).toBe("GREEN");
  });

  it("includes address in result", async () => {
    mockFetch(20, "GREEN");
    const addr = "0xdeadbeef1234567890123456789012345678abcd";
    const result = await scanBeforeConnect(addr);
    expect(result.address).toBe(addr);
  });
});
