// ─── TigerScore versioning + snapshot persistence ─────────────────────────
// Writes an immutable ScoreSnapshot row every time a score is computed. The
// snapshot carries the engine version, the top reasons, per-driver
// provenance and the governed-status snapshot at scoring time — so we can
// always reconstruct *why* a given number was shown at a given moment.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TigerDriver, TigerResult, TigerTier } from "@/lib/tigerscore/engine";
import type { ConfidenceLevel } from "./confidence";
import type { ProvenanceData } from "./provenance";
import type {
  EntityType,
  GovernedStatusRecord,
} from "@/lib/governance/status";
import { normaliseEntityValue } from "@/lib/governance/status";

// Bumped whenever the engine weights, driver ids or semantics change. Also
// exposed via the /api/v1/score response so retail can see which version
// produced the number they're looking at.
export const TIGERSCORE_ENGINE_VERSION = "1.0.0";

export interface SnapshotInput {
  entityType: EntityType;
  entityValue: string;
  chain: string;
  result: Pick<TigerResult, "score" | "tier" | "drivers">;
  confidenceLevel: ConfidenceLevel;
  provenance: ProvenanceData;
  governedStatus?: GovernedStatusRecord | null;
  rawInput?: unknown;
  version?: string; // override for tests
}

export interface SnapshotRecord {
  id: string;
  entityType: EntityType;
  entityValue: string;
  chain: string;
  score: number;
  tier: TigerTier;
  confidenceLevel: ConfidenceLevel;
  version: string;
  topReasons: TigerDriver[];
  provenanceData: ProvenanceData | null;
  governedStatus: GovernedStatusRecord | null;
  createdAt: Date;
}

const TOP_REASONS_MAX = 5;

function castSnapshot(
  row: Awaited<ReturnType<typeof prisma.scoreSnapshot.findFirst>>,
): SnapshotRecord | null {
  if (!row) return null;
  const reasons = (row.topReasons as unknown as TigerDriver[]) ?? [];
  const provenance = (row.provenanceData as unknown as ProvenanceData | null) ?? null;
  const governed = (row.governedStatus as unknown as GovernedStatusRecord | null) ?? null;
  return {
    id: row.id,
    entityType: row.entityType as EntityType,
    entityValue: row.entityValue,
    chain: row.chain,
    score: row.score,
    tier: row.tier as TigerTier,
    confidenceLevel: row.confidenceLevel as ConfidenceLevel,
    version: row.version,
    topReasons: reasons,
    provenanceData: provenance,
    governedStatus: governed,
    createdAt: row.createdAt,
  };
}

function topReasons(drivers: TigerDriver[]): TigerDriver[] {
  // Order by absolute delta then severity rank. Deterministic.
  const rank: Record<TigerDriver["severity"], number> = {
    critical: 4,
    high: 3,
    med: 2,
    low: 1,
  };
  const sorted = [...drivers].sort((a, b) => {
    const sev = rank[b.severity] - rank[a.severity];
    if (sev !== 0) return sev;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
  return sorted.slice(0, TOP_REASONS_MAX);
}

export async function snapshotScore(
  input: SnapshotInput,
): Promise<SnapshotRecord> {
  const normalised = normaliseEntityValue(input.entityType, input.entityValue);
  const version = input.version ?? TIGERSCORE_ENGINE_VERSION;

  const row = await prisma.scoreSnapshot.create({
    data: {
      entityType: input.entityType,
      entityValue: normalised,
      chain: input.chain,
      score: Math.max(0, Math.min(100, Math.round(input.result.score))),
      tier: input.result.tier,
      confidenceLevel: input.confidenceLevel,
      version,
      topReasons: topReasons(input.result.drivers) as unknown as Prisma.InputJsonValue,
      provenanceData: input.provenance as unknown as Prisma.InputJsonValue,
      governedStatus: input.governedStatus
        ? (input.governedStatus as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      rawInput: input.rawInput
        ? (input.rawInput as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
  return castSnapshot(row)!;
}

export async function getLatestSnapshot(
  entityType: EntityType,
  entityValue: string,
): Promise<SnapshotRecord | null> {
  const normalised = normaliseEntityValue(entityType, entityValue);
  const row = await prisma.scoreSnapshot.findFirst({
    where: { entityType, entityValue: normalised },
    orderBy: { createdAt: "desc" },
  });
  return castSnapshot(row);
}

export async function listSnapshots(
  entityType: EntityType,
  entityValue: string,
  limit = 20,
): Promise<SnapshotRecord[]> {
  const normalised = normaliseEntityValue(entityType, entityValue);
  const rows = await prisma.scoreSnapshot.findMany({
    where: { entityType, entityValue: normalised },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows
    .map((r) => castSnapshot(r))
    .filter((x): x is SnapshotRecord => x !== null);
}

export { topReasons };
