/**
 * R2 helpers for the Investigators Vault.
 *
 * r2Key is an INTERNAL server identifier. It is never returned to the client
 * in any API response. The client identifies files by fileId; the server
 * resolves fileId → r2Key internally.
 *
 * Env: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / VAULT_R2_BUCKET
 * (The repo already uses R2_ACCOUNT_ID for PDF storage — we reuse that
 * credential set and target a dedicated vault bucket.)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("[vault-r2] R2 credentials missing");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
}

function getBucket(): string {
  const b = process.env.VAULT_R2_BUCKET;
  if (!b) throw new Error("[vault-r2] VAULT_R2_BUCKET not set");
  return b;
}

export function generateR2Key(workspaceId: string, caseId: string): string {
  const rnd = randomBytes(9).toString("base64url");
  return `${workspaceId}/${caseId}/${rnd}-${Date.now()}`;
}

export async function generatePresignedPutUrl(
  r2Key: string,
  mimeType: string
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: r2Key,
      ContentType: mimeType,
    }),
    { expiresIn: 300 }
  );
}

export async function generatePresignedGetUrl(r2Key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: r2Key }),
    { expiresIn: 900 }
  );
}

export async function deleteVaultObject(r2Key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: r2Key })
  );
}
