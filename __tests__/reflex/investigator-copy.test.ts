import { describe, it, expect } from "vitest";
import {
  INVESTIGATOR_COPY,
  copyFor,
} from "@/lib/reflex/investigator-copy";
import { assertClean, findForbidden } from "@/lib/reflex/forbidden-words";

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

describe("investigator-copy — structure", () => {
  it("exposes en and fr locales", () => {
    expect(copyFor("en")).toBe(INVESTIGATOR_COPY.en);
    expect(copyFor("fr")).toBe(INVESTIGATOR_COPY.fr);
  });

  it("en and fr have the same shape (key parity)", () => {
    function keyShape(obj: unknown): string {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.keys(obj as Record<string, unknown>).sort()
          .map((k) => `${k}:${keyShape((obj as Record<string, unknown>)[k])}`)
          .join(",");
      }
      return typeof obj;
    }
    expect(keyShape(INVESTIGATOR_COPY.en)).toBe(keyShape(INVESTIGATOR_COPY.fr));
  });
});

describe("investigator-copy — forbidden-words lint (CI gate)", () => {
  it("en passes lint", () => {
    const strings = collectStrings(INVESTIGATOR_COPY.en);
    expect(findForbidden(strings)).toHaveLength(0);
  });

  it("fr passes lint", () => {
    const strings = collectStrings(INVESTIGATOR_COPY.fr);
    expect(findForbidden(strings)).toHaveLength(0);
  });

  it("assertClean does not throw on either locale", () => {
    expect(() => assertClean(collectStrings(INVESTIGATOR_COPY.en), "INVESTIGATOR_COPY.en")).not.toThrow();
    expect(() => assertClean(collectStrings(INVESTIGATOR_COPY.fr), "INVESTIGATOR_COPY.fr")).not.toThrow();
  });
});
