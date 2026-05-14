import { describe, it, expect } from "vitest";
import { ADMIN_COPY } from "@/lib/reflex/admin-copy";
import { findForbidden, assertClean } from "@/lib/reflex/forbidden-words";

function collectStrings(obj: unknown, acc: string[] = []): string[] {
  if (typeof obj === "string") {
    acc.push(obj);
    return acc;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      collectStrings(v, acc);
    }
  }
  return acc;
}

describe("admin calibration copy — lint-clean (CI gate)", () => {
  it("contains some strings (sanity)", () => {
    expect(collectStrings(ADMIN_COPY).length).toBeGreaterThan(10);
  });

  it("every string passes the forbidden-words lint", () => {
    const all = collectStrings(ADMIN_COPY);
    expect(findForbidden(all)).toHaveLength(0);
  });

  it("assertClean does not throw on any string field", () => {
    const all = collectStrings(ADMIN_COPY);
    expect(() => assertClean(all, "ADMIN_COPY")).not.toThrow();
  });

  it("includes the three alert messages", () => {
    expect(ADMIN_COPY.alerts.overfiring).toBeTruthy();
    expect(ADMIN_COPY.alerts.underfiring).toBeTruthy();
    expect(ADMIN_COPY.alerts.slow).toBeTruthy();
  });
});
