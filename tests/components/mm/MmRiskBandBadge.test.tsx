// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MmRiskBandBadge } from "@/components/mm/MmRiskBandBadge";

const BANDS = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;

describe("MmRiskBandBadge", () => {
  for (const band of BANDS) {
    it(`renders band=${band} with matching label and testid`, () => {
      const { getByTestId } = render(<MmRiskBandBadge band={band} />);
      const node = getByTestId(`mm-band-badge-${band}`);
      expect(node.textContent).toBe(band);
    });
  }

  it("never contains the forbidden cyan palette", () => {
    for (const band of BANDS) {
      const { container } = render(<MmRiskBandBadge band={band} />);
      expect(container.innerHTML.toLowerCase()).not.toContain("00e5ff");
    }
  });
});
