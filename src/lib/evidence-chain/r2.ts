/**
 * Evidence R2 storage (S3-compatible, Cloudflare R2).
 *
 * ⚠️ RÉTENTION DÉGRADÉE (cf. Phase 0.4, vérifié par appel réel 2026-07-30) :
 * l'object lock R2 est INDISPONIBLE via l'API S3 de ce compte
 * (CreateBucket ObjectLockEnabled → NotImplemented ; GetObjectLock/Versioning →
 * AccessDenied). Ce module N'EST PAS du WORM / immuabilité stricte. La stratégie
 * dégradée : bucket preuves dédié (R2_EVIDENCE_BUCKET_NAME) + clés adressées par
 * contenu (dérivées du hash) + credentials idéalement write-only pour l'ingestion
 * (à provisionner côté dashboard Cloudflare — les creds S3 actuels ont delete).
 * `immutableStored` reste donc false et immutableRef documente le mode.
 */
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface EvidenceR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

/**
 * Read R2 config from env. Dedicated evidence bucket if set, else the shared one.
 *
 * `||` et NON `??` sur les trois replis : une variable provisionnée à la CHAÎNE
 * VIDE vaut ABSENTE, pas valeur. Avec `??`, poser `R2_EVIDENCE_BUCKET_NAME=""`
 * ne retombait pas sur `R2_BUCKET_NAME` — le `!bucket` juste en dessous faisait
 * renvoyer null, et l'archivage R2 des preuves se désactivait SILENCIEUSEMENT :
 * les EvidenceItem continuaient d'être écrits, sans octets, sans erreur. Une
 * faute de frappe au provisionnement suffisait. Troisième instance du même
 * angle mort après cc7d492 et 38f10f2 (Turnstile).
 */
export function evidenceR2ConfigFromEnv(): EvidenceR2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_EVIDENCE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_EVIDENCE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_EVIDENCE_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const endpoint = process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

/**
 * Vrai si la config résoudra sur le bucket DÉDIÉ aux preuves, faux si elle
 * retombera sur les variables génériques.
 *
 * `evidenceR2ConfigFromEnv()` est volontairement tolérante : elle retombe sur
 * R2_BUCKET_NAME / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY pour qu'un
 * déploiement sans bucket dédié continue d'archiver plutôt que de perdre des
 * octets. C'est le bon défaut pour le RUNTIME.
 *
 * Ce n'est pas le bon défaut pour un script d'INGESTION lancé à la main : là,
 * le repli silencieux signifie « j'écris des preuves avec le token
 * tous-compartiments, dans le bucket partagé », c'est-à-dire exactement ce
 * qu'on cherche à ne plus faire — sans qu'aucune ligne ne le signale. Un
 * appelant qui exige le bucket dédié teste donc ce prédicat et s'arrête.
 *
 * Les trois variables sont exigées ENSEMBLE : poser le bucket sans les
 * credentials donnerait le bucket dédié écrit avec le token global, ce qui est
 * le pire des deux mondes (droits larges, et on croit le contraire).
 */
export function usesDedicatedEvidenceBucket(): boolean {
  const set = (v: string | undefined) => v !== undefined && v.trim() !== "";
  return (
    set(process.env.R2_EVIDENCE_BUCKET_NAME) &&
    set(process.env.R2_EVIDENCE_ACCESS_KEY_ID) &&
    set(process.env.R2_EVIDENCE_SECRET_ACCESS_KEY)
  );
}

export function buildEvidenceR2(cfg: EvidenceR2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

/** Content-addressed key: evidence/<aa>/<sha256>[.ext]. Immutable by construction. */
export function contentAddressedKey(sha256: string, ext?: string): string {
  const prefix = process.env.R2_EVIDENCE_PREFIX ?? "evidence";
  const clean = (ext ?? "").replace(/^\.+/, "");
  return `${prefix}/${sha256.slice(0, 2)}/${sha256}${clean ? "." + clean : ""}`;
}

export async function putEvidenceObject(
  s3: S3Client, bucket: string, key: string, body: Buffer, contentType?: string,
): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function evidenceObjectExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Deletion is POSSIBLE in degraded mode (no object lock). Exposed for the honest
 *  Phase-7 test that documents R2 is NOT WORM. */
export async function deleteEvidenceObject(s3: S3Client, bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
