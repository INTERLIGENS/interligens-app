// ─── E-RC · LE CONTRAT DU REGISTRE D'OBJETS GOUVERNÉS ─────────────────────
//
// ██  Un artefact n'est pas publiable parce que ses octets EXISTENT.      ██
// ██  Il l'est parce qu'une AUTORITÉ ENREGISTRÉE le fonde.                ██
//
// ─── CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS ─────────────────────────
//
// C'est le CONTRAT : les six faces d'un objet gouverné, chacune à domaine
// FERMÉ. Ce n'est pas un schéma de base — la table le porte, elle ne le
// définit pas. Une septième valeur ne s'invente pas sur un site d'appel :
// elle vient se déclarer ici, donc devant quelqu'un.
//
// ─── POURQUOI SIX FACES ET PAS UNE COLONNE « statut » ────────────────────
//
// Parce que quatre questions différentes se posent au même objet, et qu'une
// colonne unique les confondrait :
//
//   ce qu'il EST          → natureObjet
//   d'où il VIENT         → provenance
//   où en est l'OPÉRATION → etatDAutorite      (un fait de PROCESSUS)
//   ce qu'on a DÉCIDÉ     → etatDInvalidation  (un JUGEMENT)
//   combien de temps      → classeDeRetention
//   comment on le NOMME   → identité de stockage (voir ./identite.ts)
//
// `etatDAutorite` et `etatDInvalidation` sont séparés à dessein. Un artefact
// peut être parfaitement ENREGISTRÉ et néanmoins invalidé ; il peut être
// factuellement exact et invalidé pour défaut d'AUTORITÉ. C'est exactement le
// cas du témoin « avant » : 169 014 octets, sujet wSOL, aucun dossier
// gouverné. Ce qu'on lui retire n'est pas sa véracité, c'est son autorité.
//
// ─── CE QUI N'EST PAS UNE FACE : L'ÉLIGIBILITÉ ───────────────────────────
//
// L'éligibilité à publication n'est PAS stockée. Elle se DÉRIVE (./eligibilite.ts).
// Une colonne d'éligibilité serait une seconde source de vérité pour une
// propriété qui en a déjà une, et le dépôt a déjà payé cette faute une fois :
// `evidenceDepth`, deux sites de lecture avec `?? 0`, l'unique ligne `deep`
// du dépôt (ZachXBT, 17,8 M$ de pertes retail) rabattue sur `none`, verdict
// public affiché « SIGNAL ». On ne la repose pas sur la propriété qui décide
// ce qu'un cabinet ouvre.

/** La nature SÉMANTIQUE de l'objet. Posée à l'allocation, jamais modifiée. */
export type NatureObjet =
  | "CASEFILE_RENDER"
  | "KOL_REPORT_ARCHIVE"
  /**
   * MUTABLE PAR CONCEPTION — `pointers/{handle}/latest.pdf` est réécrit à
   * chaque génération. Le confondre avec une archive ferait promettre une
   * immuabilité que le second PutObject de `engine.ts` dément à chaque tirage.
   */
  | "KOL_REPORT_POINTER"
  | "EVIDENCE_CAPTURE"
  | "ADMIN_DOCUMENT"
  | "LEGACY_UNCLASSIFIED";

/**
 * D'OÙ l'objet vient. N'affirme RIEN sur la première main du contenu — cette
 * notion existe déjà, ailleurs et mieux : `EvidenceItem.provenanceType`.
 */
export type Provenance =
  | "GOVERNED_PIPELINE"
  | "CLIENT_PRESIGNED_UPLOAD"
  | "SEED"
  | "MIGRATED_BACKFILL"
  /**
   * Réservé à la réconciliation R2→DB. C'est la valeur du témoin « avant » et
   * celle des objets antérieurs à la borne legacy.
   *
   * Ce n'est PAS une valeur honteuse : c'est l'enregistrement honnête de ce
   * qu'on ne peut pas établir. Lui substituer une valeur plus flatteuse —
   * `SEED`, `GOVERNED_PIPELINE` — fabriquerait une provenance.
   */
  | "UNKNOWN_PREEXISTING";

/**
 * OÙ EN EST L'OPÉRATION. Un fait de processus, jamais un jugement.
 *
 * `INVALIDATED` n'est délibérément PAS ici : l'invalidation est un jugement,
 * elle vit sur sa propre face. Une valeur `INVALIDATED` dans les deux
 * domaines serait la duplication de vérité que tout ce module refuse.
 */
export type EtatDAutorite =
  /** Clé réservée, aucun octet attendu. Écrit AVANT le PutObject. */
  | "INTENDED"
  /**
   * Objet présent, intégrité NON vérifiable — métadonnée `sha256` absente.
   * Écrit par la seule réconciliation. Non publiable : « présent » n'est pas
   * « vérifié ».
   */
  | "STORED_UNCONFIRMED"
  /** Le SEUL état d'où l'éligibilité peut être dérivée positivement. */
  | "REGISTERED"
  /** Intention sans objet, échéance dépassée. Non destructif : rien n'est supprimé. */
  | "ABANDONED"
  /** Objet sous périmètre gouverné, aucune ligne. L'état du témoin « avant ». */
  | "ORPHAN_CONFIRMED"
  /**
   * Population définie par une RÈGLE reproductible (voir ./identite.ts), pas
   * par une liste de clés.
   *
   * ⚠️ BORNE D'HONNÊTETÉ — cet état ne conclut RIEN sur le passé. Il ne dit
   * pas « ils ont toujours été gouvernés », ni « ils ont été gouvernés puis
   * délaissés ». Il dit : non enregistrés, et qualifiés comme tels.
   */
  | "LEGACY_UNREGISTERED";

/** LE JUGEMENT. Écrit par un humain ou une procédure nommée, jamais par un flux. */
export type EtatDInvalidation =
  | "NONE"
  | "INVALID_AUTHORITY"
  | "SUPERSEDED"
  | "WITHDRAWN_BY_DECISION";

/**
 * La DÉCISION de conservation. N'affirme pas qu'un mécanisme l'applique :
 * aucun n'existe (0/1136 objets avec échéance, aucune règle de cycle de vie
 * en vigueur). Voir DOCTRINE.RETENTION_EST_UN_PROCESSUS.
 */
export type ClasseDeRetention =
  | "EVIDENTIARY_INDEFINITE"
  | "OPERATIONAL_ROLLING"
  | "UNCLASSIFIED_LEGACY";

// ─── LES DOMAINES, EN VALEURS ────────────────────────────────────────────
//
// Les états reviennent de SQL en `string`. Sans garde de domaine, une valeur
// inconnue — écrite par une future version, ou par une main — traverserait la
// dérivation d'éligibilité en se faisant passer pour connue. Les gardes
// ci-dessous sont ce qui rend le fail-closed possible : on ne peut pas
// refuser ce qu'on n'a pas su ne pas reconnaître.

export const NATURES_OBJET = [
  "CASEFILE_RENDER", "KOL_REPORT_ARCHIVE", "KOL_REPORT_POINTER",
  "EVIDENCE_CAPTURE", "ADMIN_DOCUMENT", "LEGACY_UNCLASSIFIED",
] as const satisfies readonly NatureObjet[];

export const PROVENANCES = [
  "GOVERNED_PIPELINE", "CLIENT_PRESIGNED_UPLOAD", "SEED",
  "MIGRATED_BACKFILL", "UNKNOWN_PREEXISTING",
] as const satisfies readonly Provenance[];

export const ETATS_AUTORITE = [
  "INTENDED", "STORED_UNCONFIRMED", "REGISTERED",
  "ABANDONED", "ORPHAN_CONFIRMED", "LEGACY_UNREGISTERED",
] as const satisfies readonly EtatDAutorite[];

export const ETATS_INVALIDATION = [
  "NONE", "INVALID_AUTHORITY", "SUPERSEDED", "WITHDRAWN_BY_DECISION",
] as const satisfies readonly EtatDInvalidation[];

export const CLASSES_RETENTION = [
  "EVIDENTIARY_INDEFINITE", "OPERATIONAL_ROLLING", "UNCLASSIFIED_LEGACY",
] as const satisfies readonly ClasseDeRetention[];

export function estNatureObjet(v: unknown): v is NatureObjet {
  return typeof v === "string" && (NATURES_OBJET as readonly string[]).includes(v);
}
export function estProvenance(v: unknown): v is Provenance {
  return typeof v === "string" && (PROVENANCES as readonly string[]).includes(v);
}
export function estEtatDAutorite(v: unknown): v is EtatDAutorite {
  return typeof v === "string" && (ETATS_AUTORITE as readonly string[]).includes(v);
}
export function estEtatDInvalidation(v: unknown): v is EtatDInvalidation {
  return typeof v === "string" && (ETATS_INVALIDATION as readonly string[]).includes(v);
}
export function estClasseDeRetention(v: unknown): v is ClasseDeRetention {
  return typeof v === "string" && (CLASSES_RETENTION as readonly string[]).includes(v);
}

/** Les six faces d'un objet gouverné, telles que l'éligibilité les lit. */
export interface FacesDAutorite {
  readonly natureObjet: NatureObjet;
  readonly provenance: Provenance;
  readonly etatDAutorite: EtatDAutorite;
  readonly etatDInvalidation: EtatDInvalidation;
  readonly classeDeRetention: ClasseDeRetention;
}

/** Une ligne de registre, telle qu'elle revient de la base. */
export interface LigneDeRegistre extends FacesDAutorite {
  readonly id: string;
  readonly bucket: string;
  readonly cle: string;
  /** L'identité sémantique vit ICI, pas dans la clé. Voir ./identite.ts. */
  readonly sujet: string;
  readonly lot: string | null;
  /**
   * NULL = ligne née de l'OBSERVATION, pas de l'allocation.
   *
   * Une ligne allouée porte TOUJOURS son empreinte : le buffer est en main
   * avant le PUT. Une ligne créée depuis un objet déjà présent ne le peut
   * pas — l'établir exigerait un `GetObject`, donc de faire SORTIR les octets
   * du compartiment pour les comparer. On ne lit pas une preuve pour vérifier
   * qu'elle est intacte, et on n'affirme pas une intégrité qu'on n'a pas
   * vérifiée : on laisse NULL, qui le dit.
   */
  readonly sha256: string | null;
  readonly tailleOctets: number;
  readonly typeContenu: string | null;
  readonly producteur: string;
  readonly alloueLe: Date;
  readonly enregistreLe: Date | null;
  readonly invalideLe: Date | null;
  readonly motifInvalidation: string | null;
}

// ─── LA DOCTRINE — ET ELLE A DES LECTEURS ────────────────────────────────
//
// Ces phrases ne sont pas de la décoration. Deux d'entre elles sont RENDUES
// à l'appelant par `expliquerRefus()` (./eligibilite.ts), et c'est délibéré :
// une doctrine sans lecteur est le mécanisme exact d'`evidentiaryStatus` —
// « S4 a prononcé l'exclusion […] la colonne n'était lue NULLE PART :
// l'exclusion était une déclaration sans effet ».
export const DOCTRINE = {
  IDENTITE_ALLOUEE:
    "A governed artifact must have an identity allocated by the registry " +
    "before its bytes can enter governed storage.",

  OPERATION_UNIQUE:
    "A governed artifact must not be persisted outside the governed object " +
    "registry. Successful object persistence and successful authority " +
    "registration form ONE governed operation.",

  ELIGIBILITE_DERIVEE:
    "Publication eligibility is derived authority, not persisted duplicated state.",

  /**
   * La clé allouée est OPAQUE parce que l'identité appartient au registre —
   * PAS parce qu'elle serait secrète. Mesuré : la clé historique est DÉRIVÉE,
   * `sha256(octets).slice(0,8)`, sans sel ; quiconque détient les octets la
   * recalcule. Ce qui tient l'exposition à zéro est le refus anonyme du
   * compartiment, et rien d'autre.
   */
  CLE_PAS_UN_CONTROLE:
    "Key unguessability is not access control. Bucket/access policy is.",

  PRESERVATION_SANS_AUTORITE:
    "Preservation of an invalid artifact does not preserve its publication authority.",

  /**
   * ⚠️ ÉCRIT DANS LE CONTRAT, PAS DÉCOUVERT. La quarantaine agit sur les
   * délivrances À VENIR. Une URL signée déjà émise reste valide jusqu'à son
   * expiration (TTL 900 s, plafond dur 3600 s) et un PDF déjà téléchargé ne
   * revient pas.
   */
  QUARANTAINE_PROSPECTIVE:
    "Quarantine is prospective: it withdraws future publication eligibility. " +
    "It does not revoke an already-issued signed URL, nor a past download.",

  /**
   * ⚠️ NE JAMAIS ÉCRIRE « immutable » NI « WORM » ICI. Ce compartiment n'est
   * pas WORM, aucun object lock n'est en vigueur, et la préservation est
   * obtenue par ABSENCE de politique de cycle de vie — ce qui n'est pas une
   * politique de conservation. D2 rend la décision explicite ; elle ne la
   * rend pas techniquement garantie.
   */
  RETENTION_EST_UN_PROCESSUS:
    "Retention is a process property, not a storage guarantee: this bucket is " +
    "not WORM and no object lock is in force. Absence of a lifecycle policy is " +
    "not a retention policy.",

  /**
   * LA SÉPARATION DES DEUX ÉTATS — ratifiée au recensement.
   *
   * `sha256` + `size_bytes` décrivent des OCTETS OBSERVÉS ; `authority_state`
   * + `invalidation_state` décrivent ce qui peut être UTILISÉ ou PUBLIÉ. Les
   * deux se rencontrent à la réconciliation et n'y fusionnent jamais :
   *
   *   · une intégrité vérifiée N'ACCORDE PAS l'autorité — un orphelin dont
   *     l'empreinte concorde reste un orphelin ;
   *   · une autorité enregistrée N'ÉTABLIT PAS l'intégrité — c'est
   *     exactement `LIGNE_SANS_OBJET`, l'incident le plus grave du
   *     réconciliateur : le registre affirme ce que le stockage ne porte pas.
   *
   * C'est pourquoi `PRESENT_NON_VERIFIABLE` existe comme verdict distinct :
   * « présent » n'est pas « vérifié », et aucun des deux n'est « publiable ».
   */
  INTEGRITE_ET_GOUVERNANCE_NE_SE_FABRIQUENT_PAS:
    "Integrity state describes independently observed persisted bytes. " +
    "Governance state describes what may be used or published. Neither state " +
    "may manufacture the other.",

  /**
   * NULL = NON ÉTABLI. Ni « inconnu donc mauvais », ni « probablement
   * identique ». C'est la seule valeur qui ne ment pas sur une empreinte
   * qu'on n'a pas pu vérifier sans lire les octets.
   */
  NULL_EST_NON_ETABLI:
    "A null integrity field means NOT ESTABLISHED. It does not mean unknown-" +
    "therefore-bad, and it does not mean probably-identical.",

  /**
   * L'ÉLARGISSEMENT DE D5 — la production ET la délivrance.
   *
   * Une variable d'environnement peut configurer l'INFRASTRUCTURE ; elle ne
   * peut pas transformer un artefact gouverné en artefact hors registre.
   * `PDF_STORAGE_ENABLED` ne décide donc pas si l'autorité existe.
   */
  AUTORITE_OU_RIEN:
    "No registry authority → no governed artifact production OR DELIVERY.",
} as const;
