import { describe, test, expect } from "vitest";
import { computeJurisdictionalFlags } from "../flags";

describe("Jurisdictional flags — V1", () => {
  test("FR jurisdiction and fr language together", () => {
    const r = computeJurisdictionalFlags({
      reportingCountry: "FR",
      reportingLanguage: "fr",
    });
    expect(r.reportingCountryIsFrance).toBe(true);
    expect(r.reportingLanguageIsFrench).toBe(true);
    expect(r.francophoneCountry).toBe(true);
    expect(r.francophoneNonFrance).toBe(false);
  });

  test("Belgian reporter writing in French is francophoneNonFrance", () => {
    const r = computeJurisdictionalFlags({
      reportingCountry: "BE",
      reportingLanguage: "fr",
    });
    expect(r.reportingCountryIsFrance).toBe(false);
    expect(r.reportingLanguageIsFrench).toBe(true);
    expect(r.francophoneCountry).toBe(true);
    expect(r.francophoneNonFrance).toBe(true);
    expect(
      r.notes.some((n) => n.includes("do not auto-route")),
    ).toBe(true);
  });

  test("English-speaking French resident is FR but not francophoneNonFrance", () => {
    const r = computeJurisdictionalFlags({
      reportingCountry: "FR",
      reportingLanguage: "en",
    });
    expect(r.reportingCountryIsFrance).toBe(true);
    expect(r.reportingLanguageIsFrench).toBe(false);
    expect(r.francophoneNonFrance).toBe(false);
  });

  test("detects UK touchpoint from cex jurisdiction", () => {
    const r = computeJurisdictionalFlags({
      reportingCountry: "FR",
      reportingLanguage: "fr",
      cexTouchpointDetected: [{ jurisdiction: "UK" }],
    });
    expect(r.touchpoints.UK).toBe(true);
    expect(r.touchpointList).toEqual(["UK"]);
  });

  test("detects all five touchpoints UK/SG/HK/UAE/US", () => {
    const r = computeJurisdictionalFlags({
      cexTouchpointDetected: [
        { jurisdiction: "UK" },
        { jurisdiction: "SG" },
        { jurisdiction: "HK" },
        { jurisdiction: "UAE" },
        { jurisdiction: "US" },
      ],
    });
    expect(r.touchpointList).toEqual(["UK", "SG", "HK", "UAE", "US"]);
    expect(r.touchpoints.UK).toBe(true);
    expect(r.touchpoints.SG).toBe(true);
    expect(r.touchpoints.HK).toBe(true);
    expect(r.touchpoints.UAE).toBe(true);
    expect(r.touchpoints.US).toBe(true);
  });

  test("touchpoint detected from domain TLD", () => {
    const r = computeJurisdictionalFlags({
      domains: [{ tld: "ae" }],
    });
    expect(r.touchpoints.UAE).toBe(true);
  });

  test("no touchpoints when none detected", () => {
    const r = computeJurisdictionalFlags({
      reportingCountry: "DE",
      reportingLanguage: "de",
    });
    expect(r.touchpointList).toEqual([]);
    expect(r.francophoneCountry).toBe(false);
  });

  test("touchpoint jurisdiction casing normalised", () => {
    const r = computeJurisdictionalFlags({
      cexTouchpointDetected: [{ jurisdiction: "uk" }, { jurisdiction: "us " }],
    });
    expect(r.touchpoints.UK).toBe(true);
    expect(r.touchpoints.US).toBe(true);
  });
});
