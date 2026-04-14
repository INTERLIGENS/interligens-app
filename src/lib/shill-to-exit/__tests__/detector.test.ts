import { describe, it, expect } from "vitest";
import {
  correlate,
  type ShillEvent,
  type ExitEvent,
} from "../detector";

const HANDLE = "testkol";
const CA = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function mkShill(hoursAgo: number, tokenSymbol: string = "SCAM"): ShillEvent {
  return {
    handle: HANDLE,
    tokenCA: CA,
    tokenSymbol,
    shillDate: new Date(Date.now() - hoursAgo * 3600 * 1000),
    postUrl: "https://x.com/testkol/status/1",
  };
}

function mkExit(hoursAgo: number, amountUsd = 50_000, symbol: string | null = "SCAM"): ExitEvent {
  return {
    handle: HANDLE,
    tokenCA: CA,
    tokenSymbol: symbol,
    walletAddress: "0xwallet",
    sellDate: new Date(Date.now() - hoursAgo * 3600 * 1000),
    amountUsd,
    txHash: `0xtx${hoursAgo}`,
    eventType: "sell",
  };
}

describe("correlate — severity buckets", () => {
  it("exit < 24h after shill → CRITICAL", () => {
    const shills = [mkShill(48)]; // shill 48h ago
    const exits = [mkExit(36)]; // exit 36h ago → 12h after shill
    const signals = correlate(HANDLE, shills, exits);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("CRITICAL");
    expect(signals[0].hoursToExit).toBeGreaterThan(0);
    expect(signals[0].hoursToExit).toBeLessThan(24);
  });

  it("exit between 24h and 72h → HIGH", () => {
    const shills = [mkShill(100)];
    const exits = [mkExit(50)]; // 50h after shill
    const [sig] = correlate(HANDLE, shills, exits);
    expect(sig.severity).toBe("HIGH");
  });

  it("exit between 72h and 168h → MEDIUM", () => {
    const shills = [mkShill(200)];
    const exits = [mkExit(100)]; // 100h after shill
    const [sig] = correlate(HANDLE, shills, exits);
    expect(sig.severity).toBe("MEDIUM");
  });

  it("exit > 168h after shill → no signal", () => {
    const shills = [mkShill(400)]; // shill 400h ago
    const exits = [mkExit(100)]; // exit 100h ago → 300h after shill
    expect(correlate(HANDLE, shills, exits)).toEqual([]);
  });

  it("exit BEFORE shill → no signal (negative delay)", () => {
    const shills = [mkShill(10)]; // shill 10h ago
    const exits = [mkExit(40)]; // exit 40h ago → BEFORE the shill
    expect(correlate(HANDLE, shills, exits)).toEqual([]);
  });
});

describe("correlate — fallback shapes", () => {
  it("no shills → []", () => {
    expect(correlate(HANDLE, [], [mkExit(10)])).toEqual([]);
  });
  it("no exits → []", () => {
    expect(correlate(HANDLE, [mkShill(10)], [])).toEqual([]);
  });
  it("both empty → []", () => {
    expect(correlate(HANDLE, [], [])).toEqual([]);
  });
});

describe("correlate — matching", () => {
  it("matches on token address (case-insensitive for EVM)", () => {
    const shills: ShillEvent[] = [
      { ...mkShill(100), tokenCA: CA.toUpperCase() },
    ];
    const exits: ExitEvent[] = [
      { ...mkExit(50), tokenCA: CA.toLowerCase() },
    ];
    expect(correlate(HANDLE, shills, exits)).toHaveLength(1);
  });

  it("matches on symbol when CA is missing", () => {
    const shills: ShillEvent[] = [
      { ...mkShill(100), tokenCA: "", tokenSymbol: "BOTIFY" },
    ];
    const exits: ExitEvent[] = [
      { ...mkExit(50), tokenCA: "", tokenSymbol: "BOTIFY" },
    ];
    expect(correlate(HANDLE, shills, exits)).toHaveLength(1);
  });

  it("picks the most recent shill preceding the exit", () => {
    const shills: ShillEvent[] = [
      mkShill(300), // old
      mkShill(100), // recent → should be the one picked
    ];
    const exits: ExitEvent[] = [mkExit(50)]; // 50h after the recent shill
    const [sig] = correlate(HANDLE, shills, exits);
    expect(sig.severity).toBe("HIGH"); // 50h = HIGH, not MEDIUM (which 250h would be)
  });

  it("dedupes on (tokenCA, txHash)", () => {
    const shills = [mkShill(100)];
    const exits = [mkExit(50), mkExit(50)]; // identical
    const signals = correlate(HANDLE, shills, exits);
    expect(signals).toHaveLength(1);
  });
});
