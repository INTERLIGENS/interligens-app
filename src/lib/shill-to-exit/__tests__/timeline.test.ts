import { describe, it, expect } from "vitest";
import { buildTimeline, getShillToExitDeltaDays } from "../timeline";
import type { ShillEvent, ExitEvent } from "../types";

const T0 = new Date("2025-01-01T10:00:00Z");
const T1 = new Date("2025-01-01T14:00:00Z");
const T2 = new Date("2025-01-02T10:00:00Z");

function mkShill(date: Date): ShillEvent {
  return { handle: "kol", tweetId: "1", tweetDate: date, tokenMentioned: "SCAM", sentiment: "bullish" };
}

function mkExit(date: Date, amountUsd = 5000): ExitEvent {
  return { wallet: "0xwallet", txHash: "0xtxhash", date, tokenSold: "SCAM", amountUsd };
}

describe("buildTimeline", () => {
  it("sorts events chronologically", () => {
    const tl = buildTimeline([mkShill(T1)], [mkExit(T0)]);
    expect(tl[0].type).toBe("EXIT");
    expect(tl[1].type).toBe("SHILL");
  });

  it("includes SHILL entries with correct label", () => {
    const tl = buildTimeline([mkShill(T0)], []);
    expect(tl).toHaveLength(1);
    expect(tl[0].type).toBe("SHILL");
    expect(tl[0].label).toContain("SCAM");
  });

  it("includes EXIT entries with amountUsd", () => {
    const tl = buildTimeline([], [mkExit(T0, 12000)]);
    expect(tl[0].type).toBe("EXIT");
    expect(tl[0].amountUsd).toBe(12000);
  });

  it("handles empty inputs", () => {
    expect(buildTimeline([], [])).toEqual([]);
  });

  it("merges multiple shills and exits in order", () => {
    const tl = buildTimeline(
      [mkShill(T0), mkShill(T2)],
      [mkExit(T1, 1000)]
    );
    expect(tl.map(e => e.type)).toEqual(["SHILL", "EXIT", "SHILL"]);
  });
});

describe("getShillToExitDeltaDays", () => {
  it("returns 1 for 24h gap", () => {
    const delta = getShillToExitDeltaDays(T0, new Date(T0.getTime() + 86400_000));
    expect(delta).toBeCloseTo(1);
  });

  it("returns 0.5 for 12h gap", () => {
    const delta = getShillToExitDeltaDays(T0, new Date(T0.getTime() + 43200_000));
    expect(delta).toBeCloseTo(0.5);
  });
});
