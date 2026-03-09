// src/lib/storage/r2Client.ts
import { S3Client } from "@aws-sdk/client-s3";

function buildR2Client(): S3Client | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    PDF_STORAGE_ENABLED,
  } = process.env;

  if (PDF_STORAGE_ENABLED !== "true") return null;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.warn(
      "[r2Client] PDF_STORAGE_ENABLED=true but R2 credentials missing — storage disabled"
    );
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export const r2Client: S3Client | null = buildR2Client();

export function isStorageEnabled(): boolean {
  return r2Client !== null;
}
