// src/lib/storage/pdfStorage.ts
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, isStorageEnabled } from "./r2Client";
export { isStorageEnabled } from "./r2Client";
import type { PdfUploadInput, PdfUploadResult, StorageEnv } from "./types";

function getStorageEnv(): StorageEnv {
  const v = process.env.VERCEL_ENV;
  if (v === "production") return "production";
  if (v === "preview") return "preview";
  return "development";
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("[pdfStorage] R2_BUCKET_NAME is not set");
  return bucket;
}

function getSignedUrlTtl(): number {
  const parsed = parseInt(process.env.PDF_SIGNED_URL_TTL_SECONDS ?? "900", 10);
  return isNaN(parsed) ? 900 : Math.min(parsed, 3600);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function sha256hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function buildPdfKey(input: PdfUploadInput, sha256: string): string {
  const env = getStorageEnv();
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const timestamp = now.getTime().toString();
  const slug = slugify(input.subject);
  const batchPrefix = input.batchId ? `${slugify(input.batchId)}-` : "report-";
  const hash8 = sha256.slice(0, 8);
  return `reports/${env}/${yyyy}/${mm}/${batchPrefix}${timestamp}-${slug}-${hash8}.pdf`;
}

export async function uploadPdf(
  input: PdfUploadInput
): Promise<PdfUploadResult | null> {
  if (!isStorageEnabled() || !r2Client) return null;

  const maxBytes =
    parseInt(process.env.PDF_MAX_SIZE_BYTES ?? "20971520", 10) || 20_971_520;
  if (input.buffer.byteLength > maxBytes) {
    throw new Error(
      `[pdfStorage] PDF exceeds max size (${input.buffer.byteLength} > ${maxBytes})`
    );
  }

  const bucket = getBucketName();
  const sha256 = sha256hex(input.buffer);
  const key = buildPdfKey(input, sha256);
  const ttl = getSignedUrlTtl();

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.buffer,
        ContentType: "application/pdf",
        ContentLength: input.buffer.byteLength,
        Metadata: {
          subject: input.subject,
          sha256,
          env: getStorageEnv(),
          uploadedAt: new Date().toISOString(),
          ...(input.batchId ? { batchId: input.batchId } : {}),
        },
      })
    );

    const signedUrl = await getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttl }
    );

    return { key, signedUrl, sizeBytes: input.buffer.byteLength, sha256 };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[pdfStorage] Upload failed", { key, reason });
    return null;
  }
}

export async function getSignedDownloadUrl(
  key: string
): Promise<string | null> {
  if (!isStorageEnabled() || !r2Client) return null;
  try {
    const bucket = getBucketName();
    const ttl = getSignedUrlTtl();
    return await getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttl }
    );
  } catch (err) {
    console.error("[pdfStorage] getSignedDownloadUrl failed", {
      key,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
