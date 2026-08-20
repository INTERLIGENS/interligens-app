// src/lib/storage/pdfStorage.ts
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, isStorageEnabled } from "./r2Client";
export { isStorageEnabled } from "./r2Client";
import type { PdfUploadInput, PdfUploadResult, StorageEnv } from "./types";
import { envInt } from "@/lib/config/envNumber";

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
  // Déjà gardé par isNaN ; passé à envInt pour une seule idiome dans le repo.
  // Le plafond dur de 3600s reste appliqué après le repli.
  return Math.min(envInt("PDF_SIGNED_URL_TTL_SECONDS", 900), 3600);
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

// ── A2 — LE POINTEUR MUTABLE « DERNIÈRE VERSION » ─────────────────────────
//
// `pointers/{handle}/latest.pdf` vit HORS de `reports/` et de `evidence/` —
// les deux préfixes qu'un Bucket Lock de conservation couvrira (A4). Le point
// est structurel : un verrou prefix-scoped posé sur `reports/` NE DOIT PAS
// atteindre ce pointeur, sinon le second PUT de chaque génération rendrait 403
// (`ObjectLockedByBucketPolicy`) et `/api/pdf/{handle}` servirait à jamais la
// version figée au moment du verrou, sans que rien ne le signale.
//
// Même compartiment que l'archive (`R2_BUCKET_NAME`, privé, AUCUNE URL publique
// activée — `pub-interligens.r2.dev` rend 401, mesuré), donc servi par le même
// mécanisme d'URL signée, sans nouveau credential ni bucket public. Seul le
// préfixe de tête change.
//
// Cette fonction est la SOURCE DE VÉRITÉ de la clé : l'écrivain (engine.ts) et
// le lecteur (/api/pdf/[handle]/route.ts) l'importent tous deux. Un pointeur
// dont l'écrivain et le lecteur divergeraient serait un 404 silencieux en
// production. Le fichier n'est pas gelé, à dessein : les deux gelés en dépendent.
export const POINTER_PREFIX = "pointers";

export function pointerLatestKey(handle: string): string {
  return `${POINTER_PREFIX}/${handle}/latest.pdf`;
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

  // Déjà gardé par `|| ` (NaN est falsy) ; passé à envInt pour l'idiome unique.
  const maxBytes = envInt("PDF_MAX_SIZE_BYTES", 20_971_520);
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
