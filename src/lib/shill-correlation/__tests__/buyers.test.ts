import { describe, it, expect } from "vitest";
import {
  classifyTiming,
  extractBuyerObservations,
  looksLikeSolanaMint,
  type MinimalTx,
} from "../buyers";

const MINT = "So11111111111111111111111111111111111111112";
const OTHER = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// tweet at a fixed unix second
const TWEET = 1_700_000_000;

describe("looksLikeSolanaMint", () => {
  it("accepts base58 mint addresses (incl. pump.fun)", () => {
    expect(looksLikeSolanaMint(MINT)).toBe(true);
    expect(
      looksLikeSolanaMint("C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump"),
    ).toBe(true);
  });
  it("rejects ticker symbols and malformed strings", () => {
    expect(looksLikeSolanaMint("PHOTO")).toBe(false);
    expect(looksLikeSolanaMint("BABYT")).toBe(false);
    expect(looksLikeSolanaMint("")).toBe(false);
    expect(looksLikeSolanaMint("0xdeadbeef")).toBe(false); // contains 0
  });
});

describe("classifyTiming", () => {
  it("buckets on asymmetric bounds: a=[-10m,-30s), b=[-30s,+90s], c=(+90s,+15m]", () => {
    expect(classifyTiming(-120)).toEqual({ zone: "zone_a", type: "pre_tweet" });
    expect(classifyTiming(-31)).toEqual({ zone: "zone_a", type: "pre_tweet" });
    // -30 is the inclusive lower bound of zone_b
    expect(classifyTiming(-30)).toEqual({ zone: "zone_b", type: "near_tweet" });
    expect(classifyTiming(0)).toEqual({ zone: "zone_b", type: "near_tweet" });
    expect(classifyTiming(60)).toEqual({ zone: "zone_b", type: "near_tweet" });
    // +90 is the inclusive upper bound of zone_b
    expect(classifyTiming(90)).toEqual({ zone: "zone_b", type: "near_tweet" });
    expect(classifyTiming(91)).toEqual({ zone: "zone_c", type: "post_tweet" });
    expect(classifyTiming(300)).toEqual({ zone: "zone_c", type: "post_tweet" });
  });
});

function swap(
  sig: string,
  ts: number,
  to: string,
  amount: number,
  mint = MINT,
  type = "SWAP",
  from?: string,
): MinimalTx {
  return {
    signature: sig,
    timestamp: ts,
    type,
    tokenTransfers: [
      { fromUserAccount: from, toUserAccount: to, mint, tokenAmount: amount },
    ],
  };
}

describe("extractBuyerObservations", () => {
  it("emits one earliest acquisition per wallet, sorted by delta", () => {
    const txs: MinimalTx[] = [
      swap("s1", TWEET + 200, "walletA", 100), // later A buy — ignored
      swap("s2", TWEET + 30, "walletA", 50), // earliest A buy — kept
      swap("s3", TWEET - 120, "walletB", 10), // B pre-tweet
    ];
    const out = extractBuyerObservations(txs, MINT, TWEET, "solana");
    expect(out).toHaveLength(2);
    // sorted earliest-delta first => B (-120) then A (+30)
    expect(out[0].wallet).toBe("walletB");
    expect(out[0].deltaSecondsFromTweet).toBe(-120);
    expect(out[0].behaviorType).toBe("pre_tweet");
    expect(out[1].wallet).toBe("walletA");
    expect(out[1].deltaSecondsFromTweet).toBe(30);
    expect(out[1].entryAmountToken).toBe(50);
    expect(out[1].firstBuyTxSignature).toBe("s2");
    expect(out[1].behaviorType).toBe("near_tweet");
  });

  it("ignores transfers of other mints and zero/negative amounts", () => {
    const txs: MinimalTx[] = [
      swap("s1", TWEET + 10, "walletA", 100, OTHER),
      swap("s2", TWEET + 10, "walletB", 0),
    ];
    expect(extractBuyerObservations(txs, MINT, TWEET, "solana")).toHaveLength(0);
  });

  it("flags non-swap inflows as ambiguous with a reason note", () => {
    const txs = [swap("s1", TWEET + 5, "walletA", 100, MINT, "TRANSFER")];
    const [obs] = extractBuyerObservations(txs, MINT, TWEET, "solana");
    expect(obs.isAmbiguous).toBe(true);
    expect(obs.notes).toContain("non-swap inflow");
  });

  it("flags a wallet that also disposed the mint in-window (round-trip)", () => {
    const txs: MinimalTx[] = [
      swap("s1", TWEET + 5, "walletA", 100), // buy
      swap("s2", TWEET + 50, "pool", 100, MINT, "SWAP", "walletA"), // sell
    ];
    const byWallet = Object.fromEntries(
      extractBuyerObservations(txs, MINT, TWEET, "solana").map((o) => [
        o.wallet,
        o,
      ]),
    );
    expect(byWallet["walletA"].isAmbiguous).toBe(true);
    expect(byWallet["walletA"].notes).toContain("also disposed");
  });

  it("leaves USD/exit fields null and stamps chain + firstSeenAt", () => {
    const [obs] = extractBuyerObservations(
      [swap("s1", TWEET + 5, "walletA", 100)],
      MINT,
      TWEET,
      "solana",
    );
    expect(obs.entryAmountUsd).toBeNull();
    expect(obs.exitAmountUsd).toBeNull();
    expect(obs.exitDeltaSeconds).toBeNull();
    expect(obs.chain).toBe("solana");
    expect(obs.firstSeenAt.getTime()).toBe((TWEET + 5) * 1000);
  });
});
