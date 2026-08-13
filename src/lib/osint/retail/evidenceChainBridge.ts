/**
 * src/lib/osint/retail/evidenceChainBridge.ts
 *
 * Pont flux retail → chaîne de preuve (CC-OFFLINE-56).
 *
 * La pièce (EvidenceItem) est créée DÈS LA RÉCEPTION des bytes acceptés, AVANT
 * tout traitement vision : la preuve existe à la réception, pas au traitement.
 * Un échec vision ultérieur n'a donc aucun effet sur la pièce.
 *
 * Provenance : THIRD_PARTY_SUBMISSION — capturedBy="unattributed" (seul cas
 * autorisé), submittedBy=ipHash du soumetteur, timestampMode="at-ingestion"
 * (la TSA prouve la réception, jamais la capture ; capturedAt reste null).
 *
 * TSA : jamais dans la requête publique par défaut (latence + openssl non
 * garanti en serverless). La pièce reste tsaToken NULL et est rattrapée par
 * src/scripts/evidence-chain/stamp-pending.ts (launchd quotidien Host-001).
 * Opt-in runtime via EVIDENCE_TSA_INROUTE="true".
 *
 * JAMAIS bloquant pour la soumission : toute erreur est loggée et absorbée —
 * l'original reste récupérable via le coffre privé + la ligne OsintSubmission
 * (imageSha256), une réconciliation peut re-chaîner a posteriori.
 */
import { prisma } from "@/lib/prisma";
import { ingestBuffer, type IngestResult } from "@/lib/evidence-chain/ingest";
import { PrismaEvidenceStore } from "@/lib/evidence-chain/store/prisma";
import { evidenceR2ConfigFromEnv, buildEvidenceR2 } from "@/lib/evidence-chain/r2";
import { UNATTRIBUTED } from "@/lib/evidence-chain/types";

export interface RetailChainInput {
  buffer: Buffer;
  mimeType: string;
  ipHash: string;
  batchId: string;
  imageIndex: number;
  tweetUrl: string | null;
  vaultRef: string | null;
}

export interface RetailChainOutcome {
  ok: boolean;
  evidenceItemId: string | null;
  sha256: string | null;
  duplicate: boolean;
  tsaPending: boolean;
  error: string | null;
}

const extByMime: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
};

export async function chainRetailEvidence(input: RetailChainInput): Promise<RetailChainOutcome> {
  try {
    const store = new PrismaEvidenceStore(prisma);
    const cfg = evidenceR2ConfigFromEnv();
    const r2 = cfg ? { s3: buildEvidenceR2(cfg), bucket: cfg.bucket } : null;
    const tsaInRoute = process.env.EVIDENCE_TSA_INROUTE === "true";

    const res: IngestResult = await ingestBuffer(
      {
        buffer: input.buffer,
        fileName: `retail_${input.batchId}_${input.imageIndex}.${extByMime[input.mimeType] ?? "bin"}`,
        mimeType: input.mimeType,
        sourceType: input.tweetUrl ? "X_POST" : "OTHER",
        sourceUrl: input.tweetUrl,
        capturedAt: null, // inconnue — jamais inventée
        capturedBy: UNATTRIBUTED,
        captureTool: "osint-retail-submit",
        captureToolVersion: "v1",
        provenanceType: "THIRD_PARTY_SUBMISSION",
        submittedBy: input.ipHash,
        timestampMode: "at-ingestion",
        notes: `retail submission batch=${input.batchId} idx=${input.imageIndex}` +
          (input.vaultRef ? `; original en coffre privé (${input.vaultRef})` : ""),
        criticality: "OTHER",
      },
      store,
      { r2, tsa: tsaInRoute ? { enabled: true, retries: 0 } : null, actor: `retail:${input.ipHash.slice(0, 12)}` },
    );

    return {
      ok: true, evidenceItemId: res.item.id, sha256: res.item.sha256,
      duplicate: res.duplicate, tsaPending: !res.item.tsaToken, error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[evidence-chain retail] échec chaînage (soumission NON bloquée):", msg);
    return { ok: false, evidenceItemId: null, sha256: null, duplicate: false, tsaPending: true, error: msg };
  }
}
