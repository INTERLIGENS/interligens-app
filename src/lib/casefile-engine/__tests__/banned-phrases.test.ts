import { describe, test, expect } from "vitest";
import { checkBannedPhrases } from "../banned-phrases";

describe("Banned phrases linter (regex)", () => {
  test('detects "John stole" with subject', () => {
    expect(checkBannedPhrases("John stole the funds").length).toBeGreaterThan(0);
  });

  test('detects "NovaYield is responsible"', () => {
    expect(
      checkBannedPhrases("NovaYield is responsible for the loss").length,
    ).toBeGreaterThan(0);
  });

  test('detects "funds were stolen by NovaYield"', () => {
    expect(
      checkBannedPhrases("funds were stolen by NovaYield").length,
    ).toBeGreaterThan(0);
  });

  test('detects "the team is guilty"', () => {
    expect(
      checkBannedPhrases("the team is guilty of fraud").length,
    ).toBeGreaterThan(0);
  });

  test('detects "scammer" isolated', () => {
    expect(
      checkBannedPhrases("the scammer used a wallet").length,
    ).toBeGreaterThan(0);
  });

  test('"stolen" isolated without subject NOT detected', () => {
    expect(checkBannedPhrases("reported stolen funds")).toEqual([]);
  });

  test('"stolen cryptocurrency" inside a case-law citation passes', () => {
    const text =
      "CLM v CLN [2022] SGHC 46 dealt with stolen cryptocurrency assets";
    expect(checkBannedPhrases(text)).toEqual([]);
  });

  test("detects multiple violations in one document", () => {
    const text =
      "The scammer is guilty of fraud. Funds were stolen by the team.";
    expect(checkBannedPhrases(text).length).toBeGreaterThanOrEqual(3);
  });

  test('detects "find a lawyer" lead-gen wording', () => {
    expect(
      checkBannedPhrases("we can find a lawyer for you").length,
    ).toBeGreaterThan(0);
  });

  test('detects "recovery guaranteed" promise', () => {
    expect(
      checkBannedPhrases("recovery guaranteed in 30 days").length,
    ).toBeGreaterThan(0);
  });
});
