// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MmStatusBadge } from "@/components/mm/MmStatusBadge";
import type { MmStatus } from "@/lib/mm/types";

const ALL: MmStatus[] = [
  "CONVICTED",
  "CHARGED",
  "SETTLED",
  "INVESTIGATED",
  "DOCUMENTED",
  "OBSERVED",
];

const EXPECTED_LABEL: Record<MmStatus, string> = {
  CONVICTED: "CONDAMNÉ",
  CHARGED: "INCULPÉ",
  SETTLED: "RÈGLEMENT",
  INVESTIGATED: "SOUS ENQUÊTE",
  DOCUMENTED: "DOCUMENTÉ",
  OBSERVED: "OBSERVÉ",
};

describe("MmStatusBadge", () => {
  for (const status of ALL) {
    it(`renders ${status} with the expected FR label`, () => {
      const { getByTestId } = render(<MmStatusBadge status={status} />);
      const node = getByTestId(`mm-status-badge-${status}`);
      expect(node.textContent).toBe(EXPECTED_LABEL[status]);
    });
  }

  it("supports size=md with larger padding", () => {
    const { getByTestId } = render(
      <MmStatusBadge status="CONVICTED" size="md" />,
    );
    const node = getByTestId("mm-status-badge-CONVICTED");
    expect(node.getAttribute("style")).toContain("padding: 6px 12px");
  });
});
