import { describe, it, expect } from "vitest";
import {
  buildProvenance,
  provenanceBadgesForUi,
} from "@/lib/tigerscore/provenance";
import type { TigerDriver } from "@/lib/tigerscore/engine";

function driver(id: string): TigerDriver {
  return { id, label: id, severity: "med", delta: 10, why: "test" };
}

const NOW = new Date("2026-04-17T10:00:00.000Z");

describe("buildProvenance", () => {
  it("maps known driver ids to their default data source", () => {
    const p = buildProvenance({
      engineVersion: "1.0.0",
      chain: "SOL",
      drivers: [driver("unlimited_approvals")],
      now: NOW,
    });
    const d = p.drivers[0];
    expect(d.kind).toBe("observed");
    expect(d.dataSource).toBe("erc20.approve.events");
    expect(d.dataSourceTier).toBe("rpc");
  });

  it("falls back to inferred for unknown driver ids", () => {
    const p = buildProvenance({
      engineVersion: "1.0.0",
      chain: "SOL",
      drivers: [driver("custom_driver")],
      now: NOW,
    });
    expect(p.drivers[0].kind).toBe("inferred");
    expect(p.drivers[0].dataSourceTier).toBe("internal");
    expect(p.drivers[0].dataSource).toBe("engine.custom_driver");
  });

  it("honours per-driver overrides", () => {
    const p = buildProvenance({
      engineVersion: "1.0.0",
      chain: "SOL",
      drivers: [driver("freeze_authority")],
      now: NOW,
      overrides: {
        freeze_authority: {
          kind: "corroborated",
          dataSource: "dune.query.1234",
          dataSourceTier: "aggregator",
          sampleTxs: ["tx-abc"],
          notes: "cross-checked with Dune",
        },
      },
    });
    expect(p.drivers[0].kind).toBe("corroborated");
    expect(p.drivers[0].dataSource).toBe("dune.query.1234");
    expect(p.drivers[0].sampleTxs).toEqual(["tx-abc"]);
  });

  it("captures coverage flags (rpcDown, rpcFallbackUsed)", () => {
    const p = buildProvenance({
      engineVersion: "1.0.0",
      chain: "ETH",
      drivers: [],
      rpcDown: true,
      rpcFallbackUsed: true,
      dataSource: "alchemy-fallback",
      sourceDetail: "primary RPC timed out",
      now: NOW,
    });
    expect(p.coverage).toEqual({
      chain: "ETH",
      rpcDown: true,
      rpcFallbackUsed: true,
      dataSource: "alchemy-fallback",
      sourceDetail: "primary RPC timed out",
    });
  });

  it("stamps engineVersion and builtAt", () => {
    const p = buildProvenance({
      engineVersion: "2.0.0",
      chain: "SOL",
      drivers: [],
      now: NOW,
    });
    expect(p.engineVersion).toBe("2.0.0");
    expect(p.builtAt).toBe(NOW.toISOString());
  });
});

describe("provenanceBadgesForUi", () => {
  it("projects each driver to driverId + kind + tier", () => {
    const p = buildProvenance({
      engineVersion: "1.0.0",
      chain: "SOL",
      drivers: [driver("unlimited_approvals"), driver("custom_x")],
      now: NOW,
    });
    const badges = provenanceBadgesForUi(p);
    expect(badges).toHaveLength(2);
    expect(badges[0]).toEqual({
      driverId: "unlimited_approvals",
      kind: "observed",
      dataSourceTier: "rpc",
    });
    expect(badges[1].kind).toBe("inferred");
  });
});
