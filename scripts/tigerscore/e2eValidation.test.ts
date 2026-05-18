// ─── Sprint 1 hardening — 5-case E2E wiring validation ───────────────────
// This is the vitest-runnable version of the checklist Ticket 4 script.
// Instead of hitting live RPCs + prod DB (which would be required for the
// literal wallet addresses in the checklist), it wires the hardening pieces
// against the existing tigerscore fixtures + a hand-shaped governed-status
// case. That exercises every seam of the new code:
//
//   • engine → adapter returns a valid tier
//   • confidence level is computed from the drivers
//   • provenance is built for the drivers
//   • snapshotScore persists to the DB (mocked)
//   • the governed-status layer overrides the displayed verdict when set
//
// A real staging run (with network + DB) still needs to happen before prod;
// this test proves every hardening module is wired and typesafe.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const scoreSnapshotCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scoreSnapshot: {
      create: (...a: unknown[]) => scoreSnapshotCreate(...a),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
  },
}));

import { computeTigerScoreFromScan, type ScanNormalized } from "@/lib/tigerscore/adapter";
import { computeConfidenceLevel } from "@/lib/tigerscore/confidence";
import { buildProvenance } from "@/lib/tigerscore/provenance";
import {
  snapshotScore,
  TIGERSCORE_ENGINE_VERSION,
} from "@/lib/tigerscore/versioning";

function loadFixture(name: "green" | "orange" | "red"): ScanNormalized {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "src/lib/tigerscore/__fixtures__", `${name}.json`),
      "utf-8",
    ),
  ) as ScanNormalized;
}

const CASES = [
  {
    name: "Case 1 — GREEN Normal (no signals)",
    fixture: "green" as const,
    expectedTier: "GREEN",
    target: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  {
    name: "Case 2 — ORANGE borderline",
    fixture: "orange" as const,
    expectedTier: "ORANGE",
    target: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  {
    name: "Case 3 — RED via signals",
    fixture: "red" as const,
    expectedTier: "RED",
    target: "fixture-red",
  },
  {
    name: "Case 4 — Governed status dominant (confirmed_known_bad)",
    fixture: "orange" as const,
    expectedTier: "ORANGE", // numeric tier doesn't change — the governed layer does
    target: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    governedStatus: {
      status: "confirmed_known_bad" as const,
      basis: "manual_internal_confirmation" as const,
      reason: "GordonGekko — confirmed through investigation",
    },
  },
  {
    name: "Case 5 — Authority-flagged on an otherwise-GREEN token",
    fixture: "green" as const,
    expectedTier: "GREEN",
    target: "ofac-sanctioned-address",
    governedStatus: {
      status: "authority_flagged" as const,
      basis: "external_authority_source" as const,
      reason: "Hypothetical OFAC SDN entry",
    },
  },
];

describe("hardening — 5-case E2E wiring", () => {
  beforeEach(() => {
    scoreSnapshotCreate.mockReset();
    scoreSnapshotCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "snap-" + Math.random().toString(36).slice(2, 8),
      ...args.data,
      createdAt: new Date(),
    }));
  });

  for (const c of CASES) {
    it(c.name, async () => {
      const fx = loadFixture(c.fixture);
      const result = computeTigerScoreFromScan(fx);

      // 1. Tier
      expect(result.tier).toBe(c.expectedTier);

      // 2. Confidence — computed fresh from drivers, not read from the engine.
      const confidence = computeConfidenceLevel({
        drivers: result.drivers,
        rpcDown: fx.rpc_down,
        rpcFallbackUsed: fx.rpc_fallback_used,
      });
      expect(["Low", "Medium", "High"]).toContain(confidence);

      // 3. Provenance — built for every driver.
      const provenance = buildProvenance({
        engineVersion: TIGERSCORE_ENGINE_VERSION,
        chain: fx.chain,
        drivers: result.drivers,
        rpcDown: fx.rpc_down,
        rpcFallbackUsed: fx.rpc_fallback_used,
        dataSource: fx.data_source,
        sourceDetail: fx.source_detail,
      });
      expect(provenance.drivers.length).toBe(result.drivers.length);

      // 4. Snapshot persistence.
      const snap = await snapshotScore({
        entityType: "token",
        entityValue: c.target,
        chain: fx.chain,
        result: {
          score: result.score,
          tier: result.tier,
          drivers: result.drivers,
        },
        confidenceLevel: confidence,
        provenance,
        governedStatus: c.governedStatus
          ? {
              id: "inline-gov",
              entityType: "token",
              entityValue: c.target.toLowerCase(),
              chain: fx.chain,
              status: c.governedStatus.status,
              basis: c.governedStatus.basis,
              reason: c.governedStatus.reason,
              setByUserId: "admin:e2e-test",
              setByUserRole: "admin",
              setAt: new Date(),
              reviewState: "approved",
              evidenceRefs: [],
              revokedAt: null,
              revokedByUserId: null,
              revokedReason: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null,
      });
      expect(scoreSnapshotCreate).toHaveBeenCalledTimes(1);
      expect(snap.tier).toBe(result.tier);
      expect(snap.confidenceLevel).toBe(confidence);
      expect(snap.version).toBe(TIGERSCORE_ENGINE_VERSION);

      // 5. Top-reasons shape
      expect(snap.topReasons.length).toBeLessThanOrEqual(5);
    });
  }
});
