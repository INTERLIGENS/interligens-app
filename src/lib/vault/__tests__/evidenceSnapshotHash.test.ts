import { describe, it, expect } from "vitest";
import { generateSnapshotRecordHash } from "../evidenceSnapshotHash";

const BASE_INPUT = {
  caseId: "case_abc",
  url: "https://example.com/post",
  title: "Test snapshot",
  sourceType: "WEBSITE" as const,
  note: "Some note",
  tags: ["rug-pull", "kol"],
  relatedEntityId: null,
  capturedAt: new Date("2026-05-02T12:00:00.000Z"),
};

describe("generateSnapshotRecordHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = generateSnapshotRecordHash(BASE_INPUT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", () => {
    const h1 = generateSnapshotRecordHash(BASE_INPUT);
    const h2 = generateSnapshotRecordHash(BASE_INPUT);
    expect(h1).toBe(h2);
  });

  it("changes when caseId differs", () => {
    const h1 = generateSnapshotRecordHash(BASE_INPUT);
    const h2 = generateSnapshotRecordHash({ ...BASE_INPUT, caseId: "case_other" });
    expect(h1).not.toBe(h2);
  });

  it("changes when URL differs", () => {
    const h1 = generateSnapshotRecordHash(BASE_INPUT);
    const h2 = generateSnapshotRecordHash({ ...BASE_INPUT, url: "https://other.com" });
    expect(h1).not.toBe(h2);
  });

  it("changes when capturedAt differs", () => {
    const h1 = generateSnapshotRecordHash(BASE_INPUT);
    const h2 = generateSnapshotRecordHash({
      ...BASE_INPUT,
      capturedAt: new Date("2026-05-02T13:00:00.000Z"),
    });
    expect(h1).not.toBe(h2);
  });

  it("handles null url", () => {
    const h1 = generateSnapshotRecordHash({ ...BASE_INPUT, url: null });
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tag order does not affect hash (sorted canonically)", () => {
    const h1 = generateSnapshotRecordHash({ ...BASE_INPUT, tags: ["kol", "rug-pull"] });
    const h2 = generateSnapshotRecordHash({ ...BASE_INPUT, tags: ["rug-pull", "kol"] });
    expect(h1).toBe(h2);
  });
});
