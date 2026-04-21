// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MmSourceCard } from "@/components/mm/MmSourceCard";

const BASE = {
  id: "src1",
  publisher: "U.S. Department of Justice",
  title: "Operation Token Mirrors press release",
  url: "https://www.justice.gov/xyz",
  sourceType: "DOJ" as const,
  credibilityTier: "TIER_1" as const,
  archivalStatus: "SUCCESS" as const,
  archivedUrl: null,
  publishedAt: "2024-10-09",
};

describe("MmSourceCard", () => {
  it("renders publisher, title, tier badge", () => {
    const { container } = render(<MmSourceCard source={BASE} />);
    expect(container.textContent).toContain("U.S. Department of Justice");
    expect(container.textContent).toContain("Operation Token Mirrors");
    expect(container.textContent).toContain("TIER 1 · OFFICIAL");
  });

  it("shows 'Archived' copy for SUCCESS status", () => {
    const { container } = render(<MmSourceCard source={BASE} />);
    expect(container.textContent).toContain("Archived");
  });

  it("renders Wayback link when archivedUrl is present", () => {
    const { container } = render(
      <MmSourceCard
        source={{ ...BASE, archivedUrl: "https://web.archive.org/xyz" }}
      />,
    );
    const link = container.querySelector(
      "a[href='https://web.archive.org/xyz']",
    );
    expect(link?.textContent).toBe("Wayback snapshot");
  });

  it("shows archival failure copy for R2_FAIL", () => {
    const { container } = render(
      <MmSourceCard source={{ ...BASE, archivalStatus: "R2_FAIL" }} />,
    );
    expect(container.textContent).toContain("Archival failed");
  });
});
