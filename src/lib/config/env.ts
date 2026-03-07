// src/lib/config/env.ts
export const isProd = process.env.NODE_ENV === "production";

function requireInProd(key: string): void {
  if (isProd && !process.env[key]) {
    throw new Error(`[env] Missing required env var in prod: ${key}`);
  }
}

// Fail-fast guards in prod
if (isProd) {
  requireInProd("DATABASE_URL");
  requireInProd("ADMIN_TOKEN");
  requireInProd("VAULT_AUDIT_SALT");
  requireInProd("ADMIN_BASIC_USER");
  requireInProd("ADMIN_BASIC_PASS");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "",
  ADMIN_BASIC_USER: process.env.ADMIN_BASIC_USER ?? "",
  ADMIN_BASIC_PASS: process.env.ADMIN_BASIC_PASS ?? "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  RAWDOCS_STORAGE: (process.env.RAWDOCS_STORAGE ?? (isProd ? "s3" : "fs")) as "fs" | "s3",
  RAWDOCS_S3_ENDPOINT: process.env.RAWDOCS_S3_ENDPOINT ?? "",
  RAWDOCS_S3_BUCKET: process.env.RAWDOCS_S3_BUCKET ?? "",
  RAWDOCS_S3_ACCESS_KEY: process.env.RAWDOCS_S3_ACCESS_KEY ?? "",
  RAWDOCS_S3_SECRET_KEY: process.env.RAWDOCS_S3_SECRET_KEY ?? "",
  RAWDOCS_S3_REGION: process.env.RAWDOCS_S3_REGION ?? "auto",
  VAULT_AUDIT_SALT: process.env.VAULT_AUDIT_SALT ?? "",
  EXPORT_MAX_ROWS: parseInt(process.env.EXPORT_MAX_ROWS ?? "250000"),
  APPROVE_CHUNK_SIZE: parseInt(process.env.APPROVE_CHUNK_SIZE ?? "5000"),
  SCAN_RATE_LIMIT: parseInt(process.env.SCAN_RATE_LIMIT ?? "60"),
  RATE_WINDOW_MS: parseInt(process.env.RATE_WINDOW_MS ?? "300000"),
} as const;

export function hasRedis(): boolean {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function hasS3(): boolean {
  return !!(env.RAWDOCS_S3_ENDPOINT && env.RAWDOCS_S3_BUCKET && env.RAWDOCS_S3_ACCESS_KEY && env.RAWDOCS_S3_SECRET_KEY);
}
