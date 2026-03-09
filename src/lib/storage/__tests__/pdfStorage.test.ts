// src/lib/storage/__tests__/pdfStorage.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// On importe uniquement buildPdfKey qui ne dépend pas de modules externes
import { buildPdfKey } from "../pdfStorage";

describe("buildPdfKey", () => {
  const FIXED_DATE = new Date("2026-03-09T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.VERCEL_ENV;
  });

  it("produit la bonne structure de clé", () => {
    const key = buildPdfKey(
      { buffer: Buffer.from("x"), subject: "So111111111" },
      "ab12cd34ef56gh78"
    );
    expect(key).toMatch(
      /^reports\/production\/2026\/03\/report-\d+-so111111111-ab12cd34\.pdf$/
    );
  });

  it("inclut le batchId en prefix", () => {
    const key = buildPdfKey(
      { buffer: Buffer.from("x"), subject: "0xABCDEF", batchId: "CaseFile-BOTIFY" },
      "deadbeef00112233"
    );
    expect(key).toMatch(/^reports\/production\/2026\/03\/casefile-botify-/);
  });

  it("slugifie le subject — supprime les caractères spéciaux", () => {
    const key = buildPdfKey(
      { buffer: Buffer.from("x"), subject: "0xABCD!@#$%EFG" },
      "aabb"
    );
    expect(key).not.toMatch(/[!@#$%]/);
  });

  it("tronque le slug à 64 chars max", () => {
    const long = "a".repeat(200);
    const key = buildPdfKey({ buffer: Buffer.from("x"), subject: long }, "cc");
    const filename = key.split("/").pop()!;
    expect(filename.length).toBeLessThan(150);
  });

  it("utilise les 8 premiers chars du sha256", () => {
    const sha = "1234567890abcdef";
    const key = buildPdfKey({ buffer: Buffer.from("x"), subject: "test" }, sha);
    expect(key).toContain("12345678");
    expect(key).not.toContain("1234567890");
  });

  it("map VERCEL_ENV=preview → segment preview", () => {
    process.env.VERCEL_ENV = "preview";
    const key = buildPdfKey({ buffer: Buffer.from("x"), subject: "abc" }, "aabbccdd");
    expect(key).toMatch(/^reports\/preview\//);
  });

  it("map VERCEL_ENV absent → segment development", () => {
    delete process.env.VERCEL_ENV;
    const key = buildPdfKey({ buffer: Buffer.from("x"), subject: "abc" }, "aabbccdd");
    expect(key).toMatch(/^reports\/development\//);
  });
});

describe("isStorageEnabled", () => {
  it("retourne false quand PDF_STORAGE_ENABLED est absent", async () => {
    delete process.env.PDF_STORAGE_ENABLED;
    // Re-import pour capter l'env au moment de l'évaluation du module
    vi.resetModules();
    const { isStorageEnabled } = await import("../r2Client");
    expect(isStorageEnabled()).toBe(false);
  });

  it("retourne false quand PDF_STORAGE_ENABLED=false", async () => {
    process.env.PDF_STORAGE_ENABLED = "false";
    vi.resetModules();
    const { isStorageEnabled } = await import("../r2Client");
    expect(isStorageEnabled()).toBe(false);
    delete process.env.PDF_STORAGE_ENABLED;
  });
});

describe("uploadPdf — guard taille", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.PDF_STORAGE_ENABLED;
    delete process.env.PDF_MAX_SIZE_BYTES;
    delete process.env.R2_BUCKET_NAME;
  });

  it("throw quand buffer > PDF_MAX_SIZE_BYTES", async () => {
    process.env.PDF_STORAGE_ENABLED = "true";
    process.env.PDF_MAX_SIZE_BYTES = "10";
    process.env.R2_BUCKET_NAME = "test-bucket";

    vi.resetModules();
    vi.doMock("../r2Client", () => ({
      r2Client: { send: vi.fn() },
      isStorageEnabled: () => true,
    }));
    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: vi.fn(),
    }));

    const { uploadPdf } = await import("../pdfStorage");
    await expect(
      uploadPdf({ buffer: Buffer.alloc(100), subject: "test" })
    ).rejects.toThrow(/exceeds max size/);
  });
});

describe("uploadPdf — fallback null si R2 échoue", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.PDF_STORAGE_ENABLED;
    delete process.env.R2_BUCKET_NAME;
  });

  it("retourne null (pas throw) quand S3.send() rejette", async () => {
    process.env.PDF_STORAGE_ENABLED = "true";
    process.env.R2_BUCKET_NAME = "test-bucket";

    vi.resetModules();
    vi.doMock("../r2Client", () => ({
      r2Client: { send: vi.fn().mockRejectedValue(new Error("R2 down")) },
      isStorageEnabled: () => true,
    }));
    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: vi.fn(),
    }));

    const { uploadPdf } = await import("../pdfStorage");
    const result = await uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" });
    expect(result).toBeNull();
  });
});
