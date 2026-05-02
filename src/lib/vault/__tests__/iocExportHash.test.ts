import { describe, it, expect } from "vitest";
import { computeExportHash } from "../iocExportHash";
import type { CanonicalIoc } from "../iocExportBuilder";

function makeIoc(overrides: Partial<CanonicalIoc> = {}): CanonicalIoc {
  return {
    id: "ioc-1",
    type: "WALLET",
    value: "abc123",
    chain: "solana",
    firstSeen: "2026-05-02T10:00:00.000Z",
    lastSeen: null,
    source: "vault-case-entity",
    confidence: 80,
    relatedCaseId: "case_1",
    relatedEntityId: "ent_1",
    relatedEvidenceSnapshotId: null,
    publishability: "SHAREABLE",
    notes: null,
    tags: [],
    createdAt: "2026-05-02T10:00:00.000Z",
    ...overrides,
  };
}

describe("computeExportHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = computeExportHash([makeIoc()]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", () => {
    const iocs = [makeIoc({ id: "a" }), makeIoc({ id: "b", value: "xyz" })];
    expect(computeExportHash(iocs)).toBe(computeExportHash(iocs));
  });

  it("input order does not affect the hash (sorted by id)", () => {
    const a = makeIoc({ id: "a", value: "wallet_a" });
    const b = makeIoc({ id: "b", value: "wallet_b" });
    expect(computeExportHash([a, b])).toBe(computeExportHash([b, a]));
  });

  it("tag order does not affect the hash (sorted canonically)", () => {
    const h1 = computeExportHash([makeIoc({ tags: ["rug", "kol"] })]);
    const h2 = computeExportHash([makeIoc({ tags: ["kol", "rug"] })]);
    expect(h1).toBe(h2);
  });

  it("changes when a value changes", () => {
    const h1 = computeExportHash([makeIoc({ value: "abc" })]);
    const h2 = computeExportHash([makeIoc({ value: "xyz" })]);
    expect(h1).not.toBe(h2);
  });

  it("changes when an IOC is added", () => {
    const h1 = computeExportHash([makeIoc({ id: "a" })]);
    const h2 = computeExportHash([makeIoc({ id: "a" }), makeIoc({ id: "b" })]);
    expect(h1).not.toBe(h2);
  });

  it("changes when publishability changes", () => {
    const h1 = computeExportHash([makeIoc({ publishability: "SHAREABLE" })]);
    const h2 = computeExportHash([makeIoc({ publishability: "PUBLISHABLE" })]);
    expect(h1).not.toBe(h2);
  });

  it("returns consistent hash for empty list", () => {
    const h1 = computeExportHash([]);
    const h2 = computeExportHash([]);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("null chain and relatedEntityId normalise to empty string (stable hash)", () => {
    const h1 = computeExportHash([makeIoc({ chain: null, relatedEntityId: null })]);
    const h2 = computeExportHash([makeIoc({ chain: null, relatedEntityId: null })]);
    expect(h1).toBe(h2);
  });
});
