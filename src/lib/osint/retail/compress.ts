/**
 * src/lib/osint/retail/compress.ts
 *
 * SPRINT C1 — COMPRESSION SERVEUR de la version vision.
 *
 * Finding prod : Anthropic refuse les images > ~5 MB. L'original (jusqu'à 10 MB)
 * est CONSERVÉ en privé (par hash), JAMAIS écrasé, JAMAIS public. La version
 * envoyée à la vision est une normalisation : côté long <= 2048 px, ré-encodée en
 * WebP (fallback JPEG) à qualité dégressive jusqu'à passer sous la cible (4.5 MB).
 *
 * On renvoie le buffer normalisé + son sha256 propre (distinct de l'original) :
 * c'est CETTE version, et elle seule, qui part à la vision.
 */

import sharp from "sharp";
import { createHash } from "crypto";
import { VISION_TARGET_BYTES, VISION_MAX_LONG_EDGE } from "./retailConfig";
import type { RetailMediaType } from "./precheck";

export interface NormalizedImage {
  buffer: Buffer;
  bytes: number;
  sha256: string;
  mediaType: RetailMediaType;
  width: number | null;
  height: number | null;
  /** trace lisible de la stratégie appliquée (format, qualité finale). */
  strategy: string;
}

const WEBP_QUALITIES = [80, 70, 60, 50, 40];
const JPEG_QUALITIES = [80, 70, 60, 50, 40];

/**
 * Normalise une image pour la vision. `targetBytes` par défaut = VISION_TARGET_BYTES.
 * Si même la qualité la plus basse dépasse la cible (image énorme et bruitée), on
 * renvoie quand même la meilleure tentative (la plus petite) — la cible est un
 * objectif, pas un rejet : l'original, lui, est borné à 10 MB en amont.
 */
export async function normalizeForVision(
  input: Buffer,
  targetBytes: number = VISION_TARGET_BYTES,
): Promise<NormalizedImage> {
  // Respecte l'orientation EXIF puis borne le côté long.
  const base = sharp(input).rotate().resize({
    width: VISION_MAX_LONG_EDGE,
    height: VISION_MAX_LONG_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  let best: { buf: Buffer; media: RetailMediaType; strategy: string } | null = null;

  // 1) WebP qualité dégressive.
  for (const q of WEBP_QUALITIES) {
    const buf = await base.clone().webp({ quality: q }).toBuffer();
    if (!best || buf.length < best.buf.length) best = { buf, media: "image/webp", strategy: `webp q${q}` };
    if (buf.length <= targetBytes) {
      best = { buf, media: "image/webp", strategy: `webp q${q}` };
      break;
    }
  }

  // 2) Si WebP n'a pas atteint la cible, tente JPEG (parfois plus petit sur photo).
  if (best && best.buf.length > targetBytes) {
    for (const q of JPEG_QUALITIES) {
      const buf = await base.clone().jpeg({ quality: q, mozjpeg: true }).toBuffer();
      if (buf.length < best.buf.length) best = { buf, media: "image/jpeg", strategy: `jpeg q${q}` };
      if (buf.length <= targetBytes) {
        best = { buf, media: "image/jpeg", strategy: `jpeg q${q}` };
        break;
      }
    }
  }

  if (!best) {
    // Sécurité : sharp n'a rien produit (ne devrait pas arriver après précheck).
    throw new Error("normalizeForVision: no output produced");
  }

  const meta = await sharp(best.buf).metadata().catch(() => null);
  const sha256 = createHash("sha256").update(best.buf).digest("hex");
  return {
    buffer: best.buf,
    bytes: best.buf.length,
    sha256,
    mediaType: best.media,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
    strategy: best.buf.length <= targetBytes ? best.strategy : `${best.strategy} (over target, best effort)`,
  };
}
