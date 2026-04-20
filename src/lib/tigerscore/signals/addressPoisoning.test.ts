import { describe, it, expect, vi } from "vitest";
import { detectAddressPoisoning } from "./addressPoisoning";

// Minimal DB stub matching the DbShape the detector expects.
function mockDb(rows: Array<{ address: string; chain: string; kolHandle: string }>) {
  return {
    kolWallet: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

function slowDb(rows: Array<{ address: string; chain: string; kolHandle: string }>, ms: number) {
  return {
    kolWallet: {
      findMany: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(rows), ms)),
      ),
    },
  };
}

function throwingDb() {
  return {
    kolWallet: {
      findMany: vi.fn().mockRejectedValue(new Error("connection refused")),
    },
  };
}

describe("detectAddressPoisoning", () => {
  it("flags a lookalike against a known-bad entry (same first+last 4)", async () => {
    const res = await detectAddressPoisoning(
      "0xa5b0abcdef1234567890abcdef1234567890" + "1d41", // same 0xa5b0...1d41 shape
      {
        knownBad: [
          {
            address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
            chain: "ETH",
            label: "GordonGekko",
            category: "scam",
            confidence: "high",
          },
        ],
        chain: "ETH",
        db: mockDb([]),
      },
    );
    expect(res.poisoned).toBe(true);
    expect(res.match?.source).toBe("known_bad");
    expect(res.match?.lookalikeOf).toBe(
      "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    );
  });

  it("flags a lookalike against a KolWallet row from the DB", async () => {
    const res = await detectAddressPoisoning(
      "7ZhBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaCgcz", // matches 7ZhB...Cgcz
      {
        knownBad: [],
        chain: "SOL",
        db: mockDb([
          {
            address: "7ZhB5PZrNFCvSSKA9VJotGGKiRgSncQAFgTnBNzmCgcz",
            chain: "SOL",
            kolHandle: "bkokoski",
          },
        ]),
      },
    );
    expect(res.poisoned).toBe(true);
    expect(res.match?.source).toBe("kol_wallet");
    expect(res.match?.label).toBe("bkokoski");
  });

  it("does NOT flag when the address is identical to a known wallet", async () => {
    const legit = "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41";
    const res = await detectAddressPoisoning(legit, {
      knownBad: [
        {
          address: legit,
          chain: "ETH",
          label: "GordonGekko",
          category: "scam",
          confidence: "high",
        },
      ],
      chain: "ETH",
      db: mockDb([]),
    });
    expect(res.poisoned).toBe(false);
  });

  it("does NOT flag when neither prefix nor suffix match", async () => {
    const res = await detectAddressPoisoning(
      "0xdeadbeef00000000000000000000000000000000",
      {
        knownBad: [
          {
            address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
            chain: "ETH",
            label: "GordonGekko",
            category: "scam",
            confidence: "high",
          },
        ],
        chain: "ETH",
        db: mockDb([]),
      },
    );
    expect(res.poisoned).toBe(false);
  });

  it("is case-insensitive for EVM (hex) addresses", async () => {
    const res = await detectAddressPoisoning(
      "0xA5B0ABCDEF1234567890ABCDEF12345678901D41", // uppercase hex, same shape
      {
        knownBad: [
          {
            address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
            chain: "ETH",
            label: "GordonGekko",
            category: "scam",
            confidence: "high",
          },
        ],
        chain: "ETH",
        db: mockDb([]),
      },
    );
    expect(res.poisoned).toBe(true);
  });

  it("filters by chain when a chain is provided", async () => {
    // An ETH-only known-bad should NOT match a SOL input even if first/last 4 align.
    const res = await detectAddressPoisoning(
      "0xa5b0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1d41",
      {
        knownBad: [
          {
            address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
            chain: "ETH",
            label: "GordonGekko",
            category: "scam",
            confidence: "high",
          },
        ],
        chain: "SOL",
        db: mockDb([]),
      },
    );
    expect(res.poisoned).toBe(false);
  });

  it("skips the signal when the DB times out (never throws)", async () => {
    const res = await detectAddressPoisoning(
      "0xdeadbeef00000000000000000000000000000000",
      {
        knownBad: [],
        chain: "ETH",
        db: slowDb([], 3000), // 3s
        timeoutMs: 50,
      },
    );
    expect(res.poisoned).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("timeout");
  });

  it("skips the signal when the DB throws (never throws out)", async () => {
    const res = await detectAddressPoisoning(
      "0xdeadbeef00000000000000000000000000000000",
      {
        knownBad: [],
        chain: "ETH",
        db: throwingDb(),
      },
    );
    // The Promise.race → Promise.race wrapper resolves to null on rejection.
    expect(res.poisoned).toBe(false);
    expect(res.skipped).toBe(true);
  });

  it("returns invalid_input for empty or non-string addresses", async () => {
    const r1 = await detectAddressPoisoning("", { db: mockDb([]) });
    expect(r1).toEqual({
      poisoned: false,
      skipped: true,
      reason: "invalid_input",
    });
    // @ts-expect-error — deliberate bad input
    const r2 = await detectAddressPoisoning(null, { db: mockDb([]) });
    expect(r2.skipped).toBe(true);
  });
});
