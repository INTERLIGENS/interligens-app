/**
 * Phase 2 — Ingestion. Order: SHA-256 (as-is) → dedup → EvidenceItem → R2 copy
 * → access log. TSA (Phase 3) is attempted but NEVER blocks ingestion.
 * The original file is NEVER modified/cropped/recompressed/annotated.
 *
 * Deux portes d'entrée, même pipeline :
 *   - ingestFile   : chemin filesystem (CLI Host-001 / scripts).
 *   - ingestBuffer : bytes en mémoire (routes serverless — aucun filesystem).
 *
 * Provenance (obligatoire depuis MIGRATION_evidence_provenance_v1.sql) :
 *   - provenanceType + timestampMode requis sur toute NOUVELLE ingestion.
 *   - capturedBy reste obligatoire ; "unattributed" UNIQUEMENT si
 *     provenanceType = THIRD_PARTY_SUBMISSION.
 *   - THIRD_PARTY_SUBMISSION exige submittedBy (identité pseudonyme du soumetteur).
 */
import { statSync } from "fs";
import { basename, extname } from "path";
import type { S3Client } from "@aws-sdk/client-s3";
import { sha256Buffer, sha256File } from "./hash";
import { contentAddressedKey, putEvidenceObject } from "./r2";
import { timestampWithRouting, type TsaRouting, type Criticality } from "./tsa";
import type { EvidenceStore, EvidenceItemRecord, EvidenceSourceType, ProvenanceType, TimestampMode } from "./types";
import { UNATTRIBUTED } from "./types";
import { readFile } from "fs/promises";

interface IngestCommon {
  sourceType: EvidenceSourceType;
  sourceUrl?: string | null;
  casefileId?: string | null;
  capturedAt?: Date | null;
  capturedBy?: string | null;
  captureHost?: string | null;
  captureTool?: string | null;
  captureToolVersion?: string | null;
  mimeType?: string | null;
  notes?: string | null;
  provenanceType: ProvenanceType;
  submittedBy?: string | null;
  timestampMode: TimestampMode;
  /** P0 routes to the commercial primary TSA; anything else uses the fallback. */
  criticality?: Criticality;
}

export interface IngestInput extends IngestCommon {
  filePath: string;
}

export interface IngestBufferInput extends IngestCommon {
  buffer: Buffer;
  /** Nom logique (extension pour la clé R2 content-addressed). Jamais un chemin réel. */
  fileName?: string | null;
}

export interface IngestOptions {
  r2?: { s3: S3Client; bucket: string } | null;
  tsa?: { enabled?: boolean; routing?: TsaRouting; retries?: number } | null;
  actor?: string;
}

export interface IngestResult {
  item: EvidenceItemRecord;
  duplicate: boolean;
  r2Key: string | null;
  /**
   * true quand des octets EXISTAIENT mais n'ont pas pu être archivés faute de
   * config R2 exploitable. À ne pas confondre avec un hash-only délibéré, qui
   * ne passe jamais par ingestBuffer/ingestFile.
   */
  r2Unavailable: boolean;
  /**
   * true quand la config R2 était présente mais que le PUT a levé. La pièce
   * existe, ses octets non — et elle est marquée `[R2:PUT-FAILED]`.
   */
  r2PutFailed: boolean;
  tsa: { attempted: boolean; done: boolean; pending: boolean; provider?: string; tsaUsed?: "primary" | "fallback" };
}

/**
 * Marqueur de tête sur EvidenceItem.notes — mode dégradé BRUYANT.
 *
 * Sans lui, une pièce dont les octets n'ont pas été archivés (R2 mal
 * provisionné) est indiscernable d'un hash-only DÉLIBÉRÉ : dans les deux cas
 * r2Key est NULL. Pour une chaîne de custody c'est le pire mode de
 * défaillance — une preuve sans pièce jointe qui se présente comme complète.
 *
 * Même convention que [TIMESTAMP:RETROACTIVE], déjà lu par le manifeste.
 * Compté séparément par src/scripts/watchdog/watcher-health.mjs.
 */
export const R2_UNAVAILABLE_MARKER = "[R2:UNAVAILABLE]";

/**
 * Marqueur posé quand R2 était CONFIGURÉ mais que le PUT a été REJETÉ.
 *
 * Distinct de `R2_UNAVAILABLE_MARKER`, qui dit « la config manquait ». Le mode
 * dégradé bruyant existant ne couvrait que ce premier cas ; il ne couvrait pas
 * « R2 configuré, PUT rejeté » — et c'est exactement ce qui est arrivé le
 * 2026-08-14. La pièce a été insérée, `putEvidenceObject` a levé, et
 * `insertAccessLog(item.id, "INGEST")` n'a jamais été atteint : ligne en base,
 * sans octets, sans marqueur, et sans la moindre entrée de journal.
 *
 * Deux marqueurs et non un : « la config manquait » et « le stockage a refusé »
 * n'appellent pas la même action. Les confondre ferait chercher une variable
 * d'environnement là où il faut regarder un bucket.
 */
export const R2_PUT_FAILED_MARKER = "[R2:PUT-FAILED]";

function assertProvenance(input: IngestCommon): void {
  // Chaîne de possession : qui a capturé est OBLIGATOIRE. Pas de null silencieux.
  if (!input.capturedBy || !input.capturedBy.trim()) {
    throw new Error("evidence-chain: capturedBy est requis (chaîne de possession) — aucune valeur par défaut, aucun null silencieux.");
  }
  if (input.capturedBy.trim() === UNATTRIBUTED && input.provenanceType !== "THIRD_PARTY_SUBMISSION") {
    throw new Error(`evidence-chain: capturedBy="${UNATTRIBUTED}" n'est autorisé que pour provenanceType=THIRD_PARTY_SUBMISSION.`);
  }
  if (input.provenanceType === "THIRD_PARTY_SUBMISSION" && (!input.submittedBy || !input.submittedBy.trim())) {
    throw new Error("evidence-chain: THIRD_PARTY_SUBMISSION exige submittedBy (identité pseudonyme du soumetteur).");
  }
}

async function ingestCore(
  input: IngestCommon,
  sha256: string,
  byteSize: number,
  loadBody: () => Promise<Buffer>,
  displayName: string,
  filePath: string | null,
  ext: string,
  store: EvidenceStore,
  opts: IngestOptions,
): Promise<IngestResult> {
  assertProvenance(input);
  const actor = opts.actor ?? null;

  // Dedup — signalled, never duplicated.
  const existing = await store.findBySha256(sha256);
  if (existing) {
    await store.insertAccessLog(existing.id, "READ", actor, `duplicate ingest skipped for ${displayName}`);
    return { item: existing, duplicate: true, r2Key: existing.r2Key, r2Unavailable: false, r2PutFailed: false, tsa: { attempted: false, done: !!existing.tsaToken, pending: !existing.tsaToken } };
  }

  // MODE DÉGRADÉ BRUYANT — on arrive ici avec des octets EN MAIN (ingestFile et
  // ingestBuffer en fournissent toujours). Donc `opts.r2` absent ne veut pas
  // dire « pas d'octets à archiver », ça veut dire « octets présents, nulle
  // part où les mettre » : evidenceR2ConfigFromEnv() a renvoyé null, une
  // variable R2 est mal provisionnée. Le hash-only DÉLIBÉRÉ, lui, n'appelle
  // jamais cette fonction — il insère directement via store.insertItem.
  // La détection est donc structurelle, pas déclarative : aucun appelant ne
  // peut oublier de la signaler.
  const r2Unavailable = !opts.r2;
  if (r2Unavailable) {
    console.error(
      `[evidence-chain] R2 INDISPONIBLE — octets NON archivés pour sha256=${sha256} ` +
        `(${byteSize} o, ${displayName}). evidenceR2ConfigFromEnv() a renvoyé null : ` +
        `vérifier R2_ACCOUNT_ID / R2_EVIDENCE_* / R2_*. La pièce est conservée et marquée ` +
        `${R2_UNAVAILABLE_MARKER}.`,
    );
  }

  // EvidenceItem written. Le marqueur est posé À L'INSERTION, jamais par un
  // UPDATE ultérieur : une pièce ne doit pas exister une seule seconde sans
  // dire la vérité sur ses octets.
  const notes = r2Unavailable
    ? `${R2_UNAVAILABLE_MARKER} ${input.notes ?? ""}`.trim()
    : input.notes ?? null;

  const item = await store.insertItem({
    casefileId: input.casefileId ?? null, sha256, filePath, mimeType: input.mimeType ?? null,
    byteSize, sourceType: input.sourceType, sourceUrl: input.sourceUrl ?? null, capturedAt: input.capturedAt ?? null,
    capturedBy: input.capturedBy ?? null, captureHost: input.captureHost ?? null, captureTool: input.captureTool ?? null,
    captureToolVersion: input.captureToolVersion ?? null, notes,
    provenanceType: input.provenanceType, submittedBy: input.submittedBy ?? null, timestampMode: input.timestampMode,
  });

  // Copy to the evidence bucket (content-addressed). Degraded retention: not WORM.
  //
  // ENVELOPPÉ — et c'est le correctif. Sans ce `try`, un PUT qui lève propage
  // l'exception et abandonne la ligne DÉJÀ ÉCRITE : `setR2` n'est pas appelé,
  // `insertAccessLog(item.id, "INGEST")` non plus. La pièce reste en base sans
  // octets, sans marqueur, et sans une seule entrée de journal — invisible aux
  // deux filtres du watchdog, qui ne comptaient que `[R2:UNAVAILABLE]` et
  // `HASH-ONLY`. C'est l'état exact de la pièce cmssyx6se… depuis le 14 août.
  //
  // On n'échoue PAS l'ingestion : la pièce et son empreinte ont une valeur même
  // sans octets. On la rend bruyante, marquée et journalisée — ce qui est le
  // contraire de ce qui se passait.
  let r2Key: string | null = null;
  let r2PutFailed = false;
  let r2PutError: string | null = null;
  if (opts.r2) {
    const key = contentAddressedKey(sha256, ext);
    try {
      const body = await loadBody();
      await putEvidenceObject(opts.r2.s3, opts.r2.bucket, key, body, input.mimeType ?? undefined);
      await store.setR2(item.id, key, false, "degraded:no-object-lock");
      item.r2Key = key;
      r2Key = key;
    } catch (err) {
      r2PutFailed = true;
      r2PutError = err instanceof Error ? err.message : String(err);
      r2Key = null;
      console.error(
        `[evidence-chain] R2 PUT REJETÉ — octets NON archivés pour sha256=${sha256} ` +
          `(${byteSize} o, ${displayName}, clé ${key}) : ${r2PutError}. La pièce est ` +
          `conservée et marquée ${R2_PUT_FAILED_MARKER}.`,
      );
      // Marquage AVANT le journal : si la seconde écriture échoue à son tour,
      // la ligne dit au moins la vérité sur ses octets.
      try {
        await store.markR2Failed(item.id, R2_PUT_FAILED_MARKER, `key=${key} error=${r2PutError}`);
      } catch (markErr) {
        console.error(
          `[evidence-chain] marquage ${R2_PUT_FAILED_MARKER} impossible pour ${item.id} :`,
          markErr instanceof Error ? markErr.message : markErr,
        );
      }
    }
  }

  // Access log (INGEST). Désormais atteint même quand le PUT a levé — c'est ce
  // qui manquait à la pièce orpheline, qui n'a pas même son INGEST.
  await store.insertAccessLog(item.id, "INGEST", actor, `sha256=${sha256} bytes=${byteSize} src=${input.sourceType} provenance=${input.provenanceType} tsmode=${input.timestampMode}`);

  // Journal dédié de l'échec, calqué sur celui de `r2Unavailable` : traçable,
  // requêtable, et impossible à confondre avec une config manquante.
  if (r2PutFailed) {
    await store.insertAccessLog(
      item.id, "INGEST", actor,
      `r2 put failed — bytes NOT archived (R2 configured, PUT rejected); bytes=${byteSize} error=${r2PutError}`,
    );
  }

  // Access log dédié, calqué sur « tsa pending » : traçable, requêtable, et
  // impossible à confondre avec le log d'un hash-only délibéré.
  if (r2Unavailable) {
    await store.insertAccessLog(
      item.id, "INGEST", actor,
      `r2 unavailable — bytes NOT archived (evidenceR2ConfigFromEnv returned null); bytes=${byteSize}`,
    );
  }

  // Phase 3 — timestamp; never blocks ingestion (échec/openssl absent → pending,
  // rattrapé par stamp-pending.ts sur Host-001).
  const tsaEnabled = opts.tsa?.enabled ?? !!opts.tsa;
  const result: IngestResult = { item, duplicate: false, r2Key, r2Unavailable, r2PutFailed, tsa: { attempted: tsaEnabled, done: false, pending: tsaEnabled } };
  if (tsaEnabled) {
    let routed: Awaited<ReturnType<typeof timestampWithRouting>> = null;
    try {
      routed = await timestampWithRouting(sha256, { criticality: input.criticality ?? "OTHER", routing: opts.tsa?.routing, retries: opts.tsa?.retries });
    } catch {
      routed = null; // ex. binaire openssl absent du runtime — la pièce reste, TSA pending.
    }
    if (routed) {
      const { result: ts, tsaUsed } = routed;
      await store.setTsa(item.id, ts.token, ts.provider, ts.genTime, ts.certChainPem);
      item.tsaToken = ts.token; item.tsaProvider = ts.provider; item.tsaTimestampedAt = ts.genTime; item.tsaCertChain = ts.certChainPem;
      await store.insertAccessLog(item.id, "VERIFY", actor, `tsa via ${tsaUsed} (${ts.provider}); cert chain archived`);
      result.tsa = { attempted: true, done: true, pending: false, provider: ts.provider, tsaUsed };
    } else {
      // pending: stamp-pending picks up rows WHERE tsaToken IS NULL.
      await store.insertAccessLog(item.id, "INGEST", actor, "tsa pending (all authorities unreachable)");
    }
  }
  return result;
}

export async function ingestFile(input: IngestInput, store: EvidenceStore, opts: IngestOptions = {}): Promise<IngestResult> {
  // 1. SHA-256 of the file AS-IS (before any transformation).
  const sha256 = await sha256File(input.filePath);
  const byteSize = statSync(input.filePath).size;
  return ingestCore(
    input, sha256, byteSize, () => readFile(input.filePath), basename(input.filePath),
    input.filePath, extname(input.filePath).replace(/^\./, ""), store, opts,
  );
}

export async function ingestBuffer(input: IngestBufferInput, store: EvidenceStore, opts: IngestOptions = {}): Promise<IngestResult> {
  const sha256 = sha256Buffer(input.buffer);
  const name = input.fileName ?? `buffer_${sha256.slice(0, 12)}`;
  return ingestCore(
    input, sha256, input.buffer.length, async () => input.buffer, name,
    null, extname(name).replace(/^\./, ""), store, opts,
  );
}
