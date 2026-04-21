// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MmScoreDisplay } from "@/components/mm/MmScoreDisplay";

describe("MmScoreDisplay", () => {
  it("shows the score and band text", () => {
    render(<MmScoreDisplay score={77} band="RED" />);
    expect(screen.getByText("77")).toBeTruthy();
    expect(screen.getByText("RED")).toBeTruthy();
  });

  it("clamps scores above 100", () => {
    render(<MmScoreDisplay score={250} band="RED" />);
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("clamps negative scores to 0", () => {
    render(<MmScoreDisplay score={-10} band="GREEN" />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("renders the disclaimer only when provided", () => {
    const { container, rerender } = render(
      <MmScoreDisplay score={50} band="ORANGE" />,
    );
    expect(container.textContent).not.toContain("Analyse");
    rerender(
      <MmScoreDisplay
        score={50}
        band="ORANGE"
        disclaimer="Analyse de moins de 24h. Signal fort."
      />,
    );
    expect(container.textContent).toContain("Analyse de moins de 24h");
  });
});
