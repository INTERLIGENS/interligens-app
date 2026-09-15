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
  | "compartiment_hors_vocabulaire_gouverne"
  /**
   * Le compartiment est DÉSIGNÉ et RECONNU, mais la capacité d'y accéder manque
   * — le credential propre à CE compartiment n'est pas provisionné.
   *
   * ⛔ Distincte de tout le reste, et surtout de `evidence_credentials_unconfigured` :
   * celle-là dit « le COMPTE R2 n'est pas configuré » (partagé, tous compartiments) ;
   * celle-ci dit « la fente de CE compartiment est vide ». La réparation n'est
   * pas la même variable, et le credential de l'autre compartiment n'est JAMAIS
   * essayé pour combler.
   */
  | "CAPABILITY_UNAVAILABLE";

export const CAUSES_REFUS_DE_COMPARTIMENT: readonly CauseDeRefusDeCompartiment[] =
  Object.freeze([
    "evidence_compartment_unconfigured",
    "evidence_credentials_unconfigured",
    "compartiment_hors_vocabulaire_gouverne",
    "CAPABILITY_UNAVAILABLE",
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

// ═══════════════════════════════════════════════════════════════════════════
// LA CAPACITÉ EST ELLE-MÊME PORTÉE PAR COMPARTIMENT
// ═══════════════════════════════════════════════════════════════════════════
//
//   « Storage authority selects an object's governed compartment; access
//     capability must be scoped to that compartment and to the minimum
//     operations required. A credential for one governed compartment must never
//     become fallback capability for another. »
//
// ─── CE QUI A ÉTÉ CORRIGÉ, ET POURQUOI C'EST L'INVERSE DE CE QU'ON PROPOSAIT ──
//
// La mesure du 2026-09-16 a montré deux credentials DISJOINTS (principal →
// reports, mesure → evidence), et on en avait conclu qu'il fallait UN credential
// couvrant les deux. GPT a renversé la proposition, et il a raison :
//
//   « Je ne veux pas créer un credential longue durée Read & Write couvrant
//     reports + evidence simplement parce que l'implémentation actuelle résout
//     les credentials AU NIVEAU DU PROCESSUS. Ce serait CORRIGER UNE LIMITATION
//     DE CODE EN AUGMENTANT LE BLAST RADIUS D'UN SECRET. »
//
//   « Le fait mesuré est précisément l'inverse de ce qu'on veut
//     architecturalement : les deux compartiments ont des BESOINS DIFFÉRENTS.
//     Rien dans le vertical slice ne justifie WRITE sur reports. »
//
// La limitation était dans le CODE — `R2_EVIDENCE_* || R2_*`, résolu une fois
// pour tout le processus. C'est le code qui change, pas la portée du secret.
//
// ⛔ PLUS AUCUN `||` ENTRE LES DEUX FENTES. Un credential d'un compartiment ne
//    devient JAMAIS la capacité de secours d'un autre. Si celui du compartiment
//    désigné manque, on REFUSE — on n'essaie pas l'autre.
//
// ⚠️ TABLE EN DUR, comme `COMPARTIMENTS_GOUVERNES`, et pour la même raison :
//    lue dans l'environnement, elle ne serait pas fermée — une variable
//    suffirait à faire pointer un compartiment sur la capacité d'un autre, et
//    le repli reviendrait par la configuration.

/** Ce dont UN compartiment a besoin, et les variables qui le portent. */
export interface CapaciteDeCompartiment {
  /** La variable qui porte l'identifiant. Propre à ce compartiment. */
  readonly variableCle: string;
  /** La variable qui porte le secret. Propre à ce compartiment. */
  readonly variableSecret: string;
  /**
   * Les opérations MINIMALES que ce compartiment exige.
   *
   * ⚠️ DÉCLARATIF, et il faut le dire : ce dépôt ne peut pas vérifier la portée
   * réelle d'un jeton R2 — seul Cloudflare la connaît. Cette valeur énonce ce
   * qui DOIT être provisionné, pour qu'un relecteur voie d'un coup d'œil que
   * `reports` n'exige AUCUNE écriture. Elle ne garde rien à l'exécution, et ne
   * prétend pas le faire.
   */
  readonly operationsMinimales: "READ" | "READ+WRITE";
  /** Pourquoi ce compartiment a ce besoin-là, et pas un autre. */
  readonly motif: string;
}

export const CAPACITES_PAR_COMPARTIMENT: Readonly<Record<CompartimentGouverne, CapaciteDeCompartiment>> =
  Object.freeze({
    "interligens-evidence": Object.freeze({
      variableCle: "R2_EVIDENCE_ACCESS_KEY_ID",
      variableSecret: "R2_EVIDENCE_SECRET_ACCESS_KEY",
      operationsMinimales: "READ+WRITE",
      motif:
        "le compartiment CANONIQUE : les pièces nouvelles y naissent (écriture) et y sont " +
        "relues pour horodatage (lecture).",
    }),
    "interligens-reports": Object.freeze({
      variableCle: "R2_ACCESS_KEY_ID",
      variableSecret: "R2_SECRET_ACCESS_KEY",
      operationsMinimales: "READ",
      motif:
        "le compartiment LEGACY : on y relit les octets que le registre y situe. " +
        "RIEN dans le chemin probatoire n'y écrit — et donc rien ne justifie WRITE.",
    }),
  });

/** Ce qu'il faut pour parler à R2, une fois le compartiment choisi. */
export interface CapaciteResolue {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/**
 * La capacité d'accès à UN compartiment, ou le refus de l'autre.
 *
 * ⛔ Elle ne lit QUE les deux variables de CE compartiment. Aucune autre fente
 *    n'est consultée, ni en repli ni « au cas où » : c'est structurel, pas
 *    conventionnel — les noms viennent de la table, et la table est fermée.
 */
export function capaciteDuCompartiment(
  compartiment: CompartimentGouverne,
  env: Record<string, string | undefined> = process.env,
): CapaciteResolue | CompartimentRefuse {
  const attendu = CAPACITES_PAR_COMPARTIMENT[compartiment];
  const accessKeyId = (env[attendu.variableCle] ?? "").trim();
  const secretAccessKey = (env[attendu.variableSecret] ?? "").trim();
  const manquants = [
    !accessKeyId && attendu.variableCle,
    !secretAccessKey && attendu.variableSecret,
  ].filter(Boolean) as string[];

  if (manquants.length > 0) {
    return refuser(
      "CAPABILITY_UNAVAILABLE",
      `le compartiment « ${compartiment} » est DÉSIGNÉ et reconnu, mais la capacité d'y accéder ` +
        `manque : ${manquants.join(", ")} (requis : ${attendu.operationsMinimales}). ` +
        "⛔ Le credential d'un AUTRE compartiment n'est PAS essayé : une capacité scopée sur un " +
        "compartiment ne devient jamais la capacité de secours d'un autre. " +
        `Motif de ce compartiment : ${attendu.motif}`,
    );
  }
  return { accessKeyId, secretAccessKey };
}

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
  if (!accountId) {
    return refuser(
      "evidence_credentials_unconfigured",
      "R2_ACCOUNT_ID n'est pas provisionnée. C'est une configuration de COMPTE, partagée par " +
        "tous les compartiments — distincte de la capacité d'accès à l'un d'eux.",
    );
  }

  // ── Le compartiment de naissance doit lui aussi appartenir au vocabulaire
  // fermé : une variable ne peut pas faire naître une pièce n'importe où.
  if (!estCompartimentGouverne(bucket)) {
    return refuser(
      "compartiment_hors_vocabulaire_gouverne",
      `R2_EVIDENCE_BUCKET_NAME désigne « ${bucket} », qui n'appartient pas au vocabulaire fermé ` +
        `des compartiments gouvernés (${COMPARTIMENTS_GOUVERNES.join(", ")}).`,
    );
  }

  // ⛔ La capacité vient de la TABLE, jamais d'un repli. Aucune autre fente
  //    n'est consultée si celle de ce compartiment est vide.
  const capacite = capaciteDuCompartiment(bucket, env);
  if ("ok" in capacite) return capacite;

  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  return { ok: true, config: { accountId, ...capacite, bucket, endpoint } };
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
  /**
   * Le constructeur de client, INJECTABLE — et ce n'est pas une commodité de
   * test, c'est ce qui rend la garantie MESURABLE.
   *
   * « le credential de l'autre compartiment n'est jamais essayé » ne se prouve
   * pas par l'absence d'erreur : un refus peut survenir pour dix raisons. Il se
   * prouve en OBSERVANT quel secret est effectivement remis au constructeur —
   * et en constatant qu'il ne l'est pas du tout quand la fente est vide.
   */
  construire: (cfg: EvidenceR2Config) => S3Client = buildEvidenceR2,
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

  // ── 2 · LE COMPTE. Configuration partagée, distincte de la capacité d'accès
  // à un compartiment : ce n'est pas la même variable ni la même réparation.
  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  if (!accountId) {
    return refuser(
      "evidence_credentials_unconfigured",
      `compartiment « ${designe} » DÉSIGNÉ et reconnu, mais R2_ACCOUNT_ID n'est pas provisionnée. ` +
        "C'est une configuration de COMPTE, partagée par tous les compartiments.",
    );
  }

  // ── 3 · LA CAPACITÉ DE CE COMPARTIMENT, et d'AUCUN AUTRE.
  // ⛔ Si elle manque : CAPABILITY_UNAVAILABLE. On n'essaie PAS le credential de
  //    l'autre compartiment — « a credential for one governed compartment must
  //    never become fallback capability for another ».
  const capacite = capaciteDuCompartiment(designe, env);
  if ("ok" in capacite) return capacite;

  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  // Le bucket rendu est EXACTEMENT le désigné. Aucune substitution possible :
  // il n'y a pas d'autre valeur dans cette portée.
  return {
    ok: true,
    s3: construire({ accountId, ...capacite, bucket: designe, endpoint }),
    bucket: designe,
  };
}

/** Le message d'un refus, pour un opérateur ou un journal. */
export function rendreRefusDeCompartiment(r: CompartimentRefuse): string {
  return `REFUS [${r.cause}] — ${r.detail}`;
}
