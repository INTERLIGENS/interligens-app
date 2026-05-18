import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// ─── Prisma + data-layer mocks ───────────────────────────────────────────

const entityFindUnique = vi.fn<AnyFn>();
const attributionFindMany = vi.fn<AnyFn>();
const attributionCreate = vi.fn<AnyFn>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmEntity: {
      findUnique: (arg: unknown) => entityFindUnique(arg),
    },
    mmAttribution: {
      findMany: (arg: unknown) => attributionFindMany(arg),
      create: (arg: unknown) => attributionCreate(arg),
    },
  },
}));

const fetchWalletTransactions = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/etherscan", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/mm/data/etherscan")>(
      "@/lib/mm/data/etherscan",
    );
  return {
    ...actual,
    fetchWalletTransactions: (
      address: unknown,
      chain: unknown,
      o: unknown,
      f: unknown,
    ) => fetchWalletTransactions(address, chain, o, f),
  };
});

const fetchSolanaTransactions = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/helius", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/mm/data/helius")>(
      "@/lib/mm/data/helius",
    );
  return {
    ...actual,
    fetchSolanaTransactions: (
      address: unknown,
      o: unknown,
      f: unknown,
    ) => fetchSolanaTransactions(address, o, f),
  };
});

const writeReviewLog = vi.fn<AnyFn>(async () => ({}));
vi.mock("@/lib/mm/registry/reviewLog", () => ({
  writeReviewLog: (arg: unknown) => writeReviewLog(arg),
}));

import { discoverNewWallets } from "@/lib/mm/discovery/clusterDiscovery";

// ─── Fixture builders ────────────────────────────────────────────────────

function seedCluster(chain: "ETHEREUM" | "SOLANA" = "ETHEREUM") {
  // Root funded 7 wallets (seed + 6 siblings) within 10 minutes.
  const base = 1_700_000_000;
  const root = "0xROOT";
  const seed = "0xseed";
  const siblings = Array.from({ length: 6 }, (_, i) => `0xsib${i}`);
  const txs: Array<Record<string, string | number>> = [];
  for (const [i, w] of [seed, ...siblings].entries()) {
    txs.push({
      hash: `e-${i}`,
      blockNumber: `${100 + i}`,
      timeStamp: `${base + i * 60}`,
      from: root,
      to: w,
      value: "1000000000000000000",
      gasPrice: "0",
      gasUsed: "0",
      isError: "0",
      input: "0x",
    });
    // Also a tx seed <-> sibling to give each wallet >= 10 tx activity.
    for (let j = 0; j < 12; j++) {
      txs.push({
        hash: `x-${i}-${j}`,
        blockNumber: `${200 + i * 100 + j}`,
        timeStamp: `${base + 3600 + j}`,
        from: seed,
        to: w,
        value: "0",
        gasPrice: "0",
        gasUsed: "0",
        isError: "0",
        input: "0x",
      });
    }
  }
  return { txs, seed, siblings, root, chain };
}

beforeEach(() => {
  entityFindUnique.mockReset();
  attributionFindMany.mockReset();
  attributionCreate.mockReset();
  attributionCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `attr-${Math.random().toString(36).slice(2, 8)}`,
      ...data,
    }),
  );
  fetchWalletTransactions.mockReset();
  fetchSolanaTransactions.mockReset();
  writeReviewLog.mockClear();
});

describe("discoverNewWallets", () => {
  it("returns an error when the entity does not exist", async () => {
    entityFindUnique.mockResolvedValue(null);
    const r = await discoverNewWallets("unknown");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/not found/);
    expect(r.attributionsCreated).toBe(0);
  });

  it("no clusters when entity has no attributed seeds", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    attributionFindMany.mockResolvedValueOnce([]); // seeds
    attributionFindMany.mockResolvedValueOnce([]); // allAttribs
    const r = await discoverNewWallets("gotbit");
    expect(r.walletsTested).toBe(0);
    expect(r.newWalletsFound).toBe(0);
  });

  it("discovers a cluster and persists new wallets with INFERRED_CLUSTER + 0.65", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const fx = seedCluster("ETHEREUM");
    const seedsRow = [{ walletAddress: fx.seed, chain: "ETHEREUM" }];
    // First call — seeds. Second call — allAttribs for attributedSet.
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchWalletTransactions.mockResolvedValue(fx.txs);

    const r = await discoverNewWallets("gotbit");
    expect(r.walletsTested).toBe(1);
    expect(r.clusters.length).toBeGreaterThanOrEqual(1);
    expect(r.newWalletsFound).toBeGreaterThanOrEqual(1);
    expect(attributionCreate).toHaveBeenCalled();
    const firstCall = attributionCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(firstCall.data.attributionMethod).toBe("INFERRED_CLUSTER");
    expect(firstCall.data.confidence).toBe(0.65);
  });

  it("skips wallets already attributed to the same entity", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const fx = seedCluster();
    // Pretend every sibling is already attributed.
    const allAttribs = [
      { walletAddress: fx.seed, chain: "ETHEREUM" },
      ...fx.siblings.map((w) => ({ walletAddress: w, chain: "ETHEREUM" })),
    ];
    attributionFindMany
      .mockResolvedValueOnce([allAttribs[0]]) // seeds = only target
      .mockResolvedValueOnce(allAttribs); // allAttribs full
    fetchWalletTransactions.mockResolvedValue(fx.txs);
    const r = await discoverNewWallets("gotbit");
    expect(r.attributionsCreated).toBe(0);
  });

  it("skips persistence when dryRun=true", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const fx = seedCluster();
    const seedsRow = [{ walletAddress: fx.seed, chain: "ETHEREUM" }];
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchWalletTransactions.mockResolvedValue(fx.txs);
    const r = await discoverNewWallets("gotbit", { dryRun: true });
    expect(r.newWalletsFound).toBeGreaterThanOrEqual(1);
    expect(r.attributionsCreated).toBe(0);
    expect(attributionCreate).not.toHaveBeenCalled();
  });

  it("writes one review log per persisted attribution", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const fx = seedCluster();
    const seedsRow = [{ walletAddress: fx.seed, chain: "ETHEREUM" }];
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchWalletTransactions.mockResolvedValue(fx.txs);
    const r = await discoverNewWallets("gotbit");
    expect(writeReviewLog.mock.calls.length).toBe(r.attributionsCreated);
    const logArg = writeReviewLog.mock.calls[0][0] as {
      targetType: string;
      action: string;
      actorRole: string;
    };
    expect(logArg.targetType).toBe("ATTRIBUTION");
    expect(logArg.action).toBe("CREATED");
    expect(logArg.actorRole).toBe("cluster_discovery");
  });

  it("ignores low-activity wallets (< minTxCount)", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const fx = seedCluster();
    const seedsRow = [{ walletAddress: fx.seed, chain: "ETHEREUM" }];
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchWalletTransactions.mockResolvedValue(fx.txs);
    const r = await discoverNewWallets("gotbit", { minTxCount: 1000 });
    expect(r.newWalletsFound).toBe(0);
  });

  it("captures upstream fetch errors in result.errors", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const seedsRow = [{ walletAddress: "0xseed", chain: "ETHEREUM" }];
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchWalletTransactions.mockRejectedValue(new Error("etherscan 429"));
    const r = await discoverNewWallets("gotbit");
    expect(r.walletsTested).toBe(1);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].message).toMatch(/etherscan 429/);
  });

  it("uses the Solana path when the seed chain is SOLANA", async () => {
    entityFindUnique.mockResolvedValue({ id: "e-1", slug: "gotbit" });
    const seedsRow = [{ walletAddress: "sol-seed", chain: "SOLANA" }];
    attributionFindMany
      .mockResolvedValueOnce(seedsRow)
      .mockResolvedValueOnce(seedsRow);
    fetchSolanaTransactions.mockResolvedValue([]);
    const r = await discoverNewWallets("gotbit");
    expect(fetchSolanaTransactions).toHaveBeenCalledTimes(1);
    expect(fetchWalletTransactions).not.toHaveBeenCalled();
    expect(r.walletsTested).toBe(1);
  });
});
