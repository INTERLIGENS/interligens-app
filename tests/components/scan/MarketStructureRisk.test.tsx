// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MarketStructureRisk from "@/components/scan/MarketStructureRisk";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function assessment(
  overrides: Partial<MmRiskAssessment["overall"] & { extra?: unknown }> & {
    engine?: Partial<MmRiskAssessment["engine"]>;
  } = {},
): MmRiskAssessment {
  return {
    registry: { entity: null, attribution: null, registryDrivenScore: 0 },
    engine: {
      behaviorDrivenScore: 62,
      rawBehaviorScore: 62,
      confidence: "medium",
      coverage: "medium",
      signals: [],
      detectorBreakdown: {
        washTrading: {
          detectorType: "WASH_TRADING",
          score: 70,
          maxScore: 100,
          signals: [],
          evidence: {},
          durationMs: 1,
        },
        cluster: {
          detectorType: "CLUSTER_COORDINATION",
          score: 40,
          maxScore: 100,
          signals: [],
          evidence: {},
          durationMs: 1,
        },
        concentration: {
          detectorType: "CONCENTRATION_ABNORMALITY",
          score: 55,
          maxScore: 100,
          signals: [],
          evidence: {},
          durationMs: 1,
        },
        fakeLiquidity: null,
        priceAsymmetry: null,
        postListingPump: null,
      },
      capsApplied: [],
      coOccurrence: { admitted: [], gatedOut: [] },
      cohortKey: null,
      cohortPercentiles: null,
      ...overrides.engine,
    },
    overall: {
      displayScore: 62,
      band: "ORANGE",
      dominantDriver: "BEHAVIORAL",
      displayReason: "BEHAVIORAL_PATTERN_MEDIUM",
      disclaimer: "ignored — component uses its own copy",
      freshness: {
        computedAt: new Date().toISOString(),
        ageMinutes: 3,
        staleness: "fresh",
      },
      ...overrides,
    },
    subjectType: "TOKEN",
    subjectId: "0xabc",
    chain: "ETHEREUM",
    scanRunId: "run_1",
    schemaVersion: 1,
    computedAt: new Date().toISOString(),
    source: "compute",
  };
}

describe("MarketStructureRisk", () => {
  it("renders the EN title, score, and detected signal badges", () => {
    render(<MarketStructureRisk result={assessment()} locale="en" />);
    expect(screen.getByText("Market Structure Risk")).toBeDefined();
    // Score shows inside the circle.
    expect(screen.getByLabelText(/Market Structure Risk — 62\/100/)).toBeDefined();
    // Top badge is the highest-scoring detector (wash trading at 70).
    expect(screen.getByText("Wash trading signals")).toBeDefined();
    expect(screen.getByText("Abnormal volume concentration")).toBeDefined();
    expect(screen.getByText("Coordinated wallet cluster")).toBeDefined();
  });

  it("renders nothing when displayScore < 20 AND band GREEN (no noise)", () => {
    const { container } = render(
      <MarketStructureRisk
        result={assessment({
          displayScore: 5,
          band: "GREEN",
          dominantDriver: "NONE",
          displayReason: "NO_SIGNAL",
        })}
        locale="en"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the FR base disclaimer + partial-analysis suffix when coverage=low", () => {
    render(
      <MarketStructureRisk
        result={assessment({
          engine: {
            behaviorDrivenScore: 42,
            rawBehaviorScore: 42,
            confidence: "low",
            coverage: "low",
            signals: [],
            detectorBreakdown: {
              washTrading: {
                detectorType: "WASH_TRADING",
                score: 42,
                maxScore: 100,
                signals: [],
                evidence: {},
                durationMs: 1,
              },
              cluster: null,
              concentration: null,
              fakeLiquidity: null,
              priceAsymmetry: null,
              postListingPump: null,
            },
            capsApplied: [],
            coOccurrence: { admitted: [], gatedOut: [] },
            cohortKey: null,
            cohortPercentiles: null,
          },
          displayScore: 42,
          band: "YELLOW",
          dominantDriver: "BEHAVIORAL",
          displayReason: "BEHAVIORAL_PATTERN_MEDIUM",
        })}
        locale="fr"
      />,
    );
    // FR base copy.
    expect(
      screen.getByText(/Signaux comportementaux détectés/),
    ).toBeDefined();
    // Partial-analysis suffix inlined after the base copy.
    expect(
      screen.getByText(/Analyse partielle — données ou historique limités/),
    ).toBeDefined();
  });

  it("expand toggle reveals confidence / coverage / detector scores", () => {
    render(<MarketStructureRisk result={assessment()} locale="en" />);
    const toggle = screen.getByRole("button", { name: /view details/i });
    // Collapsed: detector-score grid label is not present.
    expect(screen.queryByText(/Detector scores/i)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Detector scores/i)).toBeDefined();
    // Confidence + coverage both surface as "MEDIUM" — expect at least 2.
    expect(screen.getAllByText("MEDIUM").length).toBeGreaterThanOrEqual(2);
    // Zero-score detectors still render but dimmed (e.g. fakeLiquidity = 0).
    expect(screen.getByText("Fake liquidity detected")).toBeDefined();
  });

  it("never uses the forbidden 'manipulated / fraud' vocabulary", () => {
    const { container } = render(
      <MarketStructureRisk result={assessment()} locale="en" />,
    );
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toContain("manipulated");
    expect(text.toLowerCase()).not.toContain("manipulation confirmed");
    expect(text.toLowerCase()).not.toContain("fraud");
  });

  // GPT-architect stricter gate: render ONLY when displayScore >= 20 AND
  // signals fire. These four tests guard against regressions.

  it("returns null when signals array is empty even if score is non-zero", () => {
    const { container } = render(
      <MarketStructureRisk
        result={assessment({
          engine: {
            behaviorDrivenScore: 35,
            rawBehaviorScore: 35,
            confidence: "medium",
            coverage: "medium",
            signals: [],
            // All detectors null → topDetectors() returns empty → render nothing.
            detectorBreakdown: {
              washTrading: null,
              cluster: null,
              concentration: null,
              fakeLiquidity: null,
              priceAsymmetry: null,
              postListingPump: null,
            },
            capsApplied: [],
            coOccurrence: { admitted: [], gatedOut: [] },
            cohortKey: null,
            cohortPercentiles: null,
          },
          displayScore: 35,
          band: "YELLOW",
          dominantDriver: "BEHAVIORAL",
          displayReason: "BEHAVIORAL_INSUFFICIENT",
        })}
        locale="en"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when displayScore < 20 regardless of band or signals", () => {
    const { container } = render(
      <MarketStructureRisk
        result={assessment({ displayScore: 12, band: "YELLOW" })}
        locale="en"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the block when displayScore >= 40 with signals", () => {
    render(
      <MarketStructureRisk
        result={assessment({ displayScore: 55, band: "ORANGE" })}
        locale="en"
      />,
    );
    expect(screen.getByText("Market Structure Risk")).toBeDefined();
    expect(screen.getByLabelText(/Market Structure Risk — 55\/100/)).toBeDefined();
  });

  it("never surfaces 'No market' / 'No cluster' / 'limited on-chain' empty-state copy", () => {
    const { container: full } = render(
      <MarketStructureRisk result={assessment()} locale="en" />,
    );
    const fullText = full.textContent ?? "";
    expect(fullText.toLowerCase()).not.toContain("no market");
    expect(fullText.toLowerCase()).not.toContain("no cluster");
    expect(fullText.toLowerCase()).not.toContain("limited on-chain");

    // FR locale too — same block, same copy rule.
    const { container: fr } = render(
      <MarketStructureRisk result={assessment()} locale="fr" />,
    );
    const frText = fr.textContent ?? "";
    expect(frText.toLowerCase()).not.toContain("aucun signal de manipulation");
  });
});
