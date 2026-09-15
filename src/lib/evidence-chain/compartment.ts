/**
 * L'AUTORITÉ DE COMPARTIMENT GOUVERNÉE — et son refus, qui n'est pas un repli.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « Once a dedicated governed evidence compartment exists, absence of its
 *     configuration must fail closed; a generic storage fallback is not an
 *     admissible persistence authority. »
 *
 * ─── CE QUI SE PASSAIT AVANT ────────────────────────────────────────────────
 *
 * `evidenceR2ConfigFromEnv()` lit `R2_EVIDENCE_BUCKET_NAME || R2_BUCKET_NAME`.
 * Le compartiment dédié `interligens-evidence` EXISTE côté Cloudflare depuis
 * le 2026-09-15 ; la variable, elle, n'est pas provisionnée côté application.
 * Tout retombe donc sur `interligens-reports` — le compartiment des archives
 * de rapports, celui-là même qu'une règle de cycle de vie a vidé en août.
 *
 * Le repli n'échoue pas : il RÉUSSIT, silencieusement, au mauvais endroit.
 * C'est la pire des deux façons de se tromper — une pièce gouvernée naît dans
 * un compartiment que personne n'a désigné pour elle, et rien ne le dit.
 *
 * ─── CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS ─────────────────────────
 *
 * Il REFUSE d'ouvrir un compartiment quand la variable dédiée manque, avec une
 * CAUSE NOMMÉE. Il ne se rabat sur rien. Il n'invente pas de nom par défaut.
 *
 * ⚠️ Il ne touche PAS aux verbes. `putEvidenceObject` et `getEvidenceObject`
 * continuent de ne rien résoudre eux-mêmes : ils honorent le compartiment
 * qu'on leur donne, et ne lisent JAMAIS l'environnement. C'est la garantie
 * posée par le ruling précédent — « key equality across compartments is not
 * object identity » — et un contrôle par verbe la détruirait : deux lectures
 * d'environnement peuvent diverger, une seule résolution ne le peut pas.
 *
 * La porte est donc UNIQUE, et c'est elle qui refuse. Aucun site gouverné ne
 * peut obtenir un compartiment autrement, et un témoin le prouve.
 *
 * ─── LA CAUSE EST PROPRE, ET DISJOINTE ──────────────────────────────────────
 *
 * `CAUSES_REFUS_DE_COMPARTIMENT` ∩ `READBACK_REFUSAL_KINDS` = ∅, et un test le
 * vérifie. « La configuration manque » ne doit jamais se lire « l'objet a
 * disparu » ni « le réseau a refusé » : on ne répare pas une variable
 * d'environnement en allant regarder un bucket.
 */
import type { S3Client } from "@aws-sdk/client-s3";
import { buildEvidenceR2, type EvidenceR2Config } from "./r2";

// ═══════════════════════════════════════════════════════════════════════════
// LES CAUSES DE REFUS. Propres, nommées, disjointes de celles de la relecture.
// ═══════════════════════════════════════════════════════════════════════════

export type CauseDeRefusDeCompartiment =
  /**
   * `R2_EVIDENCE_BUCKET_NAME` absente ou vide. LE refus du ruling : le
   * compartiment dédié existe, sa configuration manque, on ne se rabat pas.
   */
  | "evidence_compartment_unconfigured"
  /**
   * Compte ou credentials R2 manquants. Distinct : ce n'est pas le même
   * geste de réparation, et les confondre ferait chercher la mauvaise variable.
   */
  | "evidence_credentials_unconfigured"
  /**
   * Le compartiment DÉSIGNÉ par l'autorité de localisation n'appartient pas au
   * vocabulaire fermé des compartiments gouvernés.
   *
   * Distincte des deux autres, et ce n'est pas un détail : celles-là disent
   * « la configuration manque » et se réparent dans `.env.local`. Celle-ci dit
   * « une autorité gouvernée nomme un compartiment que nous n'ouvrons pas » —
   * et cela se répare en base, ou pas du tout. Les confondre ferait chercher
   * une variable là où il y a une ligne de registre.
   */
  | "compartiment_hors_vocabulaire_gouverne";

export const CAUSES_REFUS_DE_COMPARTIMENT: readonly CauseDeRefusDeCompartiment[] =
  Object.freeze([
    "evidence_compartment_unconfigured",
    "evidence_credentials_unconfigured",
    "compartiment_hors_vocabulaire_gouverne",
  ]);

// ═══════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE FERMÉ DES COMPARTIMENTS GOUVERNÉS
// ═══════════════════════════════════════════════════════════════════════════
//
//   « A governed compartment may be opened only when governed location
//     authority names it for that specific object. A compartment must never be
//     selected by default, fallback, key convention, object age, or failed
//     lookup. »
//
//   « Storage-location authority SELECTS the compartment; runtime configuration
//     only PROVIDES THE CAPABILITY to access the compartment selected by that
//     authority. Configuration must never become location authority. »
//
// ─── CE QUE CETTE LISTE EST, ET CE QU'ELLE N'EST PAS ────────────────────────
//
// C'est une liste de PERMISSION, jamais de SÉLECTION. Elle dit quels
// compartiments peuvent être ouverts DU TOUT ; elle ne dit JAMAIS lequel ouvrir
// pour une pièce donnée. Ce choix appartient au registre de localisation, et à
// lui seul.
//
// ⛔ ELLE EST EN DUR, ET C'EST LE POINT. Un vocabulaire lu dans
//    l'environnement ne serait pas fermé : il suffirait d'une variable pour
//    élargir ce qui est ouvrable, et la configuration redeviendrait autorité.
//    Même motif que DECLARED_AT_WRITE | VERIFIED_BY_HEAD.
//
// ⛔ `interligens-reports` Y FIGURE, ET CE N'EST PAS UN REPLI. GPT, 2026-09-16 :
//    « Ce que nous autorisons n'est PAS un fallback vers reports. C'est
//      l'exécution d'une autorité de localisation gouvernée. Ici reports n'est
//      pas un secours, c'est LA VALEUR PRODUITE PAR L'AUTORITÉ. »
//    Les 31 événements VERIFIED_BY_HEAD du registre NOMMENT ce compartiment,
//    mesuré par 62 HeadObject. L'ouvrir, c'est exécuter cette autorité — pas
//    se rabattre sur elle.

/** Les compartiments qu'un chemin gouverné peut ouvrir. DEUX, et pas un de plus. */
export const COMPARTIMENTS_GOUVERNES = [
  /** Le compartiment CANONIQUE : là où naissent les pièces de la nouvelle génération. */
  "interligens-evidence",
  /**
   * Le compartiment des archives. Ouvrable UNIQUEMENT sur DÉSIGNATION par le
   * registre de localisation — jamais par défaut, jamais par convention de clé,
   * jamais parce qu'une recherche ailleurs a échoué.
   */
  "interligens-reports",
] as const;
export type CompartimentGouverne = (typeof COMPARTIMENTS_GOUVERNES)[number];

export const estCompartimentGouverne = (v: unknown): v is CompartimentGouverne =>
  typeof v === "string" && (COMPARTIMENTS_GOUVERNES as readonly string[]).includes(v);

export interface CompartimentRefuse {
  readonly ok: false;
  readonly cause: CauseDeRefusDeCompartiment;
  readonly detail: string;
}

export interface CompartimentAccorde {
  readonly ok: true;
  readonly config: EvidenceR2Config;
}

export type ResolutionDeCompartiment = CompartimentAccorde | CompartimentRefuse;

function refuser(cause: CauseDeRefusDeCompartiment, detail: string): CompartimentRefuse {
  return { ok: false, cause, detail };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA RÉSOLUTION. Aucun repli, aucun défaut.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résout LE compartiment de preuves gouverné, ou refuse en le nommant.
 *
 * ⚠️ `R2_BUCKET_NAME` n'apparaît pas dans cette fonction, et c'est le sujet.
 * Un `||` de plus et le ruling est violé sans qu'une seule ligne de test
 * change — c'est pourquoi un témoin vérifie aussi l'ABSENCE de ce nom ici.
 *
 * Le `.trim()` n'est pas cosmétique : une variable provisionnée à la chaîne
 * vide, ou à un espace, vaut ABSENTE. C'est la troisième fois que ce dépôt
 * paie ce mode de panne (cc7d492, 38f10f2, puis le `??` de `r2.ts`) ; ici
 * il produit un refus, pas un compartiment fantôme.
 */
export function resoudreCompartimentGouverne(
  env: Record<string, string | undefined> = process.env,
): ResolutionDeCompartiment {
  const bucket = (env.R2_EVIDENCE_BUCKET_NAME ?? "").trim();
  if (!bucket) {
    return refuser(
      "evidence_compartment_unconfigured",
      "R2_EVIDENCE_BUCKET_NAME n'est pas provisionnée. Le compartiment de preuves gouverné " +
        "existe côté stockage ; sans cette variable, le chemin gouverné REFUSE. Il ne se rabat " +
        "pas sur R2_BUCKET_NAME : un compartiment générique n'est pas une autorité de persistance " +
        "admissible, et une pièce gouvernée ne naît pas dans le compartiment des archives.",
    );
  }

  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (env.R2_EVIDENCE_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.R2_EVIDENCE_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || "").trim();
  const manquants = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_EVIDENCE_ACCESS_KEY_ID|R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_EVIDENCE_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  if (manquants.length > 0) {
    return refuser(
      "evidence_credentials_unconfigured",
      `compartiment « ${bucket} » désigné, mais les credentials manquent : ${manquants.join(", ")}. ` +
        "Le compartiment est connu, l'accès ne l'est pas — ce n'est pas la même réparation.",
    );
  }

  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  return { ok: true, config: { accountId, accessKeyId, secretAccessKey, bucket, endpoint } };
}

export interface CompartimentOuvert {
  readonly ok: true;
  readonly s3: S3Client;
  readonly bucket: string;
}

/**
 * La SEULE porte par laquelle un site gouverné obtient un compartiment.
 *
 * Rend `{ ok: true, s3, bucket }` — la forme exacte que `ingest.ts` attend en
 * `opts.r2` — ou le refus nommé. Aucun appelant gouverné n'a de raison de
 * construire ce couple autrement, et un témoin vérifie qu'aucun ne le fait.
 */
export function ouvrirCompartimentGouverne(
  env: Record<string, string | undefined> = process.env,
): CompartimentOuvert | CompartimentRefuse {
  const r = resoudreCompartimentGouverne(env);
  if (!r.ok) return r;
  return { ok: true, s3: buildEvidenceR2(r.config), bucket: r.config.bucket };
}

// ═══════════════════════════════════════════════════════════════════════════
// L'OUVERTURE SUR DÉSIGNATION — L'AUTORITÉ CHOISIT, LA CONFIGURATION PERMET
// ═══════════════════════════════════════════════════════════════════════════
//
// LA DIFFÉRENCE AVEC `ouvrirCompartimentGouverne`, ET ELLE EST TOUT LE SUJET :
//
//   ouvrirCompartimentGouverne()          « où NAÎT une pièce nouvelle »
//                                         → la configuration NOMME (R2_EVIDENCE_BUCKET_NAME)
//                                         → il n'y a pas encore d'autorité : l'objet n'existe pas
//
//   ouvrirCompartimentDesigne(bucket)     « où VIVENT les octets de CETTE pièce »
//                                         → le REGISTRE nomme, et lui seul
//                                         → la configuration ne fournit que la CAPACITÉ d'accès
//
// ⛔ CETTE FONCTION NE LIT AUCUN NOM DE COMPARTIMENT DANS L'ENVIRONNEMENT.
//    Ni `R2_EVIDENCE_BUCKET_NAME`, ni — surtout — `R2_BUCKET_NAME`. C'est le
//    piège que GPT nomme explicitement : « N'INTRODUISEZ PAS R2_BUCKET_NAME
//    COMME MÉCANISME DE SÉLECTION DE reports. Si l'autorité retourne
//    interligens-reports, l'opener doit résoudre explicitement ce compartiment
//    autorisé. Sinon nous réintroduirions indirectement le fallback que nous
//    venons d'éliminer. » Un témoin vérifie l'ABSENCE de ces deux noms ici.
//
// ⛔ ET ELLE NE CHERCHE NULLE PART AILLEURS. Pas de « essayer evidence, puis
//    reports si absent » : une recherche qui échoue n'est pas une désignation,
//    et ne rien trouver au mauvais endroit n'est pas une mesure d'absence.
//    Le bucket rendu est EXACTEMENT celui reçu, ou c'est un refus.

/**
 * Ouvre le compartiment DÉSIGNÉ par l'autorité de localisation, ou refuse.
 *
 * L'ordre est le contrat :
 *   1. le compartiment désigné appartient-il au vocabulaire FERMÉ ?
 *   2. la configuration fournit-elle la CAPACITÉ d'y accéder ?
 * Aucune troisième étape, et surtout aucune qui choisirait un compartiment.
 */
export function ouvrirCompartimentDesigne(
  compartimentDesigne: string,
  env: Record<string, string | undefined> = process.env,
): CompartimentOuvert | CompartimentRefuse {
  const designe = (compartimentDesigne ?? "").trim();

  // ── 1 · LE VOCABULAIRE FERMÉ. Une autorité peut nommer n'importe quoi ; on
  // n'ouvre que ce que le dépôt reconnaît comme gouverné.
  if (!estCompartimentGouverne(designe)) {
    return refuser(
      "compartiment_hors_vocabulaire_gouverne",
      `le compartiment « ${designe || "(vide)"} » est DÉSIGNÉ par une autorité de localisation, ` +
        `mais il n'appartient pas au vocabulaire fermé des compartiments gouvernés ` +
        `(${COMPARTIMENTS_GOUVERNES.join(", ")}). On n'ouvre pas un compartiment parce qu'une ` +
        "ligne le nomme : le vocabulaire est fermé, et l'élargir est une décision, pas un effet de bord.",
    );
  }

  // ── 2 · LA CAPACITÉ, et rien d'autre. La configuration ne choisit pas le
  // compartiment — elle dit seulement si on sait y accéder.
  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (env.R2_EVIDENCE_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.R2_EVIDENCE_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || "").trim();
  const manquants = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_EVIDENCE_ACCESS_KEY_ID|R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_EVIDENCE_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  if (manquants.length > 0) {
    return refuser(
      "evidence_credentials_unconfigured",
      `compartiment « ${designe} » DÉSIGNÉ et reconnu, mais les credentials manquent : ` +
        `${manquants.join(", ")}. Le compartiment est choisi, l'accès ne l'est pas — ce n'est pas ` +
        "la même réparation, et l'un ne remplace pas l'autre.",
    );
  }

  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  // Le bucket rendu est EXACTEMENT le désigné. Aucune substitution possible :
  // il n'y a pas d'autre valeur dans cette portée.
  return {
    ok: true,
    s3: buildEvidenceR2({ accountId, accessKeyId, secretAccessKey, bucket: designe, endpoint }),
    bucket: designe,
  };
}

/** Le message d'un refus, pour un opérateur ou un journal. */
export function rendreRefusDeCompartiment(r: CompartimentRefuse): string {
  return `REFUS [${r.cause}] — ${r.detail}`;
}
