import { prisma } from "@/lib/prisma";
import type { VaultCaseEntity, VaultEvidenceSnapshot } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IocType =
  | "WALLET"
  | "DEPLOYER"
  | "CONTRACT"
  | "TOKEN"
  | "TX_HASH"
  | "DOMAIN"
  | "URL"
  | "X_HANDLE"
  | "TELEGRAM"
  | "GITHUB_REPO"
  | "CEX_DEPOSIT_CANDIDATE"
  | "KOL_PROFILE"
  | "EVIDENCE_SNAPSHOT"
  | "OTHER";

// Publishability mirrors VaultEvidencePublishability; entities default to SHAREABLE.
export type IocPublishability = "PRIVATE" | "SHAREABLE" | "PUBLISHABLE" | "REDACTED";

export type CanonicalIoc = {
  id: string;
  type: IocType;
  value: string;
  chain: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  source: string;
  confidence: number | null;
  relatedCaseId: string;
  relatedEntityId: string | null;
  relatedEvidenceSnapshotId: string | null;
  publishability: IocPublishability;
  notes: string | null;
  tags: string[];
  createdAt: string;
};

export type IocBuildResult = {
  iocs: CanonicalIoc[];
  rawSnapshots: VaultEvidenceSnapshot[];
  meta: {
    totalEntities: number;
    totalSnapshots: number;
    byType: Record<string, number>;
    byPublishability: Record<string, number>;
    caseId: string;
    workspaceId: string;
    caseStatus: string;
    caseCreatedAt: string;
    caseUpdatedAt: string;
  };
};

// ── Entity type → IOC type mapping ───────────────────────────────────────────

function entityTypeToIocType(
  entity: Pick<VaultCaseEntity, "type" | "value" | "label">
): IocType {
  switch (entity.type) {
    case "WALLET":
      return "WALLET";
    case "TX_HASH":
      return "TX_HASH";
    case "CONTRACT":
      return "CONTRACT";
    case "DOMAIN":
      return "DOMAIN";
    case "URL": {
      const v = entity.value.toLowerCase();
      if (v.includes("t.me/") || v.includes("telegram.me/")) return "TELEGRAM";
      if (v.includes("github.com/")) return "GITHUB_REPO";
      return "URL";
    }
    case "HANDLE": {
      const label = (entity.label ?? "").toLowerCase();
      if (label.includes("telegram") || label.includes("tg")) return "TELEGRAM";
      return "X_HANDLE";
    }
    default:
      return "OTHER";
  }
}

// Detect chain from entity value / label.
function detectChain(entity: Pick<VaultCaseEntity, "type" | "value" | "label">): string | null {
  const label = (entity.label ?? "").toLowerCase();
  if (label.includes("solana") || label.includes("sol")) return "solana";
  if (label.includes("ethereum") || label.includes("eth")) return "ethereum";
  if (label.includes("base")) return "base";
  if (label.includes("arbitrum") || label.includes("arb")) return "arbitrum";
  if (label.includes("bsc") || label.includes("binance")) return "bsc";
  // EVM address prefix heuristic
  if (
    (entity.type === "WALLET" || entity.type === "CONTRACT") &&
    entity.value.startsWith("0x")
  ) {
    return "ethereum";
  }
  return null;
}

// ── Builder ──────────────────────────────────────────────────────────────────

export async function buildCaseIocs(caseId: string): Promise<IocBuildResult> {
  const [caseRecord, entities, snapshots] = await Promise.all([
    prisma.vaultCase.findUniqueOrThrow({
      where: { id: caseId },
      select: { id: true, workspaceId: true, status: true, createdAt: true, updatedAt: true },
    }),
    prisma.vaultCaseEntity.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.vaultEvidenceSnapshot.findMany({
      where: { caseId },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  const entityIocs: CanonicalIoc[] = entities.map((e) => ({
    id: `entity-${e.id}`,
    type: entityTypeToIocType(e),
    value: e.value,
    chain: detectChain(e),
    firstSeen: e.createdAt.toISOString(),
    lastSeen: null,
    source: "vault-case-entity",
    confidence: e.confidence !== null ? Math.round(e.confidence) : null,
    relatedCaseId: caseId,
    relatedEntityId: e.id,
    relatedEvidenceSnapshotId: null,
    // All derived case entities are SHAREABLE by default.
    publishability: "SHAREABLE",
    notes: e.label ?? null,
    tags: e.tigerVerdict ? [e.tigerVerdict] : [],
    createdAt: e.createdAt.toISOString(),
  }));

  const snapshotIocs: CanonicalIoc[] = snapshots.map((s) => ({
    id: `snapshot-${s.id}`,
    type: "EVIDENCE_SNAPSHOT" as IocType,
    value: s.url ?? s.title,
    chain: null,
    firstSeen: s.capturedAt.toISOString(),
    lastSeen: null,
    source: `vault-evidence-snapshot:${s.sourceType}`,
    confidence: 70,
    relatedCaseId: caseId,
    relatedEntityId: s.relatedEntityId ?? null,
    relatedEvidenceSnapshotId: s.id,
    publishability: s.publishability as IocPublishability,
    notes: s.contentHashSha256,
    tags: s.tags,
    createdAt: s.createdAt.toISOString(),
  }));

  const iocs = [...entityIocs, ...snapshotIocs];

  const byType: Record<string, number> = {};
  const byPublishability: Record<string, number> = {};
  for (const ioc of iocs) {
    byType[ioc.type] = (byType[ioc.type] ?? 0) + 1;
    byPublishability[ioc.publishability] = (byPublishability[ioc.publishability] ?? 0) + 1;
  }

  return {
    iocs,
    rawSnapshots: snapshots,
    meta: {
      totalEntities: entities.length,
      totalSnapshots: snapshots.length,
      byType,
      byPublishability,
      caseId,
      workspaceId: caseRecord.workspaceId,
      caseStatus: caseRecord.status,
      caseCreatedAt: caseRecord.createdAt.toISOString(),
      caseUpdatedAt: caseRecord.updatedAt.toISOString(),
    },
  };
}

// ── Publishability filter ─────────────────────────────────────────────────────

export const FORMAT_PUBLISHABILITY_RULES: Record<
  string,
  IocPublishability[]
> = {
  CSV_FULL: ["SHAREABLE", "PUBLISHABLE"],
  JSON_STRUCTURED: ["PRIVATE", "SHAREABLE", "PUBLISHABLE", "REDACTED"],
  STIX_LIKE_JSON: ["SHAREABLE", "PUBLISHABLE"],
  POLICE_ANNEX_PDF: ["SHAREABLE", "PUBLISHABLE"],
  THREAT_INTEL_CSV: ["PUBLISHABLE"],
};

export function filterIocsByPublishability(
  iocs: CanonicalIoc[],
  allowed: IocPublishability[]
): { included: CanonicalIoc[]; privateExcluded: number } {
  const allowedSet = new Set<string>(allowed);
  const included: CanonicalIoc[] = [];
  let privateExcluded = 0;
  for (const ioc of iocs) {
    if (allowedSet.has(ioc.publishability)) {
      included.push(ioc);
    } else {
      privateExcluded++;
    }
  }
  return { included, privateExcluded };
}
