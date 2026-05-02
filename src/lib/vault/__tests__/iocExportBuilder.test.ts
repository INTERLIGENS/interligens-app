import { describe, it, expect } from "vitest";
import {
  filterIocsByPublishability,
  FORMAT_PUBLISHABILITY_RULES,
  type CanonicalIoc,
  type IocPublishability,
} from "../iocExportBuilder";

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

describe("filterIocsByPublishability", () => {
  it("includes SHAREABLE when allowed", () => {
    const iocs = [makeIoc({ publishability: "SHAREABLE" })];
    const { included, privateExcluded } = filterIocsByPublishability(iocs, [
      "SHAREABLE",
    ]);
    expect(included).toHaveLength(1);
    expect(privateExcluded).toBe(0);
  });

  it("excludes PRIVATE from SHAREABLE filter", () => {
    const iocs = [
      makeIoc({ id: "a", publishability: "PRIVATE" }),
      makeIoc({ id: "b", publishability: "SHAREABLE" }),
    ];
    const { included, privateExcluded } = filterIocsByPublishability(iocs, [
      "SHAREABLE",
    ]);
    expect(included).toHaveLength(1);
    expect(included[0].id).toBe("b");
    expect(privateExcluded).toBe(1);
  });

  it("THREAT_INTEL filter includes only PUBLISHABLE", () => {
    const iocs = [
      makeIoc({ id: "a", publishability: "PRIVATE" }),
      makeIoc({ id: "b", publishability: "SHAREABLE" }),
      makeIoc({ id: "c", publishability: "PUBLISHABLE" }),
    ];
    const allowed = FORMAT_PUBLISHABILITY_RULES["THREAT_INTEL_CSV"] as IocPublishability[];
    const { included, privateExcluded } = filterIocsByPublishability(iocs, allowed);
    expect(included).toHaveLength(1);
    expect(included[0].id).toBe("c");
    expect(privateExcluded).toBe(2);
  });

  it("JSON_STRUCTURED includes all statuses", () => {
    const pubs: IocPublishability[] = ["PRIVATE", "SHAREABLE", "PUBLISHABLE", "REDACTED"];
    const iocs = pubs.map((publishability, i) =>
      makeIoc({ id: `ioc-${i}`, publishability })
    );
    const allowed = FORMAT_PUBLISHABILITY_RULES["JSON_STRUCTURED"] as IocPublishability[];
    const { included, privateExcluded } = filterIocsByPublishability(iocs, allowed);
    expect(included).toHaveLength(4);
    expect(privateExcluded).toBe(0);
  });

  it("POLICE_ANNEX excludes PRIVATE", () => {
    const iocs = [
      makeIoc({ id: "a", publishability: "PRIVATE" }),
      makeIoc({ id: "b", publishability: "SHAREABLE" }),
      makeIoc({ id: "c", publishability: "PUBLISHABLE" }),
    ];
    const allowed = FORMAT_PUBLISHABILITY_RULES["POLICE_ANNEX_PDF"] as IocPublishability[];
    const { included } = filterIocsByPublishability(iocs, allowed);
    expect(included.map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("STIX_LIKE excludes PRIVATE", () => {
    const iocs = [
      makeIoc({ id: "priv", publishability: "PRIVATE" }),
      makeIoc({ id: "pub", publishability: "PUBLISHABLE" }),
    ];
    const allowed = FORMAT_PUBLISHABILITY_RULES["STIX_LIKE_JSON"] as IocPublishability[];
    const { included } = filterIocsByPublishability(iocs, allowed);
    expect(included).toHaveLength(1);
    expect(included[0].id).toBe("pub");
  });

  it("returns zero excluded for empty list", () => {
    const { included, privateExcluded } = filterIocsByPublishability([], ["SHAREABLE", "PUBLISHABLE"]);
    expect(included).toHaveLength(0);
    expect(privateExcluded).toBe(0);
  });

  it("evidence snapshots use their own publishability", () => {
    const snapshotPrivate = makeIoc({
      id: "snap-priv",
      type: "EVIDENCE_SNAPSHOT",
      publishability: "PRIVATE",
    });
    const snapshotPublic = makeIoc({
      id: "snap-pub",
      type: "EVIDENCE_SNAPSHOT",
      publishability: "PUBLISHABLE",
    });
    const { included } = filterIocsByPublishability(
      [snapshotPrivate, snapshotPublic],
      ["PUBLISHABLE"]
    );
    expect(included).toHaveLength(1);
    expect(included[0].id).toBe("snap-pub");
  });
});
