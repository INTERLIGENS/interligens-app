/**
 * src/lib/surveillance/signals/__tests__/detection.test.ts
 */
import { describe, test, expect } from "vitest";
import { extractTokensFromText } from "../tokenExtractor";
import { classifyWindow } from "../windowClassifier";
import { computeScore, getScoreLabel } from "../recidivismScore";

// ─── TOKEN EXTRACTION ────────────────────────────────────────────────────────

describe("extractTokensFromText", () => {
  test("extrait une adresse EVM valide", () => {
    const text = "Buy this token: 0x1234567890123456789012345678901234567890 🚀";
    const tokens = extractTokensFromText(text);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenAddress).toBe("0x1234567890123456789012345678901234567890");
  });

  test("extrait plusieurs adresses", () => {
    const text = "Token A: 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA and B: 0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const tokens = extractTokensFromText(text);
    expect(tokens).toHaveLength(2);
  });

  test("déduplique les adresses", () => {
    const text = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA and again 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const tokens = extractTokensFromText(text);
    expect(tokens).toHaveLength(1);
  });

  test("retourne vide si pas d'adresse", () => {
    const text = "Just some text about crypto with no address";
    const tokens = extractTokensFromText(text);
    expect(tokens).toHaveLength(0);
  });

  test("normalise en lowercase", () => {
    const text = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
    const tokens = extractTokensFromText(text);
    expect(tokens[0].tokenAddress).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });
});

// ─── WINDOW CLASSIFIER ───────────────────────────────────────────────────────

describe("classifyWindow", () => {
  function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
  }

  const t0 = new Date("2024-01-15T10:00:00Z");

  test("BLATANT — 30 minutes après", () => {
    const result = classifyWindow(t0, addMinutes(t0, 30));
    expect(result.bucket).toBe("BLATANT");
    expect(result.severity).toBe("danger");
    expect(result.confidence).toBe("high");
  });

  test("BLATANT — 2h exactement", () => {
    const result = classifyWindow(t0, addMinutes(t0, 120));
    expect(result.bucket).toBe("BLATANT");
  });

  test("PROBABLE — 3h après", () => {
    const result = classifyWindow(t0, addMinutes(t0, 180));
    expect(result.bucket).toBe("PROBABLE");
    expect(result.severity).toBe("warn");
  });

  test("PROBABLE — 12h après", () => {
    const result = classifyWindow(t0, addMinutes(t0, 720));
    expect(result.bucket).toBe("PROBABLE");
  });

  test("POSSIBLE — 2 jours après", () => {
    const result = classifyWindow(t0, addMinutes(t0, 2880));
    expect(result.bucket).toBe("POSSIBLE");
    expect(result.severity).toBe("info");
  });

  test("null — 10 jours après (hors fenêtre)", () => {
    const result = classifyWindow(t0, addMinutes(t0, 14400));
    expect(result.bucket).toBeNull();
  });

  test("null — vente AVANT le post", () => {
    const result = classifyWindow(t0, addMinutes(t0, -30));
    expect(result.bucket).toBeNull();
  });

  test("null — moins de 15 minutes (trop rapide)", () => {
    const result = classifyWindow(t0, addMinutes(t0, 5));
    expect(result.bucket).toBeNull();
  });
});

// ─── RECIDIVISM SCORE ────────────────────────────────────────────────────────

describe("computeScore", () => {
  test("score 0 si aucun signal", () => {
    expect(computeScore(0, 0, 0)).toBe(0);
  });

  test("1 BLATANT = 3 points", () => {
    expect(computeScore(1, 0, 0)).toBe(3);
  });

  test("1 PROBABLE = 2 points", () => {
    expect(computeScore(0, 1, 0)).toBe(2);
  });

  test("1 POSSIBLE = 1 point", () => {
    expect(computeScore(0, 0, 1)).toBe(1);
  });

  test("combinaison correcte", () => {
    expect(computeScore(2, 1, 3)).toBe(2*3 + 1*2 + 3*1); // 11
  });
});

describe("getScoreLabel", () => {
  test("0 → CLEAN", () => expect(getScoreLabel(0)).toBe("CLEAN"));
  test("1 → WATCH", () => expect(getScoreLabel(1)).toBe("WATCH"));
  test("2 → WATCH", () => expect(getScoreLabel(2)).toBe("WATCH"));
  test("3 → SUSPICIOUS", () => expect(getScoreLabel(3)).toBe("SUSPICIOUS"));
  test("5 → SUSPICIOUS", () => expect(getScoreLabel(5)).toBe("SUSPICIOUS"));
  test("6 → CONFIRMED_PATTERN", () => expect(getScoreLabel(6)).toBe("CONFIRMED_PATTERN"));
  test("10 → CONFIRMED_PATTERN", () => expect(getScoreLabel(10)).toBe("CONFIRMED_PATTERN"));
});
