import { describe, it, expect, vi, beforeEach } from "vitest";
import { preSwapScan } from "../preSwapScan";

const FROM = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const TO = "So11111111111111111111111111111111111111112";

function mockScore(fromVerdict: string, toVerdict: string) {
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    calls++;
    const verdict = calls === 1 ? fromVerdict : toVerdict;
    return { ok: true, json: async () => ({ verdict, score: verdict === "RED" ? 75 : verdict === "ORANGE" ? 45 : 15 }) };
  }));
}

describe("preSwapScan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("allows swap when both tokens are GREEN", async () => {
    mockScore("GREEN", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.fromVerdict).toBe("GREEN");
    expect(result.toVerdict).toBe("GREEN");
    expect(result.warning).toBeUndefined();
  });

  it("blocks swap when source token is RED", async () => {
    mockScore("RED", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("RED");
  });

  it("blocks swap when destination token is RED", async () => {
    mockScore("GREEN", "RED");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(true);
    expect(result.toVerdict).toBe("RED");
  });

  it("warns but allows swap when source token is ORANGE", async () => {
    mockScore("ORANGE", "GREEN");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain("ORANGE");
    expect(result.fromVerdict).toBe("ORANGE");
  });

  it("warns but allows swap when destination token is ORANGE", async () => {
    mockScore("GREEN", "ORANGE");
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain("ORANGE");
  });

  it("fail-open (GREEN) when API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network error"); }));
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
    expect(result.fromVerdict).toBe("GREEN");
    expect(result.toVerdict).toBe("GREEN");
  });

  it("fail-open when API returns non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const result = await preSwapScan(FROM, TO);
    expect(result.blocked).toBe(false);
  });
});
