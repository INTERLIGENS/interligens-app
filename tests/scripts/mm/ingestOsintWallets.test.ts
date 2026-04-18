import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma + registry mocks ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

const mmSourceFindFirst = vi.fn<AnyFn>();
const mmSourceCreate = vi.fn<AnyFn>();
const mmAttributionFindFirst = vi.fn<AnyFn>();
const mmAttributionCreate = vi.fn<AnyFn>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmSource: {
      findFirst: (arg: unknown) => mmSourceFindFirst(arg),
      create: (arg: unknown) => mmSourceCreate(arg),
    },
    mmAttribution: {
      findFirst: (arg: unknown) => mmAttributionFindFirst(arg),
      create: (arg: unknown) => mmAttributionCreate(arg),
    },
  },
}));

const findEntityBySlug = vi.fn<AnyFn>();
const createEntity = vi.fn<AnyFn>();
vi.mock("@/lib/mm/registry/entities", () => ({
  findEntityBySlug: (slug: unknown) => findEntityBySlug(slug),
  createEntity: (input: unknown, actor: unknown) => createEntity(input, actor),
}));

const writeReviewLog = vi.fn<AnyFn>(async () => ({}));
vi.mock("@/lib/mm/registry/reviewLog", () => ({
  writeReviewLog: (arg: unknown) => writeReviewLog(arg),
}));

import {
  ENTITIES_TO_ENSURE,
  WALLETS,
  ingestOsintWallets,
} from "../../../scripts/mm/ingestOsintWallets";

beforeEach(() => {
  mmSourceFindFirst.mockReset();
  mmSourceCreate.mockReset();
  mmAttributionFindFirst.mockReset();
  mmAttributionCreate.mockReset();
  findEntityBySlug.mockReset();
  createEntity.mockReset();
  writeReviewLog.mockClear();

  mmSourceCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `src-${Math.random().toString(36).slice(2, 8)}`,
      ...data,
    }),
  );
  mmAttributionCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: `attr-${Math.random().toString(36).slice(2, 8)}`,
      ...data,
    }),
  );

  // Force the ep-square-band guard to pass without leaking creds.
  process.env.DATABASE_URL = "postgres://user:pass@ep-square-band.example/db";
});

describe("ingestOsintWallets", () => {
  it("creates the 6 missing entities when none exist", async () => {
    findEntityBySlug.mockResolvedValue(null);
    createEntity.mockImplementation(async (input: { slug: string }) => ({
      id: `ent-${input.slug}`,
      slug: input.slug,
      workflow: "DRAFT",
    }));
    mmSourceFindFirst.mockResolvedValue(null);
    mmAttributionFindFirst.mockResolvedValue(null);

    const summary = await ingestOsintWallets();
    expect(summary.entitiesCreated).toBe(ENTITIES_TO_ENSURE.length);
    expect(createEntity).toHaveBeenCalledTimes(ENTITIES_TO_ENSURE.length);
  });

  it("does not recreate entities that already exist", async () => {
    findEntityBySlug.mockImplementation(async (slug: string) => ({
      id: `ent-${slug}`,
      slug,
      workflow: "DRAFT",
    }));
    mmSourceFindFirst.mockResolvedValue(null);
    mmAttributionFindFirst.mockResolvedValue(null);

    const summary = await ingestOsintWallets();
    expect(summary.entitiesCreated).toBe(0);
    expect(summary.entitiesExisted).toBe(ENTITIES_TO_ENSURE.length);
    expect(createEntity).not.toHaveBeenCalled();
  });

  it("skips duplicate attributions", async () => {
    findEntityBySlug.mockImplementation(async (slug: string) => ({
      id: `ent-${slug}`,
      slug,
      workflow: "DRAFT",
    }));
    mmSourceFindFirst.mockImplementation(async () => ({ id: "src-existing" }));
    mmAttributionFindFirst.mockResolvedValue({ id: "attr-already-there" });

    const summary = await ingestOsintWallets();
    expect(summary.attributionsCreated).toBe(0);
    expect(summary.attributionsExisted).toBe(WALLETS.length);
  });

  it("logs every new attribution into the review log", async () => {
    findEntityBySlug.mockImplementation(async (slug: string) => ({
      id: `ent-${slug}`,
      slug,
      workflow: "DRAFT",
    }));
    mmSourceFindFirst.mockResolvedValue(null);
    mmAttributionFindFirst.mockResolvedValue(null);

    await ingestOsintWallets();

    // Each source creation + each attribution creation writes a review log.
    // 29 attributions + N distinct sources → at least 29 calls.
    expect(writeReviewLog.mock.calls.length).toBeGreaterThanOrEqual(WALLETS.length);
    // Every attribution-level call should carry targetType=ATTRIBUTION.
    const attributionCalls = writeReviewLog.mock.calls.filter((args) => {
      const first = args[0] as { targetType?: string } | undefined;
      return first?.targetType === "ATTRIBUTION";
    });
    expect(attributionCalls.length).toBe(WALLETS.length);
  });

  it("refuses to run when DATABASE_URL is not ep-square-band", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@evil.example/db";
    await expect(ingestOsintWallets()).rejects.toThrow(/ep-square-band/);
  });
});
