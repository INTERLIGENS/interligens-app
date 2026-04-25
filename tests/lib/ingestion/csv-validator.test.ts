// tests/lib/ingestion/csv-validator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma to avoid DB calls in unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

import { validateArkhamCsv } from "@/lib/ingestion/csv-validator";

const VALID_HEADER = "txHash,walletAddress,chain,eventDate,amountUsd,kolHandle,tokenSymbol\n";

describe("validateArkhamCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Single valid row with header
  it("parses a single valid row", async () => {
    const csv = VALID_HEADER + "abc123def456,9xGJz,SOL,2024-01-15,1500.50,GordonGekko,SOL";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].txHash).toBe("abc123def456");
    expect(result.valid[0].amountUsd).toBe(1500.5);
    expect(result.valid[0].kolHandle).toBe("GordonGekko");
    expect(result.errors).toHaveLength(0);
    expect(result.duplicates).toBe(0);
  });

  // 2. Multiple valid rows
  it("parses multiple valid rows", async () => {
    const csv =
      VALID_HEADER +
      "hash001,wallet1,SOL,2024-02-01,200,handle1,SOL\n" +
      "hash002,wallet2,ETH,2024-02-02,300,handle2,ETH\n" +
      "hash003,wallet3,SOL,2024-02-03,400,handle3,USDC\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  // 3. Empty lines skipped silently
  it("skips empty lines silently", async () => {
    const csv = VALID_HEADER + "\n\nhash001,wallet1,SOL,2024-01-01,100,,\n\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  // 4. Missing txHash → error
  it("rejects row with missing txHash", async () => {
    const csv = VALID_HEADER + ",wallet1,SOL,2024-01-01,100,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/txHash/i);
  });

  // 5. Non-parseable amountUsd → error
  it("rejects row with invalid amountUsd", async () => {
    const csv = VALID_HEADER + "hash001,wallet1,SOL,2024-01-01,not_a_number,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].reason).toMatch(/amountUsd/i);
  });

  // 6. Zero amountUsd → error (must be > 0)
  it("rejects row with zero amountUsd", async () => {
    const csv = VALID_HEADER + "hash001,wallet1,SOL,2024-01-01,0,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].reason).toMatch(/amountUsd/i);
  });

  // 7. Invalid date → error
  it("rejects row with invalid date", async () => {
    const csv = VALID_HEADER + "hash001,wallet1,SOL,not-a-date,500,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].reason).toMatch(/date/i);
  });

  // 8. Duplicate txHash in DB → counted as duplicate, not error
  it("counts DB duplicates without adding to errors", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ txHash: "hash_dup" }]);
    const csv = VALID_HEADER + "hash_dup,wallet1,SOL,2024-01-01,500,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.duplicates).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  // 9. Within-file duplicate txHash → counted as duplicate
  it("deduplicates within-file repeated txHash", async () => {
    const csv =
      VALID_HEADER +
      "same_hash,wallet1,SOL,2024-01-01,100,,\n" +
      "same_hash,wallet2,SOL,2024-01-02,200,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  // 10. Mixed: some valid, some invalid, some duplicate
  it("handles mixed rows correctly", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ txHash: "known_dup" }]);
    const csv =
      VALID_HEADER +
      "good001,wallet1,SOL,2024-01-01,100,,\n" +  // valid
      ",wallet2,SOL,2024-01-02,200,,\n" +           // missing txHash → error
      "good002,wallet3,SOL,2024-01-03,not_num,,\n" + // bad amount → error
      "known_dup,wallet4,SOL,2024-01-04,300,,\n" +   // DB duplicate
      "good003,wallet5,SOL,2024-01-05,400,,\n";      // valid
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.duplicates).toBe(1);
  });

  // 11. $ sign and commas in amount handled
  it("strips currency formatting from amountUsd", async () => {
    const csv = VALID_HEADER + "hash001,wallet1,SOL,2024-01-01,\"$1,500.00\",,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].amountUsd).toBe(1500);
  });

  // 12. Empty file → error
  it("returns error for empty file", async () => {
    const result = await validateArkhamCsv("   \n\n  ");
    expect(result.valid).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // 13. Preview is populated
  it("populates preview string", async () => {
    const csv = VALID_HEADER + "hash001,wallet1,SOL,2024-01-01,500,,\n";
    const result = await validateArkhamCsv(csv);
    expect(result.preview).toContain("Valid rows");
    expect(result.preview).toContain("1");
  });
});
