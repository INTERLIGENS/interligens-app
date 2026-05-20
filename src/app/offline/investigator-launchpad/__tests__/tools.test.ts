import { describe, it, expect } from "vitest";
import {
  TOOLS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type ToolCategory,
} from "../_data/tools";

const VALID_CATEGORIES = new Set<ToolCategory>(CATEGORY_ORDER);

describe("TOOLS — structural invariants", () => {
  it("exposes at least 25 tools (target band 25–40)", () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(25);
    expect(TOOLS.length).toBeLessThanOrEqual(40);
  });

  it("every tool has all required fields with the right shape", () => {
    for (const tool of TOOLS) {
      expect(typeof tool.id).toBe("string");
      expect(tool.id.length).toBeGreaterThan(0);
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.category).toBe("string");
      expect(typeof tool.url).toBe("string");
      expect(typeof tool.shortUsage).toBe("string");
      expect(tool.shortUsage.length).toBeGreaterThan(0);
      expect(typeof tool.free).toBe("boolean");
      if (tool.caution !== undefined) {
        expect(typeof tool.caution).toBe("string");
      }
    }
  });

  it("all ids are unique (kebab-case slugs)", () => {
    const ids = TOOLS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });

  it("all urls are https://", () => {
    for (const tool of TOOLS) {
      expect(tool.url.startsWith("https://")).toBe(true);
    }
  });

  it("all category values belong to the declared enum", () => {
    for (const tool of TOOLS) {
      expect(VALID_CATEGORIES.has(tool.category)).toBe(true);
    }
  });

  it("every declared category has at least one tool and a label", () => {
    for (const category of CATEGORY_ORDER) {
      const count = TOOLS.filter((t) => t.category === category).length;
      expect(count).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});
