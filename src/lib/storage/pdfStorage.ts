// src/lib/storage/pdfStorage.ts
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, isStorageEnabled } from "./r2Client";
export { isStorageEnabled } from "./r2Client";
import type { PdfUploadInput, PdfUploadResult, StorageEnv } from "./types";
import { envInt } from "@/lib/config/envNumber";
import { allouerIdentite, estDansPerimetreGouverne } from "./registre/identite";
import { allouer, confirmerEnregistrement, lireParCle, ErreurRegistre } from "./registre/registre";
import { deriverEligibilite, expliquerRefus, type RaisonDeRefus } from "./registre/eligibilite";

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

// ═══════════════════════════════════════════════════════════════════════════
// E-RC — L'ÉCRITURE GOUVERNÉE
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  INTENDED → PutObject → REGISTERED.                                   ██
//
// ─── CE QUI A DISPARU, ET POURQUOI ───────────────────────────────────────
//
// `buildPdfKey` n'existe plus. Elle fabriquait
// `…/{lot}-{ms}-{slug}-{hash8}.pdf` — donc le MINT en clair dans un nom de
// fichier qui voyage, et un suffixe DÉRIVÉ des octets sans sel. La clé est
// désormais ALLOUÉE par le registre (`allouerIdentite`). Laisser une
// fabriqueuse de clés exportée à côté d'un allocateur inviterait le prochain
// écrivain à l'appeler : c'est exactement ce que P1 interdit. La capacité de
// RECONNAÎTRE l'ancienne forme, elle, est conservée — dans `lireFormeDeCle`,
// où elle sert à LIRE le passé, pas à écrire l'avenir.
//
// `return null` sur échec a disparu aussi, et c'est le cœur du lot. L'ancien
// chemin attrapait l'erreur, journalisait, rendait `null`, et la route
// basculait en flux direct : un objet pouvait exister en R2 sans que personne
// ne connaisse sa clé, pendant que l'appelant recevait son PDF. Avaler
// l'erreur DEVAIT disparaître du chemin gouverné.

/** L'échec d'une écriture d'objet, distinct de l'échec du registre. */
export class ErreurStockageGouverne extends Error {
  constructor(
    /**
     * LE STADE, et il compte. Un échec AVANT le PUT ne laisse aucun objet ;
     * un échec APRÈS en laisse un, dont la clé est connue. Les confondre
     * ferait chercher un orphelin qui n'existe pas, ou n'en chercher aucun
     * alors qu'il y en a un.
     */
    readonly code: "PUT_ECHOUE" | "STOCKAGE_DESACTIVE" | "CONFIRMATION_ECHOUEE",
    message: string,
    readonly cle: string | null,
    readonly cause?: unknown,
  ) {
    super(`[pdfStorage] ${code}: ${message}`);
    this.name = "ErreurStockageGouverne";
  }
}

/**
 * Écrire un PDF dans le stockage gouverné.
 *
 * L'ORDRE EST LE CONTRAT :
 *   1. allocation  — écriture DB #1, état INTENDED, la clé est réservée ;
 *   2. PutObject   — les octets entrent, sous une identité déjà enregistrée ;
 *   3. confirmation— écriture DB #2, état REGISTERED.
 *
 * Ce que chaque interruption laisse :
 *   · échec en 1  → AUCUN objet. D5 : « No registry authority → no governed
 *                   artifact production. » La disponibilité ne gagne pas
 *                   contre l'autorité ;
 *   · échec en 2  → une ligne INTENDED, réconciliée en ABANDONED après T ;
 *   · échec en 3  → une ligne INTENDED PERSISTANTE et un objet dont la clé
 *                   est CONNUE. On ne retombe jamais dans « objet inconnu ».
 *                   La réconciliation clôt l'opération (PROMOTION_POSSIBLE).
 *
 * Dans les trois cas, l'état intermédiaire est NON PUBLIABLE : `REGISTERED`
 * est le seul état d'où l'éligibilité se dérive positivement.
 *
 * Ne rend JAMAIS `null`. Lève, et la levée est typée.
 */
export async function uploadPdf(input: PdfUploadInput): Promise<PdfUploadResult> {
  if (!isStorageEnabled() || !r2Client) {
    throw new ErreurStockageGouverne(
      "STOCKAGE_DESACTIVE",
      "uploadPdf appelé alors que le stockage est désactivé — l'appelant doit " +
        "tester isStorageEnabled() avant, et ne pas produire d'artefact sinon",
      null,
    );
  }

  // Déjà gardé par `|| ` (NaN est falsy) ; passé à envInt pour l'idiome unique.
  const maxBytes = envInt("PDF_MAX_SIZE_BYTES", 20_971_520);
  if (input.buffer.byteLength > maxBytes) {
    throw new Error(
      `[pdfStorage] PDF exceeds max size (${input.buffer.byteLength} > ${maxBytes})`
    );
  }

  const bucket = getBucketName();
  const sha256 = sha256hex(input.buffer);
  const env = getStorageEnv();
  const ttl = getSignedUrlTtl();

  // ── 1/3 — L'ALLOCATION, AVANT LE MOINDRE OCTET ──────────────────────
  // L'empreinte est calculable ici parce que le buffer est INTÉGRALEMENT en
  // main : l'allocation préalable ne coûte donc aucun aller-retour de plus.
  const identite = allouerIdentite(env, new Date());
  const ligne = await allouer({
    bucket,
    cle: identite.cle,
    identifiant: identite.identifiant,
    natureObjet: input.natureObjet ?? "CASEFILE_RENDER",
    provenance: "GOVERNED_PIPELINE",
    classeDeRetention: input.classeDeRetention ?? "EVIDENTIARY_INDEFINITE",
    sujet: input.subject,
    lot: input.batchId ?? null,
    sha256,
    tailleOctets: input.buffer.byteLength,
    typeContenu: "application/pdf",
    producteur: "pdfStorage.uploadPdf",
  });

  // ── 2/3 — LES OCTETS ────────────────────────────────────────────────
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: ligne.cle,
        Body: input.buffer,
        ContentType: "application/pdf",
        ContentLength: input.buffer.byteLength,
        // Les métadonnées ne portent plus `subject` ni `batchId` : l'identité
        // sémantique vit dans le registre. Une métadonnée revient en en-tête
        // sur chaque GET — donc à quiconque détient l'URL signée — exactement
        // comme la clé. La déplacer de la clé vers la métadonnée n'aurait
        // rien déplacé du tout.
        //
        // Les deux qui restent servent la RÉCONCILIATION, et elle seule :
        // `sha256` permet de vérifier l'intégrité par HeadObject, sans jamais
        // faire sortir un octet ; `registryid` recolle l'objet à sa ligne
        // quand la clé, elle, aurait été altérée.
        //
        // Clés en minuscules à dessein : S3/R2 rend les noms de métadonnées
        // lowercasés à la lecture. `uploadedAt` se relisait `uploadedat` —
        // écrire la forme qu'on relira évite un aller-retour d'étonnement.
        Metadata: { sha256, registryid: ligne.id },
      })
    );
  } catch (err) {
    // La ligne INTENDED RESTE. C'est elle qui rend l'échec réconciliable :
    // sans elle, un PUT à faux négatif (aboutir côté R2, rendre une erreur à
    // l'appelant) laisserait des octets dont personne ne connaîtrait la clé.
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[pdfStorage] PutObject échoué — ligne INTENDED conservée", {
      cle: ligne.cle,
      registreId: ligne.id,
      reason,
    });
    throw new ErreurStockageGouverne("PUT_ECHOUE", reason, ligne.cle, err);
  }

  // ── 3/3 — LA CONFIRMATION ───────────────────────────────────────────
  //
  // L'échec ici est NOMMÉ à part : l'objet EXISTE, et sa clé est celle qui a
  // été allouée. La ligne reste INTENDED, donc réconciliable — le
  // réconciliateur la classera PROMOTION_POSSIBLE dès qu'il vérifiera les
  // octets. C'est le seul chemin par lequel une opération gouvernée
  // interrompue se CLÔT plus tard au lieu de se perdre.
  try {
    await confirmerEnregistrement(ligne.id);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[pdfStorage] confirmation échouée — objet écrit, ligne INTENDED conservée", {
      cle: ligne.cle,
      registreId: ligne.id,
      reason,
    });
    throw new ErreurStockageGouverne("CONFIRMATION_ECHOUEE", reason, ligne.cle, err);
  }

  const signedUrl = await getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: bucket, Key: ligne.cle }),
    { expiresIn: ttl }
  );

  return {
    key: ligne.cle,
    signedUrl,
    sizeBytes: input.buffer.byteLength,
    sha256,
    registreId: ligne.id,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-RC — LE GATE DE DÉLIVRANCE
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  Il vit dans LA PRIMITIVE DE SIGNATURE, pas dans les routes.          ██
//
// Une garde posée dans `/api/pdf/[handle]` ne protège pas la quatrième route,
// celle qui n'est pas encore écrite. Le dépôt a déjà tranché ce point dans
// l'autre sens, et pour la même raison : `src/lib/ops/prodWriteGuard.ts` est
// dans le CODE plutôt que dans la configuration parce qu'« un rescope correct
// dans l'UI Vercel se re-casse en un clic, sans diff, sans revue, sans test ».
//
// ─── PHASE 1 — D3 : `reports/` UNIQUEMENT ────────────────────────────────
//
// Un fail-closed GLOBAL casserait `pointers/` (aucune ligne n'existe) et
// `admin-documents/` le jour de sa pose. Hors périmètre, on PASSE — et on
// COMPTE. Un trou compté est une dette ; un trou non compté est un oubli.
//
// ⚠️ DEUX CHEMINS CONTOURNENT CETTE PRIMITIVE, et il faut le savoir ici
// plutôt que le redécouvrir : `src/lib/vault/r2-vault.ts` et
// `src/app/api/admin/documents/presign/route.ts` appellent `getSignedUrl`
// EN DIRECT. Ils sont hors périmètre de phase 1. Ce sont des dettes E.

export type Delivrance =
  | { readonly autorisee: true; readonly url: string }
  | {
      readonly autorisee: false;
      readonly raison: RaisonDeRefus;
      readonly explication: string;
    };

/**
 * Le compteur de passages hors périmètre.
 *
 * ⚠️ IL EST LOCAL AU PROCESSUS. En serverless, chaque instance a le sien et
 * il meurt avec elle : ce n'est PAS une métrique durable, et le prétendre
 * serait pire que de ne pas compter. La mesure durable du trou est le
 * décompte `HORS_PERIMETRE` du réconciliateur, qui balaye le compartiment
 * entier. Celui-ci sert au témoin différentiel (T3) et à la lecture de logs.
 */
let passagesHorsPerimetre = 0;
export function compteurPassagesHorsPerimetre(): number {
  return passagesHorsPerimetre;
}
export function reinitialiserCompteurPassages(): void {
  passagesHorsPerimetre = 0;
}

async function signer(bucket: string, cle: string): Promise<string> {
  return getSignedUrl(
    r2Client!,
    new GetObjectCommand({ Bucket: bucket, Key: cle }),
    { expiresIn: getSignedUrlTtl() }
  );
}

/**
 * LA primitive de délivrance gouvernée. Rend une décision NOMMÉE — jamais un
 * refus anonyme : un refus sans motif est indiscernable d'une panne.
 */
export async function delivrerUrlSignee(cle: string): Promise<Delivrance> {
  if (!isStorageEnabled() || !r2Client) {
    return {
      autorisee: false,
      raison: "REGISTRE_INDISPONIBLE",
      explication: "stockage désactivé",
    };
  }
  const bucket = getBucketName();

  // Hors périmètre gouverné : on passe, et on compte.
  if (!estDansPerimetreGouverne(cle)) {
    passagesHorsPerimetre += 1;
    console.warn("[registre] passage hors périmètre gouverné", {
      cle,
      cumulProcessus: passagesHorsPerimetre,
    });
    return { autorisee: true, url: await signer(bucket, cle) };
  }

  let ligne: Awaited<ReturnType<typeof lireParCle>>;
  try {
    ligne = await lireParCle(bucket, cle);
  } catch (err) {
    // FAIL-CLOSED. Registre injoignable ⇒ autorité INCONNUE ⇒ refus. Servir
    // « en attendant » ferait de la panne une autorisation.
    const code = err instanceof ErreurRegistre ? err.code : "REGISTRE_INDISPONIBLE";
    console.error("[registre] gate fail-closed — registre injoignable", { cle, code });
    return {
      autorisee: false,
      raison: "REGISTRE_INDISPONIBLE",
      explication: expliquerRefus("REGISTRE_INDISPONIBLE"),
    };
  }

  if (!ligne) {
    return {
      autorisee: false,
      raison: "AUCUNE_LIGNE_DE_REGISTRE",
      explication: expliquerRefus("AUCUNE_LIGNE_DE_REGISTRE"),
    };
  }

  const eligibilite = deriverEligibilite(ligne);
  if (!eligibilite.publiable) {
    return {
      autorisee: false,
      raison: eligibilite.raison,
      explication: expliquerRefus(eligibilite.raison),
    };
  }

  return { autorisee: true, url: await signer(bucket, cle) };
}

/**
 * Forme de compatibilité — `/api/pdf/[handle]/route.ts` est un chemin GELÉ et
 * consomme `string | null`. Elle DÉLÈGUE : le gate s'applique quel que soit
 * l'appelant, et un refus gouverné devient `null` chez ceux qui ne savent pas
 * encore lire un motif.
 *
 * En pratique cette route ne passe que `pointers/…`, donc hors périmètre de
 * phase 1 : elle ne rencontre pas de refus gouverné aujourd'hui. Le jour où
 * `pointers/` entrera au registre (phase 2), son refus s'y afficherait en
 * « Failed to sign PDF URL » — c'est la raison pour laquelle la lease sur
 * cette route est demandée, et pas une raison de sortir le gate d'ici.
 */
export async function getSignedDownloadUrl(cle: string): Promise<string | null> {
  try {
    const d = await delivrerUrlSignee(cle);
    if (d.autorisee) return d.url;
    console.warn("[registre] délivrance refusée", { cle, raison: d.raison });
    return null;
  } catch (err) {
    console.error("[pdfStorage] getSignedDownloadUrl failed", {
      cle,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
