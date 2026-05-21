// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ScamCounter from "../ScamCounter";
import { sortCategoriesByFrequency } from "../_components/CategoryBreakdown";
import { describeTrend } from "../_components/TrendIndicator";
import { MOCK_STATS } from "../_data/mock-stats";

describe("ScamCounter — full variant (default)", () => {
  test("renders the formatted total", () => {
    render(<ScamCounter />);
    expect(screen.getByTestId("counter-display-value").textContent).toBe(
      "487",
    );
  });

  test("renders the breakdown list when variant is 'full'", () => {
    render(<ScamCounter variant="full" />);
    expect(screen.getByTestId("category-breakdown-list")).toBeTruthy();
  });

  test("category breakdown is sorted by count descending", () => {
    const rows = sortCategoriesByFrequency(MOCK_STATS.byCategory);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].count).toBeLessThanOrEqual(rows[i - 1].count);
    }
  });

  test("breakdown items show category uppercased and count", () => {
    render(<ScamCounter variant="full" />);
    const list = screen.getByTestId("category-breakdown-list");
    expect(list.textContent).toContain("RUGPULL");
    expect(list.textContent).toContain("142");
  });
});

describe("ScamCounter — compact variant", () => {
  test("hides the breakdown when variant is 'compact'", () => {
    render(<ScamCounter variant="compact" />);
    expect(screen.queryByTestId("category-breakdown-list")).toBeNull();
  });

  test("still renders the total in compact mode", () => {
    render(<ScamCounter variant="compact" />);
    expect(screen.getByTestId("counter-display-value").textContent).toBe(
      "487",
    );
  });
});

describe("ScamCounter — trend indicator", () => {
  test("renders trend by default", () => {
    render(<ScamCounter />);
    expect(screen.getByTestId("trend-indicator")).toBeTruthy();
  });

  test("hides trend when showTrend is false", () => {
    render(<ScamCounter showTrend={false} />);
    expect(screen.queryByTestId("trend-indicator")).toBeNull();
  });

  test("describeTrend('up') uses ↑ arrow and the danger colour class", () => {
    const r = describeTrend({ period: "7d", delta: 12, direction: "up" });
    expect(r.arrow).toBe("↑");
    expect(r.signedDelta).toBe("+12");
    expect(r.colorClass).toContain("#FF3B5C");
  });

  test("describeTrend('down') uses ↓ arrow and the safe colour class", () => {
    const r = describeTrend({ period: "7d", delta: 5, direction: "down" });
    expect(r.arrow).toBe("↓");
    expect(r.signedDelta).toBe("-5");
    expect(r.colorClass).toContain("#00FF94");
  });

  test("describeTrend('flat') uses → arrow and the neutral colour class", () => {
    const r = describeTrend({ period: "30d", delta: 0, direction: "flat" });
    expect(r.arrow).toBe("→");
    expect(r.signedDelta).toBe("0");
    expect(r.colorClass).toContain("white/");
  });
});
