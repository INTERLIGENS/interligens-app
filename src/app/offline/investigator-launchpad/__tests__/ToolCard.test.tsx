// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCard } from "../_components/ToolCard";
import type { InvestigatorTool } from "../_data/tools";

const SAMPLE: InvestigatorTool = {
  id: "etherscan",
  name: "Etherscan",
  category: "blockchain-explorers",
  url: "https://etherscan.io/",
  shortUsage: "Ethereum mainnet block, tx and address explorer.",
  free: true,
};

afterEach(() => cleanup());

describe("ToolCard — rendering", () => {
  it("renders the tool name and short usage", () => {
    render(<ToolCard tool={SAMPLE} />);
    expect(screen.getByText("Etherscan")).toBeTruthy();
    expect(
      screen.getByText("Ethereum mainnet block, tx and address explorer."),
    ).toBeTruthy();
  });

  it("renders an <a> linking to the tool url", () => {
    render(<ToolCard tool={SAMPLE} />);
    const card = screen.getByTestId("tool-card") as HTMLAnchorElement;
    expect(card.tagName).toBe("A");
    expect(card.getAttribute("href")).toBe("https://etherscan.io/");
  });

  it("opens external link in a new tab with noopener noreferrer", () => {
    render(<ToolCard tool={SAMPLE} />);
    const card = screen.getByTestId("tool-card");
    expect(card.getAttribute("target")).toBe("_blank");
    const rel = card.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  it("shows a 'Paid' badge for non-free tools and 'Free' otherwise", () => {
    const { rerender } = render(<ToolCard tool={SAMPLE} />);
    expect(screen.getByText("Free")).toBeTruthy();

    rerender(<ToolCard tool={{ ...SAMPLE, id: "nansen", free: false }} />);
    expect(screen.getByText("Paid")).toBeTruthy();
  });

  it("renders the caution note when present", () => {
    render(
      <ToolCard
        tool={{ ...SAMPLE, caution: "Account required for full features." }}
      />,
    );
    expect(
      screen.getByText(/Account required for full features\./),
    ).toBeTruthy();
  });
});
