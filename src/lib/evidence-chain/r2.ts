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
 *
 * ─── ET L'ADRESSAGE PAR CONTENU N'EST PAS UNE PROTECTION (2026-09-15) ───────
 *
 *   INVARIANT 2 — « Content addressing prevents accidental naming divergence;
 *     it does not by itself prevent overwrite or authorize adoption of
 *     preexisting bytes. »
 *
 * Il a longtemps été présenté ici comme « immutable by construction ». C'est
 * faux, et de deux façons distinctes : une clé dérivée du hash n'empêche pas
 * d'ÉCRASER ce qui s'y trouve, et elle n'autorise pas davantage à ADOPTER des
 * octets préexistants comme preuve — il leur manquerait l'autorité de naissance
 * et d'ingestion gouvernée. Le premier défaut est fermé par l'écriture
 * conditionnelle atomique plus bas ; le second ne se ferme pas par du code, il
 * se ferme en ne prétendant pas le contraire.
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
 * ═══════════════════════════════════════════════════════════════════════════
 * LEGACY_REPORTS_STORAGE_AUTHORITY — LES TROIS SCRIPTS SONT ÉPINGLÉS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Ils ne doivent jamais changer de bucket parce qu'une variable destinée au
 *     nouveau pipeline apparaît. »
 *
 * ─── CE QUE FAISAIT `evidenceR2ConfigFromEnv`, ET POURQUOI ELLE N'EXISTE PLUS ─
 *
 * Elle résolvait `R2_EVIDENCE_* || R2_*` — TROIS `||`, un par fente. Ses trois
 * seuls appelants sont les scripts LEGACY (`backfill-evidence`,
 * `migrate-snapshots`, `recover-snapshots-d`), dont la source historique est
 * `interligens-reports` et rien d'autre. Le jour où `R2_EVIDENCE_BUCKET_NAME`
 * est provisionnée — c'est fait depuis le 2026-09-16 — ces trois scripts
 * changeaient de compartiment SANS QU'UNE SEULE LIGNE DE LEUR CODE BOUGE : ils
 * seraient allés chercher des objets historiques dans le compartiment
 * canonique, ne les auraient pas trouvés, et « ne rien trouver au mauvais
 * endroit » se serait lu « objet absent ».
 *
 * La cible n'est donc plus dérivée d'une variable : elle est ÉPINGLÉE. Une
 * variable destinée au pipeline de naissance ne peut plus déplacer une lecture
 * d'archive, et un témoin le prouve en faisant varier `R2_EVIDENCE_BUCKET_NAME`
 * sans effet observable sur la cible.
 *
 * ⛔ PLUS AUCUN `||` ENTRE LES FENTES. Les credentials lus sont ceux de
 *    `interligens-reports` (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`), qui
 *    est le compartiment ÉPINGLÉ — pas « ceux qu'on trouve ».
 *
 * ⚠️ READ, ET SEULEMENT READ. La capacité rendue ici ne devient JAMAIS candidate
 *    à une NAISSANCE : `CAPACITES_PAR_COMPARTIMENT["interligens-reports"]`
 *    déclare `READ`, et le chemin de PUT l'exige à l'exécution
 *    (cf. `naissance.ts`). C'est l'INVARIANT 1 — un compartiment legacy reste
 *    LISIBLE sans devenir une destination valide pour une pièce nouvelle.
 */
export const LEGACY_REPORTS_STORAGE_AUTHORITY = "interligens-reports" as const;

/**
 * La configuration legacy, avec sa cible dans le TYPE et pas seulement dans la
 * valeur. Un `string` laisserait un appelant croire que la cible peut varier —
 * elle ne le peut pas, et le compilateur doit le dire aussi.
 */
export interface LegacyReportsR2Config extends EvidenceR2Config {
  readonly bucket: typeof LEGACY_REPORTS_STORAGE_AUTHORITY;
}

/**
 * La configuration R2 des TROIS SCRIPTS LEGACY. Cible épinglée, jamais dérivée.
 *
 * Rend `null` si le COMPTE ou la capacité `reports` manquent — jamais un repli
 * sur une autre fente : une capacité absente est un refus, pas une invitation à
 * essayer le credential du voisin.
 */
export function legacyReportsR2ConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): LegacyReportsR2Config | null {
  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY ?? "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  // ⛔ `bucket` ne vient d'AUCUNE variable. C'est tout le correctif.
  return { accountId, accessKeyId, secretAccessKey, bucket: LEGACY_REPORTS_STORAGE_AUTHORITY, endpoint };
}

export function buildEvidenceR2(cfg: EvidenceR2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

/**
 * Content-addressed key: evidence/<aa>/<sha256>[.ext].
 *
 * ⛔ PAS « immutable by construction » — c'était écrit ici, et c'était faux.
 *    Cf. INVARIANT 2 en tête de fichier : la clé empêche une DIVERGENCE DE
 *    NOMMAGE accidentelle, elle n'empêche ni l'écrasement ni l'adoption.
 */
export function contentAddressedKey(sha256: string, ext?: string): string {
  const prefix = process.env.R2_EVIDENCE_PREFIX ?? "evidence";
  const clean = (ext ?? "").replace(/^\.+/, "");
  return `${prefix}/${sha256.slice(0, 2)}/${sha256}${clean ? "." + clean : ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ÉCRITURE CONDITIONNELLE ATOMIQUE — « create if absent », et rien d'autre
// ═══════════════════════════════════════════════════════════════════════════
//
//   INVARIANT 2 — Content addressing prevents accidental naming divergence; it
//   does not by itself prevent overwrite or authorize adoption of preexisting
//   bytes.
//
// ─── POURQUOI PAS `HEAD → absent → PUT` ─────────────────────────────────────
//
// Parce que ce n'est PAS une garantie : entre le HEAD et le PUT il y a une
// fenêtre, et un écrivain concurrent l'occupe. Une garantie fabriquée avec un
// pré-HEAD se présenterait comme atomique tout en ne l'étant pas — c'est pire
// que pas de garantie du tout. Il n'y a AUCUN HeadObject sur ce chemin.
//
// ─── CE SUR QUOI L'ATOMICITÉ S'APPUIE (mesuré le 2026-09-15) ────────────────
//
//   1. `@aws-sdk/client-s3` 3.1004.0 (celui de ce dépôt) —
//      `PutObjectRequest.IfNoneMatch`, models_0.d.ts:14105 :
//        « Uploads the object only if the object key name does not already
//          exist in the bucket specified. Otherwise, Amazon S3 returns a
//          412 Precondition Failed error. […] Expects the '*' (asterisk)
//          character. »
//   2. Cloudflare R2, https://developers.cloudflare.com/r2/api/s3/api/ —
//      PutObject : « ✅ Conditional Operations: ✅ If-Match
//      ✅ If-Modified-Since ✅ If-None-Match ✅ If-Unmodified-Since ».
//   3. Cloudflare R2 release notes (2022-05-27) —
//      « If conditional headers are provided to S3 API UploadObject or
//        CreateMultipartUpload operations, and the object exists, a
//        412 Precondition Failed status code will be returned if these checks
//        are not met. »
//
// La condition est évaluée CÔTÉ SERVEUR, dans la même opération que l'écriture.
// C'est ce qui la rend atomique, et c'est la seule raison pour laquelle ce
// chemin est admissible.
//
// ⚠️ CE QUE LA DOCUMENTATION N'ÉTABLIT PAS : qu'un R2 qui IGNORERAIT l'en-tête
//    se signalerait. Un serveur qui l'ignore écrase en rendant 200. C'est
//    pourquoi la sonde de capacité l'OBSERVE réellement (PUT, puis second PUT
//    conditionnel sur la MÊME clé de sonde, 412 attendu) : la documentation
//    dit ce qui doit arriver, la sonde dit ce qui arrive.
//
// ⛔ IL N'Y A PLUS DE VERBE D'ÉCRITURE INCONDITIONNEL DANS CE MODULE. Le
//    supprimer est le correctif : tant qu'il existait, « ne pas écraser » était
//    une CONVENTION D'APPEL, et une convention d'appel s'oublie.

/** Le résultat d'une écriture conditionnelle. EXPLICITE dans les deux sens. */
export type EcritureConditionnelle =
  | { readonly ok: true; readonly etag: string | null }
  | {
      readonly ok: false;
      /**
       * La clé était DÉJÀ OCCUPÉE. Ce n'est ni un succès, ni une erreur de
       * transport : c'est un CONSTAT, et il ne dit RIEN des octets présents.
       *
       * ⚠️ INVARIANT 2 : même si les octets sous cette clé étaient identiques —
       * ce qu'une clé adressée par contenu rend probable — ils ne sont PAS
       * réutilisables comme preuve. Il leur manquerait l'autorité de naissance
       * et d'ingestion gouvernée. Une clé occupée n'autorise aucune ADOPTION.
       */
      readonly cause: "OBJECT_ALREADY_EXISTS";
      readonly detail: string;
    };

/** 412 / PreconditionFailed — et rien d'autre ne se lit « déjà présent ». */
function estPreconditionEchouee(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  if (e.$metadata?.httpStatusCode === 412) return true;
  return e.name === "PreconditionFailed";
}

/**
 * Écrit les octets SI ET SEULEMENT SI la clé est libre. Atomique, côté serveur.
 *
 * ⛔ Ne résout RIEN : ni compartiment, ni capacité, ni environnement. Il honore
 *    le bucket qu'on lui donne — c'est la garantie « key equality across
 *    compartments is not object identity », et un contrôle par verbe la
 *    détruirait. L'EXIGENCE de capacité WRITE est en amont (`naissance.ts`).
 *
 * Toute autre erreur (403, réseau, 409 ConditionalRequestConflict) est PROPAGÉE :
 * un conflit concurrent n'est pas un constat de présence, et le confondre avec
 * `OBJECT_ALREADY_EXISTS` inventerait un fait.
 */
export async function putEvidenceObjectIfAbsent(
  s3: S3Client, bucket: string, key: string, body: Buffer, contentType?: string,
): Promise<EcritureConditionnelle> {
  try {
    const res = await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: body, ContentType: contentType,
      // ── LA CONDITION. Évaluée par le serveur, dans la même opération.
      IfNoneMatch: "*",
    }));
    return { ok: true, etag: res.ETag ?? null };
  } catch (err) {
    if (estPreconditionEchouee(err)) {
      return {
        ok: false,
        cause: "OBJECT_ALREADY_EXISTS",
        detail:
          `la clé « ${key} » est déjà occupée dans « ${bucket} » : l'écriture conditionnelle a été ` +
          "REFUSÉE par le stockage (412), aucun octet n'a été écrasé. ⚠️ Les octets présents ne sont " +
          "PAS adoptables comme preuve : l'adressage par contenu empêche une divergence de nommage, " +
          "il n'établit ni l'autorité de naissance ni l'ingestion gouvernée de ce qui est là.",
      };
    }
    throw err;
  }
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
 * connaissance de `R2_EVIDENCE_BUCKET_NAME`. Relire ailleurs que là où l'on a
 * écrit, c'est soit un 404 qui refuserait une pièce saine, soit — bien pire —
 * lire à la même clé un objet d'un AUTRE compartiment et recalculer son hash.
 *
 * Une relecture d'intégrité doit viser le compartiment que l'AUTORITÉ DE
 * LOCALISATION nomme pour cette pièce — c'est `storageResolution.ts` qui le
 * rend, et le lecteur vient AVEC le nom. C'est la seule raison d'être de ce Get.
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
