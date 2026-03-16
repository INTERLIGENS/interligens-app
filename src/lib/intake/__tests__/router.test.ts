import { routeIntake } from "../router";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({ id: "kol_1" }),
      update:     jest.fn().mockResolvedValue({ id: "kol_1" }),
    },
    ingestionBatch: {
      create: jest.fn().mockResolvedValue({ id: "batch_1" }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

const addr = (n: number) => Array.from({length: n}, (_,i) => ({
  chain: "EVM", address: `0x${String(i).padStart(40, "a")}`,
}));

describe("router classification", () => {
  it("ioc: only addresses", async () => {
    const r = await routeIntake("id1", { addresses: addr(1), handles: [], domains: [], txHashes: [] }, "csv");
    expect(r.classification).toBe("ioc");
  });

  it("kol: only handles", async () => {
    const r = await routeIntake("id2", { addresses: [], handles: [{ handle: "@user" }], domains: [], txHashes: [] }, "text");
    expect(r.classification).toBe("kol");
    expect(r.kolsCreated).toBe(1);
  });

  it("rawdoc: nothing", async () => {
    const r = await routeIntake("id3", { addresses: [], handles: [], domains: [], txHashes: [] }, "text");
    expect(r.classification).toBe("rawdoc");
    expect(r.linkedBatchId).toBeUndefined();
  });

  it("mixed low confidence: pendingBatch=true, no batch created", async () => {
    const { prisma } = require("@/lib/prisma");
    (prisma.ingestionBatch.create as jest.Mock).mockClear();
    const r = await routeIntake("id4", { addresses: addr(1), handles: [{ handle: "@user" }], domains: [], txHashes: [] }, "text");
    expect(r.classification).toBe("mixed");
    expect(r.confidence).toBeLessThan(0.8);
    expect(r.pendingBatch).toBe(true);
    expect(prisma.ingestionBatch.create).not.toHaveBeenCalled();
  });

  it("ioc csv high confidence: batch created", async () => {
    const r = await routeIntake("id5", { addresses: addr(50), handles: [], domains: [], txHashes: [] }, "csv");
    expect(r.classification).toBe("ioc");
    expect(r.confidence).toBe(0.9);
    expect(r.linkedBatchId).toBe("batch_1");
  });
});
