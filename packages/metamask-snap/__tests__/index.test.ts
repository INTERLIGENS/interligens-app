import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@metamask/snaps-sdk", () => ({
  heading: (t: string) => ({ type: "heading", value: t }),
  panel: (children: unknown[]) => ({ type: "panel", children }),
  text: (t: string) => ({ type: "text", value: t }),
  divider: () => ({ type: "divider" }),
}));

const TO_RED = "0xDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEfDeAdBeEf";
const TO_ORANGE = "0x1111111111111111111111111111111111111111";
const TO_GREEN = "0x2222222222222222222222222222222222222222";

function stubFetch(verdict: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ verdict, score: verdict === "RED" ? 80 : verdict === "ORANGE" ? 50 : 10 }),
    })),
  );
}

describe("MetaMask Snap onTransaction", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns critical severity for RED verdict", async () => {
    stubFetch("RED");
    const { onTransaction } = await import("../src/index");
    const result = await onTransaction({ transaction: { to: TO_RED }, transactionOrigin: "", chainId: "1" });
    expect(result.severity).toBe("critical");
    expect(result.content.children[0].value).toContain("HIGH RISK");
  });

  it("returns warning severity for ORANGE verdict", async () => {
    stubFetch("ORANGE");
    const { onTransaction } = await import("../src/index");
    const result = await onTransaction({ transaction: { to: TO_ORANGE }, transactionOrigin: "", chainId: "1" });
    expect(result.severity).toBe("warning");
    expect(result.content.children[0].value).toContain("CAUTION");
  });

  it("returns no severity for GREEN verdict", async () => {
    stubFetch("GREEN");
    const { onTransaction } = await import("../src/index");
    const result = await onTransaction({ transaction: { to: TO_GREEN }, transactionOrigin: "", chainId: "1" });
    expect(result.severity).toBeUndefined();
    expect(result.content.children[0].value).toContain("CLEAR");
  });

  it("fail-open when API throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("unreachable"); }));
    const { onTransaction } = await import("../src/index");
    const result = await onTransaction({ transaction: { to: TO_GREEN }, transactionOrigin: "", chainId: "1" });
    expect(result.severity).toBeUndefined();
  });

  it("handles missing to address", async () => {
    const { onTransaction } = await import("../src/index");
    const result = await onTransaction({ transaction: {}, transactionOrigin: "", chainId: "1" });
    expect(result.content).toBeDefined();
  });
});
