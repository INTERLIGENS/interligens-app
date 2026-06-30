/**
 * src/lib/osint/retail/privateVault.ts
 *
 * SPRINT C1 — COFFRE PRIVÉ de l'image originale.
 *
 * Garantie dure : l'original retail (jusqu'à 10 MB) est conservé en PRIVÉ et
 * n'est JAMAIS public. Quand R2 est provisionné (PDF_STORAGE_ENABLED=true +
 * OSINT_RETAIL_R2_BUCKET), on y dépose l'original sous une clé privée et on
 * conserve la référence. Sinon (cas par défaut du gated beta), on NE met pas
 * l'original en base — on conserve uniquement son sha256 et on marque
 * rawImageStored=false (rétention par hash, byte-rétention reportée à C2/R2).
 *
 * Dans tous les cas : l'original ne transite jamais vers une surface publique, et
 * seule la version normalisée (compress.ts) part à la vision.
 */

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, isStorageEnabled } from "@/lib/storage/r2Client";
import type { RetailMediaType } from "./precheck";

export interface VaultResult {
  /** bytes effectivement persistés dans le coffre privé ? */
  stored: boolean;
  /** clé/référence privée dans le coffre, ou null. */
  ref: string | null;
  detail: string;
}

function retailBucket(): string | null {
  return process.env.OSINT_RETAIL_R2_BUCKET ?? null;
}

/** true si le coffre privé peut réellement persister des octets. */
export function isVaultEnabled(): boolean {
  return isStorageEnabled() && !!retailBucket();
}

/**
 * Dépose l'original dans le coffre privé. Ne lève jamais : un échec de stockage
 * dégrade en stored:false (le sha256 reste, lui, conservé par l'appelant).
 * Clé : osint-retail/original/<sha256> — chemin privé, non listé publiquement.
 */
export async function storeOriginalPrivate(
  sha256: string,
  bytes: Buffer,
  mediaType: RetailMediaType,
): Promise<VaultResult> {
  const bucket = retailBucket();
  if (!isStorageEnabled() || !r2Client || !bucket) {
    return { stored: false, ref: null, detail: "private vault disabled (no R2 bucket) — sha256 retained only" };
  }
  const key = `osint-retail/original/${sha256}`;
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: mediaType,
        // Pas d'ACL public : R2 est privé par défaut ; on ne pose aucune lecture publique.
        Metadata: { source: "osint_retail", privacy: "never_public_raw" },
      }),
    );
    return { stored: true, ref: `r2:${bucket}/${key}`, detail: "stored in private vault" };
  } catch (e) {
    console.error("[osint/retail] private vault store failed:", e);
    return { stored: false, ref: null, detail: "vault store error — sha256 retained only" };
  }
}
