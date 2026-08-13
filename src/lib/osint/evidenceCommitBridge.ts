/**
 * src/lib/osint/evidenceCommitBridge.ts
 *
 * Pont flux opérateur (Vision Ingest V1 commit) → chaîne de preuve (CC-OFFLINE-56).
 *
 * ORDRE STRICT (décision David) : le sha256 recalculé serveur de CHAQUE image
 * fournie DOIT matcher le plan AVANT toute création (EvidenceItem, copie R2, et
 * même les écritures shadow du commit). Mismatch OU image inconnue du plan =
 * rejet explicite de TOUT le commit — aucune pièce créée.
 *
 * Provenance : FIRST_PARTY_CAPTURE (capture opérateur), timestampMode
 * "at-ingestion" (la TSA prouve la réception serveur ; capturedAt du plan reste
 * déclaratif). Fallback si bytes absents : enregistrement hash-only (pas de R2,
 * documenté en notes) — la pièce existe quand même.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { ingestBuffer } from "@/lib/evidence-chain/ingest";
import { PrismaEvidenceStore } from "@/lib/evidence-chain/store/prisma";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "@/lib/evidence-chain/r2";
import type { EvidenceSourceType } from "@/lib/evidence-chain/types";

export interface CommitEvidenceRef {
  sha256: string;
  localFilePath: string;
  sessionId: string;
  capturedAt?: string | null;
  sourceUrl?: string | null;
  snapshotType: string;
}

export interface ImageValidationReport {
  ok: boolean;
  /** sha annoncé → sha recalculé, pour chaque image fournie qui ne matche pas. */
  mismatches: Array<{ claimed: string; actual: string }>;
  /** Images fournies dont le sha annoncé ne correspond à aucune évidence du plan. */
  unknown: string[];
}

/** Décode base64 brut ou data:-URL. */
export function decodeImageB64(b64: string): Buffer {
  const m = b64.match(/^data:[^;]+;base64,(.*)$/s);
  return Buffer.from(m ? m[1] : b64, "base64");
}

/**
 * Validation PRÉALABLE — pure, aucune écriture. À appeler avant tout write du
 * commit. `imagesBase64` est une map { shaAnnoncé → base64 }.
 */
export function validateCommitImages(
  evidences: Array<{ sha256: string }>,
  imagesBase64: Record<string, string>,
): ImageValidationReport {
  const planShas = new Set(evidences.map((e) => e.sha256));
  const mismatches: Array<{ claimed: string; actual: string }> = [];
  const unknown: string[] = [];
  for (const [claimed, b64] of Object.entries(imagesBase64)) {
    if (!planShas.has(claimed)) { unknown.push(claimed); continue; }
    const actual = createHash("sha256").update(decodeImageB64(b64)).digest("hex");
    if (actual !== claimed) mismatches.push({ claimed, actual });
  }
  return { ok: mismatches.length === 0 && unknown.length === 0, mismatches, unknown };
}

function sourceTypeOf(snapshotType: string): EvidenceSourceType {
  const s = snapshotType.toLowerCase();
  if (/x_search|x_profile|x_trending|tweet|x_post/.test(s)) return "X_POST";
  if (s.includes("document")) return "WEB_PAGE";
  return "OTHER";
}

export interface ChainOperatorResult {
  sha256: string;
  mode: "bytes" | "hash-only" | "duplicate" | "failed";
  evidenceItemId: string | null;
  tsaPending: boolean;
  error: string | null;
}

/**
 * Chaîne UNE évidence du plan, après validation. Bytes présents → pipeline
 * complet (dedup, R2, TSA opt-in) ; absents → hash-only. Lien MANUAL vers
 * l'EvidenceSnapshot de même sha256 (idempotent). N'échoue jamais le commit :
 * l'erreur est rapportée par pièce.
 */
export async function chainOperatorEvidence(
  e: CommitEvidenceRef,
  imageB64: string | null,
  capturedBy: string,
): Promise<ChainOperatorResult> {
  const store = new PrismaEvidenceStore(prisma);
  try {
    let itemId: string;
    let mode: ChainOperatorResult["mode"];
    let tsaPending = true;

    if (imageB64 !== null) {
      const cfg = evidenceR2ConfigFromEnv();
      const r2 = cfg ? { s3: buildEvidenceR2(cfg), bucket: cfg.bucket } : null;
      const tsaInRoute = process.env.EVIDENCE_TSA_INROUTE === "true";
      const res = await ingestBuffer(
        {
          buffer: decodeImageB64(imageB64),
          fileName: e.localFilePath.split("/").pop() ?? null,
          sourceType: sourceTypeOf(e.snapshotType),
          sourceUrl: e.sourceUrl ?? null,
          capturedAt: e.capturedAt ? new Date(e.capturedAt) : null,
          capturedBy,
          captureTool: "osint-vision-commit",
          captureToolVersion: "v1",
          provenanceType: "FIRST_PARTY_CAPTURE",
          timestampMode: "at-ingestion",
          notes: `vision-ingest commit session=${e.sessionId}; fichier opérateur: ${e.localFilePath}; capturedAt déclarative`,
          criticality: "OTHER",
        },
        store,
        { r2, tsa: tsaInRoute ? { enabled: true, retries: 0 } : null, actor: capturedBy },
      );
      itemId = res.item.id;
      mode = res.duplicate ? "duplicate" : "bytes";
      tsaPending = !res.item.tsaToken;
    } else {
      const existing = await store.findBySha256(e.sha256);
      if (existing) {
        itemId = existing.id;
        mode = "duplicate";
        tsaPending = !existing.tsaToken;
      } else {
        const item = await store.insertItem({
          sha256: e.sha256,
          sourceType: sourceTypeOf(e.snapshotType),
          sourceUrl: e.sourceUrl ?? null,
          capturedAt: e.capturedAt ? new Date(e.capturedAt) : null,
          capturedBy,
          captureTool: "osint-vision-commit",
          captureToolVersion: "v1",
          provenanceType: "FIRST_PARTY_CAPTURE",
          timestampMode: "at-ingestion",
          notes: `vision-ingest commit session=${e.sessionId}; HASH-ONLY (bytes non transmis) — fichier opérateur: ${e.localFilePath}; capturedAt déclarative`,
        });
        await store.insertAccessLog(item.id, "INGEST", capturedBy,
          `hash-only sha256=${e.sha256} src=${sourceTypeOf(e.snapshotType)} provenance=FIRST_PARTY_CAPTURE tsmode=at-ingestion`);
        itemId = item.id;
        mode = "hash-only";
      }
    }

    // Lien MANUAL vers le snapshot de même sha256 (idempotent, best-effort).
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EvidenceLink" ("id","evidenceItemId","linkType","externalId","externalUrl","corroborationLevel","createdAt")
         SELECT gen_random_uuid()::text, $1, 'MANUAL', es."id", NULL, 'NONE', now()
           FROM "EvidenceSnapshot" es
          WHERE es."sha256" = $2
            AND NOT EXISTS (
              SELECT 1 FROM "EvidenceLink" el
               WHERE el."evidenceItemId" = $1 AND el."linkType" = 'MANUAL' AND el."externalId" = es."id")`,
        itemId,
        e.sha256,
      );
    } catch (err) {
      console.error("[evidenceCommitBridge] lien MANUAL non créé (non bloquant):", err instanceof Error ? err.message : err);
    }

    return { sha256: e.sha256, mode, evidenceItemId: itemId, tsaPending, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[evidenceCommitBridge] échec chaînage:", msg);
    return { sha256: e.sha256, mode: "failed", evidenceItemId: null, tsaPending: true, error: msg };
  }
}
