// ─── TigerScore provenance ────────────────────────────────────────────────
// Pure module. Builds a per-driver lineage object that records *how* each
// signal was obtained: which upstream data source, which ingestion path,
// whether it was observed directly on-chain or inferred.
//
// The ProvenanceData shape is persisted on ScoreSnapshot.provenanceData and
// rendered in the investigator UI / exports.

import type { TigerDriver } from "@/lib/tigerscore/engine";

export type ProvenanceKind = "observed" | "inferred" | "corroborated";

export interface DriverProvenance {
  driverId: string;
  kind: ProvenanceKind;
  dataSource: string; // e.g. "helius.getTokenAccounts"
  dataSourceTier: "rpc" | "explorer" | "aggregator" | "registry" | "internal";
  fetchedAt: string; // ISO
  sampleTxs?: string[]; // up to N tx hashes as evidence
  notes?: string;
}

export interface ProvenanceData {
  engineVersion: string;
  drivers: DriverProvenance[];
  coverage: {
    chain: string;
    rpcDown: boolean;
    rpcFallbackUsed: boolean;
    dataSource?: string;
    sourceDetail?: string | null;
  };
  builtAt: string; // ISO
}

export interface BuildProvenanceInput {
  engineVersion: string;
  chain: string;
  drivers: TigerDriver[];
  rpcDown?: boolean;
  rpcFallbackUsed?: boolean;
  dataSource?: string;
  sourceDetail?: string | null;
  /**
   * Lets the caller override the default inferred data source per driver.
   * Key: driverId → override.
   */
  overrides?: Record<string, Partial<DriverProvenance>>;
  /**
   * Now() override for determinism in tests.
   */
  now?: Date;
}

// Default data-source mapping. These are conservative defaults; callers can
// override per-driver via `overrides` when the actual ingestion path is known.
const DEFAULT_DATA_SOURCE: Record<
  string,
  { dataSource: string; tier: DriverProvenance["dataSourceTier"]; kind: ProvenanceKind }
> = {
  unlimited_approvals: {
    dataSource: "erc20.approve.events",
    tier: "rpc",
    kind: "observed",
  },
  high_approvals: {
    dataSource: "erc20.approve.events",
    tier: "rpc",
    kind: "observed",
  },
  unknown_programs: {
    dataSource: "solana.instruction.programIds",
    tier: "rpc",
    kind: "observed",
  },
  freeze_authority: {
    dataSource: "solana.mint.authority",
    tier: "rpc",
    kind: "observed",
  },
  mint_authority: {
    dataSource: "solana.mint.authority",
    tier: "rpc",
    kind: "observed",
  },
  mutable_metadata: {
    dataSource: "solana.metadata.isMutable",
    tier: "rpc",
    kind: "observed",
  },
};

function inferProvenance(
  driver: TigerDriver,
): { dataSource: string; tier: DriverProvenance["dataSourceTier"]; kind: ProvenanceKind } {
  const hit = DEFAULT_DATA_SOURCE[driver.id];
  if (hit) return hit;
  return {
    dataSource: `engine.${driver.id}`,
    tier: "internal",
    kind: "inferred",
  };
}

export function buildProvenance(input: BuildProvenanceInput): ProvenanceData {
  const now = (input.now ?? new Date()).toISOString();

  const drivers: DriverProvenance[] = input.drivers.map((d) => {
    const base = inferProvenance(d);
    const override = input.overrides?.[d.id] ?? {};
    return {
      driverId: d.id,
      kind: override.kind ?? base.kind,
      dataSource: override.dataSource ?? base.dataSource,
      dataSourceTier: override.dataSourceTier ?? base.tier,
      fetchedAt: override.fetchedAt ?? now,
      sampleTxs: override.sampleTxs,
      notes: override.notes,
    };
  });

  return {
    engineVersion: input.engineVersion,
    drivers,
    coverage: {
      chain: input.chain,
      rpcDown: input.rpcDown === true,
      rpcFallbackUsed: input.rpcFallbackUsed === true,
      dataSource: input.dataSource,
      sourceDetail: input.sourceDetail ?? null,
    },
    builtAt: now,
  };
}

/**
 * Flatten provenance into a small array suitable for UI badges next to each
 * driver — observed/inferred only.
 */
export function provenanceBadgesForUi(
  provenance: ProvenanceData,
): Array<{ driverId: string; kind: ProvenanceKind; dataSourceTier: string }> {
  return provenance.drivers.map((d) => ({
    driverId: d.driverId,
    kind: d.kind,
    dataSourceTier: d.dataSourceTier,
  }));
}
