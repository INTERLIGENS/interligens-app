// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import CounterDisplay, { formatCount } from "../_components/CounterDisplay";

describe("CounterDisplay", () => {
  test("formats small numbers with no thousand separator", () => {
    expect(formatCount(487)).toBe("487");
  });

  test("formats numbers >= 1000 with thousand separator", () => {
    expect(formatCount(1487)).toBe("1,487");
  });

  test("formats numbers >= 1_000_000 with two thousand separators", () => {
    expect(formatCount(1_234_567)).toBe("1,234,567");
  });

  test("renders the formatted value and the label", () => {
    render(<CounterDisplay value={1487} label="Scams documented" />);
    expect(screen.getByTestId("counter-display-value").textContent).toBe(
      "1,487",
    );
    expect(screen.getByText("Scams documented")).toBeTruthy();
  });
});
