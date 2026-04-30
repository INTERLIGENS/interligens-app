import { describe, it, expect, beforeEach } from "vitest";
import { detectShillSignals, detectCrossChannelBurst, clearCrossChannelCache } from "../signalDetector";
import type { TelegramMessage } from "../types";

function mkMsg(text: string, channelId = "ch_001"): TelegramMessage {
  return {
    id: Math.random(),
    channelId,
    channelTitle: "Test Channel",
    text,
    date: new Date(),
    tokenMentions: [{ type: "contract_sol", value: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", context: text }],
    urgencyLevel: "high",
    callerConfidence: 70,
  };
}

beforeEach(() => {
  clearCrossChannelCache();
});

describe("detectShillSignals", () => {
  it("detects GEM_ALERT pattern", () => {
    const signals = detectShillSignals(mkMsg("💎 gem alert — buy now!"));
    expect(signals.some(s => s.type === "GEM_ALERT")).toBe(true);
  });

  it("detects PUMP_CALL pattern", () => {
    const signals = detectShillSignals(mkMsg("This is the next 100x coin 🚀"));
    expect(signals.some(s => s.type === "PUMP_CALL")).toBe(true);
  });

  it("detects BUY_NOW pattern", () => {
    const signals = detectShillSignals(mkMsg("BUY NOW before it pumps! dont miss"));
    expect(signals.some(s => s.type === "BUY_NOW")).toBe(true);
  });

  it("returns GENERIC for moderate confidence text", () => {
    const msg = mkMsg("just launched early entry");
    const signals = detectShillSignals(msg);
    expect(signals.length).toBeGreaterThan(0);
  });

  it("returns empty for low confidence clean text", () => {
    const msg: TelegramMessage = { ...mkMsg("Hello"), tokenMentions: [], callerConfidence: 0, urgencyLevel: "low" };
    const signals = detectShillSignals(msg);
    expect(signals.every(s => s.score >= 30 || s.type !== "GENERIC")).toBe(true);
  });

  it("score never exceeds 100", () => {
    const signals = detectShillSignals(mkMsg("💎 gem alert 100x next 100x buy now ape in dont miss 🚀"));
    expect(signals.every(s => s.score <= 100)).toBe(true);
  });
});

describe("detectCrossChannelBurst", () => {
  it("flags token mentioned by 2+ channels within window", () => {
    const msgs = [
      mkMsg("buy $SCAM token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "ch_001"),
      mkMsg("buy $SCAM token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "ch_002"),
    ];
    const burst = detectCrossChannelBurst(msgs);
    expect(burst).toContain("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  });

  it("does not flag single-channel token", () => {
    const msgs = [
      mkMsg("buy token DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "ch_001"),
    ];
    const burst = detectCrossChannelBurst(msgs);
    expect(burst).not.toContain("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  });
});
