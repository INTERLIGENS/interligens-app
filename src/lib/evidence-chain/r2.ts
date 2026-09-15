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
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

/**
 * RELIT LES OCTETS. Pas un HEAD : le contenu lui-même, pour que le hash puisse
 * être RECALCULÉ depuis ce qui est réellement persisté.
 *
 * ⚠️ POURQUOI ICI, ET PAS `evidenceStorage.get` QUI EXISTE DÉJÀ.
 * `src/lib/storage/evidenceStorage.ts` a bien un `get`, et il a été examiné
 * avant d'écrire celui-ci. Il n'est PAS réutilisable sur le chemin de la
 * chaîne de preuve : il lit `R2_BUCKET_NAME` (défaut codé en dur
 * « interligens-rawdocs ») via son propre `r2Client`, et n'a AUCUNE
 * connaissance de `R2_EVIDENCE_BUCKET_NAME`. Les octets d'une pièce sont
 * écrits par `putEvidenceObject`, dont le bucket vient de
 * `evidenceR2ConfigFromEnv()`. Relire ailleurs que là où l'on a écrit, c'est
 * soit un 404 qui refuserait une pièce saine, soit — bien pire — lire à la
 * même clé un objet d'un AUTRE compartiment et recalculer son hash.
 *
 * Une relecture d'intégrité doit viser le MÊME compartiment que l'écriture,
 * résolu par la MÊME fonction. C'est la seule raison d'être de ce Get.
 *
 * Mesuré le 2026-09-15 : `R2_EVIDENCE_BUCKET_NAME` n'est pas provisionné, donc
 * les deux chemins retombent AUJOURD'HUI sur le même `interligens-reports` et
 * la confusion ne se verrait pas. Elle se verrait le jour où le compartiment
 * de preuves dédié serait posé — c'est-à-dire trop tard.
 */
export async function getEvidenceObject(s3: S3Client, bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body as AsyncIterable<Uint8Array> | undefined;
  if (!body) throw new Error(`GetObject ${key}: corps de réponse absent`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
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
