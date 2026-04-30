import { describe, it, expect } from "vitest";
import { extractTokenMentions, parseMessage } from "../messageParser";

describe("extractTokenMentions", () => {
  it("detects ETH contract address", () => {
    const tokens = extractTokenMentions("Check 0xdAC17F958D2ee523a2206206994597C13D831ec7 now");
    expect(tokens.some(t => t.type === "contract_eth")).toBe(true);
    expect(tokens[0].value).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
  });

  it("detects SOL contract address", () => {
    const tokens = extractTokenMentions("Buy DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 now");
    expect(tokens.some(t => t.type === "contract_sol")).toBe(true);
  });

  it("detects TRON address", () => {
    const tokens = extractTokenMentions("Send to TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m6 asap");
    expect(tokens.some(t => t.type === "contract_tron")).toBe(true);
  });

  it("detects $TICKER mentions", () => {
    const tokens = extractTokenMentions("Buy $BONK before it moons 🚀");
    expect(tokens.some(t => t.type === "ticker" && t.value === "BONK")).toBe(true);
  });

  it("deduplicates identical mentions", () => {
    const tokens = extractTokenMentions("$BONK $BONK $BONK moon");
    const bonkCount = tokens.filter(t => t.value === "BONK").length;
    expect(bonkCount).toBe(1);
  });

  it("returns empty array for clean text", () => {
    expect(extractTokenMentions("Hello world, no tokens here!")).toHaveLength(0);
  });
});

describe("parseMessage", () => {
  it("assigns critical urgency for high-confidence shill", () => {
    const result = parseMessage("🚀 GEM ALERT: BUY NOW 0xdAC17F958D2ee523a2206206994597C13D831ec7 100x DONT MISS");
    expect(result.urgencyLevel).toBe("critical");
    expect(result.callerConfidence).toBeGreaterThanOrEqual(80);
  });

  it("assigns low urgency for benign text", () => {
    const result = parseMessage("Just a regular market update today.");
    expect(result.urgencyLevel).toBe("low");
    expect(result.callerConfidence).toBe(0);
  });

  it("returns token mentions", () => {
    const result = parseMessage("Buy $SOL before moon 🚀");
    expect(result.tokens.some(t => t.value === "SOL")).toBe(true);
  });

  it("increases confidence with address present", () => {
    const withAddr = parseMessage("buy now 0xdAC17F958D2ee523a2206206994597C13D831ec7");
    const noAddr = parseMessage("buy now");
    expect(withAddr.callerConfidence).toBeGreaterThan(noAddr.callerConfidence);
  });

  it("caps callerConfidence at 100", () => {
    const result = parseMessage(
      "💎 GEM ALERT 🚀 100x next 100x BUY NOW ape in dont miss just launched low cap 0xdAC17F958D2ee523a2206206994597C13D831ec7 $SCAM"
    );
    expect(result.callerConfidence).toBeLessThanOrEqual(100);
  });
});
