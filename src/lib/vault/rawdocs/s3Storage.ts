// src/lib/vault/rawdocs/s3Storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import type { RawDocsStorage } from "./storage";
import { env } from "@/lib/config/env";

function getClient() {
  return new S3Client({
    region: env.RAWDOCS_S3_REGION || "auto",
    endpoint: env.RAWDOCS_S3_ENDPOINT,
    credentials: {
      accessKeyId: env.RAWDOCS_S3_ACCESS_KEY,
      secretAccessKey: env.RAWDOCS_S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

export function buildS3Key(batchId: string, sha256: string, ext: string): string {
  return `rawdocs/${batchId}/${sha256}${ext}`;
}

export const s3Storage: RawDocsStorage = {
  async save(buffer, { filename, batchId }) {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = filename.includes(".") ? "." + filename.split(".").pop() : ".bin";
    const key = buildS3Key(batchId, sha256, ext);
    const client = getClient();
    await client.send(new PutObjectCommand({
      Bucket: env.RAWDOCS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/octet-stream",
    }));
    return { storageProvider: "s3", storageKey: key, size: buffer.length, sha256 };
  },
  async read(storageKey) {
    const client = getClient();
    const res = await client.send(new GetObjectCommand({
      Bucket: env.RAWDOCS_S3_BUCKET,
      Key: storageKey,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },
};
