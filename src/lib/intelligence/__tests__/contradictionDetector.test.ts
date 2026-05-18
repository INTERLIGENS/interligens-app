import { describe, it, expect } from "vitest";
import { computeContradictions } from "../contradictionDetector";

const HANDLE = "testkol";
const MINT = "So11111111111111111111111111111111111111112";
const MINT2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function mkTweet(minsAgo: number, address = MINT, symbol = "SCAM") {
  return {
    postedAtUtc: new Date(Date.now() - minsAgo * 60_000),
    postUrl: "https://x.com/testkol/status/1",
    detectedTokens: JSON.stringify([{ address, symbol }]),
  };
}

function mkSell(minsAgo: number, tokenAddress = MINT, amountUsd = 50_000, symbol = "SCAM") {
  return {
    eventDate: new Date(Date.now() - minsAgo * 60_000),
    amountUsd,
    tokenAddress,
    tokenSymbol: symbol,
  };
}

describe("computeContradictions — severity mapping", () => {
  it("tweet before sell < 30min → CRITICAL", () => {
    const tweets = [mkTweet(60)];  // tweeted 60min ago
    const sells = [mkSell(45)];    // sold 45min ago → 15min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("CRITICAL");
    expect(alerts[0].delayMinutes).toBeGreaterThanOrEqual(0);
    expect(alerts[0].delayMinutes).toBeLessThan(30);
    expect(alerts[0].confidenceScore).toBe(100);
  });

  it("tweet before sell 6h → HIGH", () => {
    const tweets = [mkTweet(600)]; // tweeted 600min ago
    const sells = [mkSell(300)];   // sold 300min ago → 300min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("HIGH");
    expect(alerts[0].confidenceScore).toBe(80);
  });

  it("tweet before sell 24h → MEDIUM", () => {
    const tweets = [mkTweet(1440)]; // tweeted 24h ago
    const sells = [mkSell(600)];    // sold 600min ago → 840min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("MEDIUM");
    expect(alerts[0].confidenceScore).toBe(60);
  });

  it("sell before tweet → no alert", () => {
    const tweets = [mkTweet(30)];  // tweeted 30min ago
    const sells = [mkSell(60)];    // sold 60min ago → before tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(0);
  });

  it("sell > 24h after tweet → no alert", () => {
    const tweets = [mkTweet(3000)]; // tweeted 3000min ago
    const sells = [mkSell(600)];    // sold 600min ago → 2400min after tweet → beyond 24h
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(0);
  });
});

describe("computeContradictions — confidence bonuses", () => {
  it("KOL RED tier → +10 bonus on confidence", () => {
    const tweets = [mkTweet(600)];
    const sells = [mkSell(300)];
    const alerts = computeContradictions(HANDLE, tweets, sells, "RED");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].confidenceScore).toBe(90); // 80 + 10
  });

  it("GREEN tier → no bonus", () => {
    const tweets = [mkTweet(600)];
    const sells = [mkSell(300)];
    const alerts = computeContradictions(HANDLE, tweets, sells, "GREEN");
    expect(alerts[0].confidenceScore).toBe(80);
  });

  it("same token sold multiple times → +10 bonus", () => {
    const tweetBase = 700;
    const tweets = [mkTweet(tweetBase)];
    const sells = [
      mkSell(tweetBase - 60),  // 60min after tweet
      mkSell(tweetBase - 120), // 120min after tweet
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    // Both should have multi-sell bonus
    for (const a of alerts) {
      expect(a.confidenceScore).toBeGreaterThan(80); // 80 + 10
    }
  });

  it("RED tier + multi-sell → capped at 100", () => {
    const tweetBase = 700;
    const tweets = [mkTweet(tweetBase)];
    const sells = [
      mkSell(tweetBase - 10), // CRITICAL → base 100
      mkSell(tweetBase - 20),
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, "RED");
    for (const a of alerts) {
      expect(a.confidenceScore).toBe(100); // capped at 100
    }
  });
});

describe("computeContradictions — idempotence & dedup", () => {
  it("same tweet+sell pair produces exactly one alert (dedup)", () => {
    const tweets = [mkTweet(600), mkTweet(600)]; // duplicate tweet
    const sells = [mkSell(300)];
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    // Should deduplicate on (tokenMint, tweetAt, sellAt)
    expect(alerts).toHaveLength(1);
  });

  it("different tokens produce separate alerts", () => {
    const tweets = [
      mkTweet(600, MINT, "SCAM"),
      mkTweet(600, MINT2, "RUG"),
    ];
    const sells = [
      mkSell(300, MINT, 50_000, "SCAM"),
      mkSell(300, MINT2, 20_000, "RUG"),
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(2);
    const mints = alerts.map((a) => a.tokenMint);
    expect(mints).toContain(MINT);
    expect(mints).toContain(MINT2);
  });
});
