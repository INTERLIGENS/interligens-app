/**
 * src/lib/osint/observability/computeDashboard.test.ts
 * SPRINT B — cœur PUR du dashboard sur jeu de données MOCK. Vérifie surtout que
 * les TAUX sont calculés correctement, et que vide ⇒ hasData=false (pas de
 * chiffre inventé).
 */
import { describe, it, expect } from "vitest";
import { computeDashboard, VISION_COST_PER_PASS_USD, type SubmissionLite } from "./computeDashboard";
import { SubmissionStatus, PendingReason } from "../contracts";

const NOW = "2026-06-30T12:00:00.000Z";

function row(over: Partial<SubmissionLite> = {}): SubmissionLite {
  return {
    status: SubmissionStatus.AUTO_COMMITTED_SHADOW,
    pendingReason: null,
    visionPasses: 2,
    ingestedAt: "2026-06-30T08:00:00.000Z",
    processedAt: null,
    decisionReasons: [],
    ...over,
  };
}

describe("computeDashboard — jeu mock", () => {
  it("vide → hasData=false, tout à 0, pas de chiffre inventé", () => {
    const m = computeDashboard([], NOW);
    expect(m.hasData).toBe(false);
    expect(m.totalSubmissions).toBe(0);
    expect(m.rates.autoCommit.pct).toBe(0);
    expect(m.vision.estimatedCostUsd).toBe(0);
    expect(m.backlog.oldestAgeHours).toBeNull();
    expect(m.avgProcessingHours).toBeNull();
  });

  it("calcule les taux correctement sur 10 items", () => {
    const rows: SubmissionLite[] = [
      ...Array.from({ length: 5 }, () => row({ status: SubmissionStatus.AUTO_COMMITTED_SHADOW })),
      ...Array.from({ length: 2 }, () => row({ status: SubmissionStatus.PENDING_REVIEW, pendingReason: PendingReason.CA_ABSENT })),
      row({ status: SubmissionStatus.PENDING_REVIEW, pendingReason: PendingReason.MINT_NOT_FOUND }),
      row({ status: SubmissionStatus.REJECTED_BY_REVIEW }),
      row({ status: SubmissionStatus.DUPLICATE }),
    ];
    const m = computeDashboard(rows, NOW);

    expect(m.totalSubmissions).toBe(10);
    expect(m.rates.autoCommit).toEqual({ count: 5, pct: 50 });
    expect(m.rates.pending).toEqual({ count: 3, pct: 30 });
    expect(m.rates.rejected).toEqual({ count: 1, pct: 10 });
    expect(m.rates.duplicate).toEqual({ count: 1, pct: 10 });

    // top pending reasons triées décroissant
    expect(m.topPendingReasons[0]).toEqual({ reason: PendingReason.CA_ABSENT, count: 2 });
    expect(m.topPendingReasons.find((r) => r.reason === PendingReason.MINT_NOT_FOUND)?.count).toBe(1);

    // backlog = pending count, âge du plus ancien (08:00 → 12:00 = 4h)
    expect(m.backlog.pending).toBe(3);
    expect(m.backlog.oldestAgeHours).toBe(4);
  });

  it("coût vision = nb passes × coût unitaire (pattern X API)", () => {
    const rows = [row({ visionPasses: 2 }), row({ visionPasses: 1 }), row({ visionPasses: 2 })];
    const m = computeDashboard(rows, NOW);
    expect(m.vision.totalPasses).toBe(5);
    expect(m.vision.estimatedCostUsd).toBe(Math.round(5 * VISION_COST_PER_PASS_USD * 100) / 100);
  });

  it("erreurs Helius comptées depuis le statut et la trace de décision", () => {
    const rows = [
      row({ status: SubmissionStatus.ERROR_RETRYABLE }),
      row({ status: SubmissionStatus.ERROR_FINAL }),
      row({ status: SubmissionStatus.PENDING_REVIEW, decisionReasons: ["mint introuvable on-chain (CA factice)"] }),
      row({ status: SubmissionStatus.PENDING_REVIEW, decisionReasons: ["check mint indisponible — ne résout pas"] }),
    ];
    const m = computeDashboard(rows, NOW);
    expect(m.helius.retryable).toBe(1);
    expect(m.helius.finalErrors).toBe(1);
    expect(m.helius.notFound).toBeGreaterThanOrEqual(1);
    expect(m.helius.unavailable).toBeGreaterThanOrEqual(1);
  });

  it("temps moyen de traitement = moyenne (ingest → processed)", () => {
    const rows = [
      row({ status: SubmissionStatus.RESOLVED_BY_REVIEW, ingestedAt: "2026-06-30T08:00:00.000Z", processedAt: "2026-06-30T10:00:00.000Z" }), // 2h
      row({ status: SubmissionStatus.REJECTED_BY_REVIEW, ingestedAt: "2026-06-30T08:00:00.000Z", processedAt: "2026-06-30T12:00:00.000Z" }), // 4h
    ];
    const m = computeDashboard(rows, NOW);
    expect(m.avgProcessingHours).toBe(3);
  });

  it("volume par jour groupé UTC, trié décroissant", () => {
    const rows = [
      row({ ingestedAt: "2026-06-29T10:00:00.000Z" }),
      row({ ingestedAt: "2026-06-30T01:00:00.000Z" }),
      row({ ingestedAt: "2026-06-30T09:00:00.000Z" }),
    ];
    const m = computeDashboard(rows, NOW);
    expect(m.perDay[0]).toEqual({ day: "2026-06-30", count: 2 });
    expect(m.perDay[1]).toEqual({ day: "2026-06-29", count: 1 });
  });
});
