/**
 * src/lib/storage/evidenceStorage.ts
 *
 * Réutilise le r2Client existant — même bucket R2, préfixe "evidence/"
 * Pas de nouveau client, pas de nouvelles credentials.
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client } from "@/lib/storage/r2Client";

const BUCKET = process.env.R2_BUCKET_NAME ?? "interligens-rawdocs";

export const evidenceStorage = {
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!r2Client) throw new Error("R2 storage not configured");
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: { "captured-by": "interligens-evidence-pack" },
      })
    );
  },

  async get(key: string): Promise<Buffer> {
    if (!r2Client) throw new Error("R2 storage not configured");
    const res = await r2Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as any) chunks.push(chunk);
    return Buffer.concat(chunks);
  },

  async exists(key: string): Promise<boolean> {
    if (!r2Client) return false;
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch { return false; }
  },
};
