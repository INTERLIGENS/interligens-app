import { describe, test, expect } from "vitest";
import {
  runIntegrityGate,
  MINIMUM_EXHIBIT_FIELDS,
  ESCALATION_PACK_FIELDS,
} from "../integrity-gate";

const completeExhibit = () => ({
  exhibitId: "EX-001",
  type: "screenshot",
  description: "synthetic discord chat",
  source: "synthetic-demo",
  dateCollected: "2026-05-20",
  collectionMethod: "manual",
  hashSha256: "0".repeat(64),
  storageUri: "synthetic://demo/ex-001",
  redactionStatus: "synthetic-pii-placeholder",
});

const completeEscalationExhibit = () => ({
  ...completeExhibit(),
  originalFilename: "ex-001.png",
  relevance: "supports timeline",
  attributionLevel: "wallet-cluster",
  sourceReliability: "self-collected",
  admissibilityRisk: "low",
  chainOfCustodyNotes: "self-collected by reporter, synthetic",
  cexTouchpointReference: "synthetic-cex-1",
});

describe("Evidence integrity gate — V1", () => {
  test("declares the 9 minimum fields explicitly", () => {
    expect(MINIMUM_EXHIBIT_FIELDS).toHaveLength(9);
  });

  test("declares the 7 escalation-pack fields explicitly", () => {
    expect(ESCALATION_PACK_FIELDS).toHaveLength(7);
  });

  test("blocks when no exhibits at all", () => {
    const r = runIntegrityGate([]);
    expect(r.ok).toBe(false);
    expect(r.blockedReason).toBe("no-exhibits");
  });

  test("passes when one fully-formed exhibit is provided", () => {
    const r = runIntegrityGate([completeExhibit()]);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  test("blocks and lists every missing field for an empty exhibit", () => {
    const r = runIntegrityGate([{ exhibitId: "EX-bare" }]);
    expect(r.ok).toBe(false);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.exhibitId).toBe("EX-bare");
    // 8 fields missing (all except exhibitId itself).
    expect(r.issues[0]?.missing).toHaveLength(8);
  });

  test("each of the 9 minimum fields is blocking individually", () => {
    for (const field of MINIMUM_EXHIBIT_FIELDS) {
      const ex = completeExhibit() as Record<string, unknown>;
      delete ex[field];
      const r = runIntegrityGate([ex]);
      expect(r.ok).toBe(false);
      expect(r.issues[0]?.missing).toContain(field);
    }
  });

  test("escalation pack adds 7 additional blocking fields", () => {
    const r = runIntegrityGate([completeExhibit()], { escalationPack: true });
    expect(r.ok).toBe(false);
    // Minimum 9 fields were satisfied; escalation 7 are missing.
    expect(r.issues[0]?.missing).toEqual(
      expect.arrayContaining([...ESCALATION_PACK_FIELDS]),
    );
  });

  test("escalation pack passes when all 16 fields present", () => {
    const r = runIntegrityGate([completeEscalationExhibit()], {
      escalationPack: true,
    });
    expect(r.ok).toBe(true);
  });

  test("treats empty strings as missing", () => {
    const ex = completeExhibit();
    ex.hashSha256 = "";
    const r = runIntegrityGate([ex]);
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.missing).toContain("hashSha256");
  });
});
