// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExplainabilityBlock } from "@/components/scan/ExplainabilityBlock";
import type { TigerDriver } from "@/lib/tigerscore/engine";

const DRIVERS: TigerDriver[] = [
  {
    id: "unlimited_approvals",
    label: "Unlimited approvals detected",
    severity: "critical",
    delta: 70,
    why: "Spender can drain wallet at any time",
  },
  {
    id: "unknown_programs",
    label: "Unknown programs interacted",
    severity: "high",
    delta: 35,
    why: "Unverified programs may be malicious",
  },
  {
    id: "high_approvals",
    label: "High approval count",
    severity: "high",
    delta: 35,
    why: "Large attack surface",
  },
];

describe("ExplainabilityBlock", () => {
  it("renders the numeric score, tier and confidence", () => {
    render(
      <ExplainabilityBlock
        score={72}
        tier="RED"
        confidence="Medium"
        topReasons={DRIVERS}
        version="1.0.0"
      />,
    );
    expect(screen.getByTestId("tiger-score-value").textContent).toBe("72");
    expect(screen.getByTestId("tiger-score-tier").textContent).toBe("RED");
    expect(screen.getByTestId("confidence-level").textContent).toBe("Medium");
    expect(screen.getByTestId("engine-version").textContent).toBe("v1.0.0");
  });

  it("clamps a score > 100 to 100", () => {
    render(
      <ExplainabilityBlock
        score={200}
        tier="RED"
        confidence="High"
        topReasons={[]}
        version="1.0.0"
      />,
    );
    expect(screen.getByTestId("tiger-score-value").textContent).toBe("100");
  });

  it("renders the top 3 reasons (and no more)", () => {
    const many = [
      ...DRIVERS,
      { id: "d4", label: "D4", severity: "med" as const, delta: 10, why: "x" },
    ];
    render(
      <ExplainabilityBlock
        score={80}
        tier="RED"
        confidence="High"
        topReasons={many}
        version="1.0.0"
      />,
    );
    expect(screen.getByTestId("reason-unlimited_approvals")).toBeTruthy();
    expect(screen.getByTestId("reason-unknown_programs")).toBeTruthy();
    expect(screen.getByTestId("reason-high_approvals")).toBeTruthy();
    expect(screen.queryByTestId("reason-d4")).toBeNull();
  });

  it("shows Observed badge for observed drivers", () => {
    render(
      <ExplainabilityBlock
        score={80}
        tier="RED"
        confidence="High"
        topReasons={[DRIVERS[0]]}
        provenanceByDriver={{ unlimited_approvals: "observed" }}
        version="1.0.0"
      />,
    );
    expect(screen.getByTestId("prov-badge-observed")).toBeTruthy();
  });

  it("defaults to Inferred badge when no provenance supplied", () => {
    render(
      <ExplainabilityBlock
        score={80}
        tier="RED"
        confidence="Low"
        topReasons={[DRIVERS[0]]}
        version="1.0.0"
      />,
    );
    expect(screen.getByTestId("prov-badge-inferred")).toBeTruthy();
  });

  it("renders dominant governed alert above the score when status != none", () => {
    render(
      <ExplainabilityBlock
        score={72}
        tier="RED"
        confidence="Medium"
        topReasons={DRIVERS}
        governedStatus={{
          status: "confirmed_known_bad",
          reason: "Confirmed through investigation",
          basisLabel: "manual internal confirmation",
        }}
        version="1.0.0"
      />,
    );
    const alert = screen.getByTestId("governed-alert");
    expect(alert).toBeTruthy();
    expect(alert.getAttribute("data-governed-status")).toBe("confirmed_known_bad");
    // English/French-independent check: governed headline appears.
    expect(screen.getByText(/Acteur malveillant confirmé|Confirmed known bad/)).toBeTruthy();
  });

  it("does NOT render the governed alert when status === none", () => {
    render(
      <ExplainabilityBlock
        score={42}
        tier="ORANGE"
        confidence="Medium"
        topReasons={DRIVERS}
        governedStatus={{ status: "none" }}
        version="1.0.0"
      />,
    );
    expect(screen.queryByTestId("governed-alert")).toBeNull();
  });

  it("renders the meaning + next sections", () => {
    render(
      <ExplainabilityBlock
        score={72}
        tier="RED"
        confidence="High"
        topReasons={DRIVERS}
        version="1.0.0"
      />,
    );
    const meaning = screen.getByTestId("meaning-next");
    expect(meaning.textContent).toContain("Risque élevé identifié");
    expect(meaning.textContent).toContain("pattern");
  });

  it("renders an English disclaimer when locale=en", () => {
    render(
      <ExplainabilityBlock
        score={72}
        tier="RED"
        confidence="High"
        topReasons={DRIVERS}
        version="1.0.0"
        locale="en"
      />,
    );
    expect(screen.getByTestId("explain-disclaimer").textContent).toMatch(
      /Editorial and algorithmic/,
    );
  });

  it("exposes tier + confidence on the root node for downstream styling", () => {
    const { container } = render(
      <ExplainabilityBlock
        score={10}
        tier="GREEN"
        confidence="High"
        topReasons={[]}
        version="1.0.0"
      />,
    );
    const root = container.querySelector("[data-testid='explainability-block']")!;
    expect(root.getAttribute("data-tier")).toBe("GREEN");
    expect(root.getAttribute("data-confidence")).toBe("High");
  });
});
