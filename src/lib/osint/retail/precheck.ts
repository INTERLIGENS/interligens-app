/**
 * src/lib/osint/retail/precheck.ts
 *
 * SPRINT C1 — PRÉCHECK image AVANT tout coût vision.
 *
 * Rejette UNIQUEMENT l'inexploitable manifeste (format non supporté, trop petit,
 * vide). Tout le reste passe vers la vision : c'est le PENDING humain qui tranche
 * les cas douteux, pas le précheck. Chaque rejet porte un RejectReason figé (A0).
 *
 * Blur : on calcule un proxy de netteté (variance d'un Laplacien via sharp) et on
 * ne rejette qu'au niveau CATASTROPHIQUE (image quasi-plate). La détection fine de
 * flou reste REPORTÉE (C2) — un seuil agressif rejetterait de vrais screenshots.
 */

import sharp from "sharp";
import { RejectReason } from "../contracts";
import type { RejectReason as RejectReasonT } from "../contracts";
import { MIN_IMAGE_EDGE } from "./retailConfig";

/** Médias acceptés côté retail : PNG / JPG / WebP uniquement (pas de GIF). */
export type RetailMediaType = "image/png" | "image/jpeg" | "image/webp";

export interface PrecheckResult {
  ok: boolean;
  rejectReason: RejectReasonT | null;
  mediaType: RetailMediaType | null;
  width: number | null;
  height: number | null;
  /** proxy de netteté (variance Laplacien) ; null si non calculable. */
  sharpnessVar: number | null;
  detail: string;
}

const SHARP_FORMAT_TO_MEDIA: Record<string, RetailMediaType | undefined> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Seuil CATASTROPHIQUE de variance Laplacien : sous ce niveau l'image est
 * effectivement plate (aucun bord détectable) — flou total ou aplat. Volontairement
 * très bas pour éviter de rejeter un screenshot réel un peu compressé.
 */
const BLUR_CATASTROPHIC_VAR = 1.0;

function reject(reason: RejectReasonT, detail: string): PrecheckResult {
  return { ok: false, rejectReason: reason, mediaType: null, width: null, height: null, sharpnessVar: null, detail };
}

/** Variance Laplacien (proxy netteté). Ne lève jamais : null si indisponible. */
async function laplacianVariance(buf: Buffer): Promise<number | null> {
  try {
    const lap = await sharp(buf)
      .greyscale()
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .raw()
      .toBuffer();
    if (lap.length === 0) return null;
    let sum = 0;
    for (let i = 0; i < lap.length; i++) sum += lap[i];
    const mean = sum / lap.length;
    let varSum = 0;
    for (let i = 0; i < lap.length; i++) {
      const d = lap[i] - mean;
      varSum += d * d;
    }
    return varSum / lap.length;
  } catch {
    return null;
  }
}

/**
 * Précheck d'UNE image (octets bruts). Ne dépend que de sharp — testable sur des
 * buffers d'image réels générés via sharp en test.
 */
export async function precheckImage(buf: Buffer): Promise<PrecheckResult> {
  if (!buf || buf.length === 0) return reject(RejectReason.NO_SIGNAL, "empty buffer");

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return reject(RejectReason.BAD_FORMAT, "unreadable image (sharp could not parse)");
  }

  const media = meta.format ? SHARP_FORMAT_TO_MEDIA[meta.format] : undefined;
  if (!media) {
    return reject(RejectReason.BAD_FORMAT, `unsupported format '${meta.format ?? "unknown"}' (png/jpg/webp only)`);
  }

  const width = meta.width ?? null;
  const height = meta.height ?? null;
  if (!width || !height) {
    return reject(RejectReason.NO_SIGNAL, "no decodable dimensions");
  }
  if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) {
    return reject(RejectReason.TOO_SMALL, `dimensions ${width}x${height} below ${MIN_IMAGE_EDGE}px floor`);
  }

  const sharpnessVar = await laplacianVariance(buf);
  if (sharpnessVar !== null && sharpnessVar < BLUR_CATASTROPHIC_VAR) {
    return {
      ok: false,
      rejectReason: RejectReason.BLUR_CATASTROPHIC,
      mediaType: media,
      width,
      height,
      sharpnessVar,
      detail: `laplacian variance ${sharpnessVar.toFixed(3)} < ${BLUR_CATASTROPHIC_VAR} (flat/blurred)`,
    };
  }

  return {
    ok: true,
    rejectReason: null,
    mediaType: media,
    width,
    height,
    sharpnessVar,
    detail: "precheck passed",
  };
}
