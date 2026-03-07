// src/lib/vault/rawdocs/s3Storage.ts
import crypto from "crypto";
import type { RawDocsStorage, StorageResult } from "./storage";
import { env } from "@/lib/config/env";

function hmacSha256(key: Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(Buffer.from("AWS4" + secretKey), date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

export function buildS3Key(batchId: string, sha256: string, ext: string): string {
  return `rawdocs/${batchId}/${sha256}${ext}`;
}

export const s3Storage: RawDocsStorage = {
  async save(buffer, { filename, batchId }) {
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = filename.includes(".") ? "." + filename.split(".").pop() : ".bin";
    const key = buildS3Key(batchId, sha256, ext);

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const region = env.RAWDOCS_S3_REGION;
    const bucket = env.RAWDOCS_S3_BUCKET;
    const endpoint = env.RAWDOCS_S3_ENDPOINT.replace(/\/$/, "");
    const url = `${endpoint}/${bucket}/${key}`;
    const payloadHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const headers: Record<string, string> = {
      "content-type": "application/octet-stream",
      "host": new URL(endpoint).host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(k => `${k}:${headers[k]}`).join("\n") + "\n";
    const signedHeaders = sortedHeaders.join(";");
    const canonicalRequest = ["PUT", `/${bucket}/${key}`, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credScope = `${dateStamp}/${region}/s3/aws4_request`;
    const strToSign = ["AWS4-HMAC-SHA256", amzDate, credScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const sigKey = getSigningKey(env.RAWDOCS_S3_SECRET_KEY, dateStamp, region, "s3");
    const sig = crypto.createHmac("sha256", sigKey).update(strToSign).digest("hex");
    const authHeader = `AWS4-HMAC-SHA256 Credential=${env.RAWDOCS_S3_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: { ...headers, Authorization: authHeader },
      body: buffer as unknown as BodyInit,
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);

    return { storageProvider: "s3", storageKey: key, size: buffer.length, sha256 };
  },
  async read(storageKey) {
    const endpoint = env.RAWDOCS_S3_ENDPOINT.replace(/\/$/, "");
    const url = `${endpoint}/${env.RAWDOCS_S3_BUCKET}/${storageKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`S3 read failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
};
