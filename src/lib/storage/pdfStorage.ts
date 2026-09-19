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
import type { LigneDeRegistre } from "./registre/contrat";

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

/**
 * L'ÉTAPE PRÉCISE qui a refusé, quand le code ne suffit pas à la nommer.
 *
 * `CONFIRMATION_ECHOUEE` dit une CONSÉQUENCE — l'opération n'a pas atteint
 * `REGISTERED` — et trois causes distinctes y mènent désormais. Un refus
 * anonyme est indiscernable d'une panne : le code porte l'état laissé
 * derrière, cette étape porte la raison.
 */
export type EtapeDeRefus =
  /** `GetObject` a échoué, ou le corps était illisible. */
  | "RELECTURE_PERSISTEE"
  /** Les octets relus n'ont pas l'empreinte attendue. */
  | "EMPREINTE_PERSISTEE"
  /** L'écriture DB #2 elle-même a échoué. */
  | "ECRITURE_REGISTRE";

/** L'échec d'une écriture d'objet, distinct de l'échec du registre. */
export class ErreurStockageGouverne extends Error {
  constructor(
    /**
     * LE STADE, et il compte. Un échec AVANT le PUT ne laisse aucun objet ;
     * un échec APRÈS en laisse un, dont la clé est connue. Les confondre
     * ferait chercher un orphelin qui n'existe pas, ou n'en chercher aucun
     * alors qu'il y en a un.
     *
     * `CONFIRMATION_ECHOUEE` = L'OPÉRATION N'A PAS ATTEINT `REGISTERED`.
     * L'objet existe, sa clé est connue, la ligne reste `INTENDED` donc
     * réconciliable — c'est vrai des trois causes de `EtapeDeRefus`, et
     * c'est exactement ce que l'appelant doit savoir pour décider. La cause,
     * elle, est dans `etape` et dans le message.
     */
    readonly code: "PUT_ECHOUE" | "STOCKAGE_DESACTIVE" | "CONFIRMATION_ECHOUEE",
    message: string,
    readonly cle: string | null,
    readonly cause?: unknown,
    /** `null` = non déclarée. Jamais devinée. */
    readonly etape: EtapeDeRefus | null = null,
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
 *   3. RELECTURE   — GetObject sur CE MÊME objet, empreinte RECALCULÉE sur
 *                    les octets rendus, comparée à l'attendue ;
 *   4. confirmation— écriture DB #2, état REGISTERED.
 *
 * Ce que chaque interruption laisse :
 *   · échec en 1  → AUCUN objet. D5 : « No registry authority → no governed
 *                   artifact production. » La disponibilité ne gagne pas
 *                   contre l'autorité ;
 *   · échec en 2  → une ligne INTENDED, réconciliée en ABANDONED après T ;
 *   · échec en 3  → une ligne INTENDED PERSISTANTE et un objet dont la clé
 *                   est CONNUE, dont l'intégrité N'EST PAS ÉTABLIE. L'objet
 *                   n'est PAS supprimé : effacer l'écart le rendrait
 *                   indétectable, et un état incomplet doit rester lisible
 *                   par le lifecycle existant ;
 *   · échec en 4  → une ligne INTENDED PERSISTANTE et un objet dont la clé
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

  // ── 1/4 — L'ALLOCATION, AVANT LE MOINDRE OCTET ──────────────────────
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

  // ── 2/4 — LES OCTETS ────────────────────────────────────────────────
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
        // `sha256` corrobore par HeadObject, sans faire sortir un octet ;
        // `registryid` recolle l'objet à sa ligne quand la clé, elle, aurait
        // été altérée.
        //
        // ⚠️ `sha256` EN MÉTADONNÉE NE FAIT PAS AUTORITÉ SUR LE CORPS. Elle
        // vient du même buffer, écrite par la même opération : la comparer au
        // registre compare deux déclarations du MÊME écrivain, et un corps
        // altéré passerait. C'est de la corroboration, pas de la preuve —
        // l'étape 3/4 ci-dessous est la seule qui touche les octets persistés.
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

  // ── 3/4 — LA RELECTURE DES OCTETS PERSISTÉS ─────────────────────────
  //
  // ██  UNE EMPREINTE CALCULÉE PAR L'ÉCRIVAIN N'EST PAS UNE VÉRIFICATION  ██
  // ██  DE L'ÉCRIT.                                                       ██
  //
  // `sha256`, plus haut, est calculée sur le buffer EN MÉMOIRE, avant que le
  // moindre octet n'ait traversé le réseau. Elle dit ce que l'écrivain
  // VOULAIT persister. Elle ne dit rien de ce qui EST persisté — et c'est
  // exactement l'écart qu'une chaîne d'intégrité doit fermer :
  //
  //   LA CHAÎNE DOIT PROUVER CE QUI EST PERSISTÉ, PAS SEULEMENT CE QU'ELLE
  //   AVAIT L'INTENTION DE PERSISTER.
  //
  // L'OBJET EST SÉLECTIONNÉ PAR L'AUTORITÉ DE LOCALISATION, jamais par une
  // convention : `bucket` est celui du PUT, `ligne.cle` est la clé que le
  // REGISTRE a allouée et sous laquelle le PUT a écrit. Aucun repli, aucun
  // autre compartiment, aucune reconstruction de clé, aucune URL publique.
  // Relire ailleurs qu'où l'on a écrit, c'est soit un 404 qui refuserait un
  // objet sain, soit — bien pire — hasher l'objet d'un AUTRE compartiment.
  //
  //   STORAGE LOCATION AUTHORITY SELECTS THE OBJECT.
  //   CONFIG ONLY ENABLES ACCESS.
  let octetsPersistes: Buffer;
  try {
    const relu = await r2Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: ligne.cle })
    );
    const corps = relu.Body as AsyncIterable<Uint8Array> | undefined;
    if (!corps) throw new Error("corps de réponse absent");
    const morceaux: Uint8Array[] = [];
    for await (const morceau of corps) morceaux.push(morceau);
    octetsPersistes = Buffer.concat(morceaux);
  } catch (err) {
    // FAIL CLOSED. L'objet n'est PAS supprimé : effacer l'écart le rendrait
    // indétectable. La ligne reste INTENDED, donc réconciliable.
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[pdfStorage] relecture impossible — intégrité NON établie, ligne INTENDED conservée", {
      cle: ligne.cle,
      registreId: ligne.id,
      reason,
    });
    throw new ErreurStockageGouverne(
      "CONFIRMATION_ECHOUEE",
      `relecture de l'objet persisté impossible (${reason}) — l'intégrité des ` +
        "octets écrits n'est PAS établie, l'enregistrement est refusé",
      ligne.cle,
      err,
      "RELECTURE_PERSISTEE",
    );
  }

  // L'EMPREINTE RECALCULÉE SUR LES OCTETS RENDUS PAR `GetObject`. C'est le
  // seul témoin de cette fonction qui ait touché ce qui est réellement écrit.
  const sha256Persiste = sha256hex(octetsPersistes);
  if (
    sha256Persiste !== sha256 ||
    octetsPersistes.byteLength !== input.buffer.byteLength
  ) {
    console.error("[pdfStorage] empreinte persistée DIVERGENTE — enregistrement refusé", {
      cle: ligne.cle,
      registreId: ligne.id,
      sha256Attendu: sha256,
      sha256Persiste,
      tailleAttendue: input.buffer.byteLength,
      taillePersistee: octetsPersistes.byteLength,
    });
    throw new ErreurStockageGouverne(
      "CONFIRMATION_ECHOUEE",
      `empreinte des octets persistés divergente — attendue ${sha256}, relue ` +
        `${sha256Persiste} (${input.buffer.byteLength} o attendus, ` +
        `${octetsPersistes.byteLength} o relus) ; l'enregistrement est refusé ` +
        "et l'objet est CONSERVÉ, pour que l'écart reste détectable",
      ligne.cle,
      null,
      "EMPREINTE_PERSISTEE",
    );
  }

  // ── 4/4 — LA CONFIRMATION ───────────────────────────────────────────
  //
  // Elle n'est atteinte QUE par le chemin ci-dessus : l'objet a été relu, et
  // son empreinte recalculée concorde. `REGISTERED` cesse donc d'affirmer
  // « on a voulu écrire ceci » pour affirmer « ceci est écrit ».
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
    throw new ErreurStockageGouverne(
      "CONFIRMATION_ECHOUEE",
      reason,
      ligne.cle,
      err,
      "ECRITURE_REGISTRE",
    );
  }

  // La trace de ce qui a été PROUVÉ, et rien de plus. Aucun secret : une clé
  // gouvernée ne porte pas le sujet, et une empreinte n'est pas un jeton.
  console.log("[pdfStorage] artefact gouverné enregistré — intégrité relue", {
    cle: ligne.cle,
    registreId: ligne.id,
    tailleOctets: octetsPersistes.byteLength,
    sha256Attendu: sha256,
    sha256Persiste,
    concordance: true,
  });

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
// CE QUE CE FICHIER NE RÉPARE PAS — ET IL FAUT LE DIRE ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  LEGACY RECONCILIATION DOES NOT ESTABLISH BODY INTEGRITY.             ██
//
// `src/lib/storage/registre/reconciliation.ts` compare `Metadata.sha256` à
// `registre.sha256` — par `HeadObject`, « jamais GetObject », pour ne pas
// faire sortir les octets du compartiment. C'est un arbitrage explicite, pas
// un oubli ; mais les deux valeurs comparées viennent du MÊME buffer, écrites
// par la MÊME opération. Un corps altéré passe. Le réconciliateur établit la
// CORRESPONDANCE d'un objet et de sa ligne, PAS l'intégrité de son corps.
//
// Il vit dans un AUTRE fichier : le rendre probant sort du périmètre d'un
// fichier unique, et l'exception étroite ne s'applique pas. ⇒ BACKLOG, dit.
//
// Cela ne retient rien : l'artefact gouverné neuf ne dépend pas de cette
// réparation. Son intégrité est établie EN LIGNE, à l'écriture, par l'étape
// 3/4 ci-dessus — pas plus tard, et pas par un balayage.
//
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

// ═══════════════════════════════════════════════════════════════════════════
// CC-OFFLINE-305 — LA REMISE DES OCTETS, PAR IDENTITÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  UNE URL SIGNÉE EST UNE CAPACITÉ ÉPHÉMÈRE, PAS UN IDENTIFIANT PRODUIT. ██
//
// `delivrerUrlSignee` rend une CAPACITÉ : quiconque la détient lit l'objet,
// sans repasser par le gate, jusqu'à expiration. La remettre à un navigateur
// la dépose dans la barre d'adresse, dans l'historique, dans un `Referer`, et
// dans tout ce qui journalise côté client. Cette primitive-ci rend les OCTETS,
// et la capacité ne quitte jamais le processus — elle n'est même pas créée.
//
// ─── CE QU'ELLE NE FAIT PAS, ET C'EST LE POINT ────────────────────────────
//
// ⛔ Elle ne REDÉRIVE aucune règle d'éligibilité. Elle APPELLE `deriverEligibilite`,
//    la même autorité que `delivrerUrlSignee` appelle trois fonctions plus haut.
//    Recopier ne serait-ce qu'une condition ferait une SECONDE autorité, et deux
//    autorités divergent — c'est l'Invariant Propagation Failure que
//    `eligibilite.ts` documente en tête de fichier.
//
// ⛔ Elle ne SÉLECTIONNE rien. Elle reçoit une LIGNE DE REGISTRE déjà lue, par
//    identité explicite. Aucun sujet, aucun « dernier », aucun tri, aucune
//    heuristique : l'appelant NOMME l'artefact, ou il n'obtient rien.
//
// ─── POURQUOI UNE LIGNE ET PAS UNE CLÉ ────────────────────────────────────
//
// Prendre une clé obligerait à la reconvertir en ligne — un second aller-retour
// qui pourrait rendre une AUTRE ligne que celle demandée, et l'identité remise
// ne serait plus reliable sans ambiguïté à l'objet lu. La ligne EST l'autorité :
// elle porte le compartiment, la clé, le sceau et la taille. Un seul objet peut
// en découler.
//
//   STORAGE LOCATION AUTHORITY SELECTS THE OBJECT.
//   CONFIG ONLY ENABLES ACCESS.
//
// ─── L'INTÉGRITÉ EST ÉTABLIE À LA REMISE, PAS SUPPOSÉE ────────────────────
//
// `uploadPdf` prouve l'intégrité à l'ÉCRITURE (étape 3/4). Cela ne dit rien de
// ce que le compartiment rend AUJOURD'HUI, des mois plus tard. Les octets sont
// donc recomparés au sceau enregistré AVANT d'être remis, et une divergence
// REFUSE — servir des octets qui ne sont pas ceux qu'on a scellés serait remettre
// un artefact tout en niant ce qui le rend gouverné.

/**
 * Ce qui fait refuser une REMISE, nommément. Domaine FERMÉ, et DISTINCT de
 * `RaisonDeRefus` : celui-ci appartient à l'éligibilité, et l'étendre pour y
 * loger une panne de lecture ferait entrer une cause technique dans un domaine
 * de JUGEMENT. Même séparation que `CauseDeRefusSupersession`.
 */
export type CauseDeRefusRemise =
  /** Le stockage est désactivé — aucune autorité n'est même consultable. */
  | "STOCKAGE_INDISPONIBLE"
  /** L'autorité existante a refusé. `raison` porte SON verdict, mot pour mot. */
  | "NON_DELIVRABLE"
  /** La ligne ne porte pas de sceau : née de l'observation, pas de l'allocation. */
  | "SANS_SCEAU_ENREGISTRE"
  /** Le compartiment n'a pas rendu l'objet. */
  | "OBJET_ILLISIBLE"
  /** Les octets rendus ne sont pas ceux qui ont été scellés. */
  | "OCTETS_DIVERGENTS";

export type Remise =
  | {
      readonly autorisee: true;
      readonly octets: Buffer;
      readonly sha256: string;
      readonly tailleOctets: number;
    }
  | {
      readonly autorisee: false;
      readonly cause: CauseDeRefusRemise;
      /** Présente UNIQUEMENT sous `NON_DELIVRABLE` — c'est le verdict de l'autorité. */
      readonly raison?: RaisonDeRefus;
      readonly explication: string;
    };

const REFUS_REMISE = (
  cause: CauseDeRefusRemise,
  explication: string,
  raison?: RaisonDeRefus,
): Remise => ({ autorisee: false, cause, explication, raison });

/**
 * Remettre les OCTETS d'un artefact gouverné NOMMÉ par sa ligne de registre.
 *
 * L'appelant a déjà résolu l'identité — `lireParIdentifiant` — et c'est la
 * seule façon d'entrer ici. Cette fonction juge, lit, vérifie, et rend des
 * octets ou un refus nommé. Elle n'écrit rien : ni ligne, ni objet, ni trace.
 */
export async function remettreOctetsGouvernes(ligne: LigneDeRegistre): Promise<Remise> {
  if (!isStorageEnabled() || !r2Client) {
    return REFUS_REMISE("STOCKAGE_INDISPONIBLE", "stockage désactivé");
  }

  // ── LE JUGEMENT, PAR L'AUTORITÉ EXISTANTE. Une seule ligne, et c'est voulu.
  const eligibilite = deriverEligibilite(ligne);
  if (!eligibilite.publiable) {
    return REFUS_REMISE("NON_DELIVRABLE", expliquerRefus(eligibilite.raison), eligibilite.raison);
  }

  // Sans sceau, aucune vérification n'est possible, et on n'affirme pas une
  // intégrité qu'on n'a pas établie. Voir `LigneDeRegistre.sha256`.
  if (!ligne.sha256) {
    return REFUS_REMISE(
      "SANS_SCEAU_ENREGISTRE",
      "la ligne ne porte pas d'empreinte : l'intégrité des octets remis ne peut pas être établie",
    );
  }

  let octets: Buffer;
  try {
    const relu = await r2Client.send(
      new GetObjectCommand({ Bucket: ligne.bucket, Key: ligne.cle })
    );
    const corps = relu.Body as AsyncIterable<Uint8Array> | undefined;
    if (!corps) throw new Error("corps de réponse absent");
    const morceaux: Uint8Array[] = [];
    for await (const morceau of corps) morceaux.push(morceau);
    octets = Buffer.concat(morceaux);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[registre] remise impossible — objet illisible", {
      registreId: ligne.id,
      cle: ligne.cle,
      reason,
    });
    return REFUS_REMISE("OBJET_ILLISIBLE", `le compartiment n'a pas rendu l'objet (${reason})`);
  }

  // ── L'INTÉGRITÉ, SUR CE QUI EST RÉELLEMENT RENDU.
  const sha256Relu = sha256hex(octets);
  if (sha256Relu !== ligne.sha256 || octets.byteLength !== ligne.tailleOctets) {
    console.error("[registre] remise refusée — octets divergents du sceau enregistré", {
      registreId: ligne.id,
      sha256Attendu: ligne.sha256,
      sha256Relu,
      tailleAttendue: ligne.tailleOctets,
      tailleRelue: octets.byteLength,
    });
    return REFUS_REMISE(
      "OCTETS_DIVERGENTS",
      "les octets rendus par le compartiment ne correspondent pas au sceau enregistré",
    );
  }

  return {
    autorisee: true,
    octets,
    sha256: sha256Relu,
    tailleOctets: octets.byteLength,
  };
}
