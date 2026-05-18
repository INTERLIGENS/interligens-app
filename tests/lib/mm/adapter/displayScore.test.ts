import { describe, it, expect } from "vitest";
import {
  bandOf,
  consolidateDisplayScore,
} from "@/lib/mm/adapter/displayScore";

describe("consolidateDisplayScore", () => {
  it("returns the maximum of registry and behavioral", () => {
    expect(consolidateDisplayScore(90, 30)).toBe(90);
    expect(consolidateDisplayScore(30, 80)).toBe(80);
  });
  it("clamps inputs to [0,100]", () => {
    expect(consolidateDisplayScore(-5, 200)).toBe(100);
    expect(consolidateDisplayScore(0, 0)).toBe(0);
  });
  it("rounds fractional inputs", () => {
    expect(consolidateDisplayScore(45.4, 44.6)).toBe(45);
  });
});

describe("bandOf", () => {
  it("0-19 → GREEN", () => {
    expect(bandOf(0)).toBe("GREEN");
    expect(bandOf(19)).toBe("GREEN");
  });
  it("20-39 → YELLOW", () => {
    expect(bandOf(20)).toBe("YELLOW");
    expect(bandOf(39)).toBe("YELLOW");
  });
  it("40-69 → ORANGE", () => {
    expect(bandOf(40)).toBe("ORANGE");
    expect(bandOf(69)).toBe("ORANGE");
  });
  it("70-100 → RED", () => {
    expect(bandOf(70)).toBe("RED");
    expect(bandOf(95)).toBe("RED");
    expect(bandOf(200)).toBe("RED");
  });
});
