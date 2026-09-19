// ─── E-RC · LE REGISTRE — LES DEUX ÉCRITURES, ET RIEN D'AUTRE ────────────
//
// ██  INTENDED → PutObject → REGISTERED.                                   ██
// ██  La clé est ALLOUÉE PAR LE REGISTRE AVANT le PUT.                     ██
//
// ─── CE QU'ON NE PRÉTEND PAS ─────────────────────────────────────────────
//
// DB (Neon) et R2 n'ont AUCUNE transaction commune. Rien ici ne doit se lire
// comme « les deux écritures sont atomiques » : elles ne le sont pas, et un
// invariant qui l'affirmerait serait faux le jour où il compte.
//
// « UNE opération gouvernée » n'est pas « une transaction ». C'est une
// opération dont TOUS les états intermédiaires sont NOMMÉS, NON PUBLIABLES
// et DÉTECTABLES. L'atomicité qu'on ne peut pas obtenir sur l'écriture, on
// l'obtient sur la DÉCISION DE PUBLICATION — qui, elle, est locale à un seul
// magasin.
//
// ─── POURQUOI DU SQL BRUT ET PAS UN MODÈLE PRISMA ────────────────────────
//
// `prisma/` est un chemin GELÉ (`scripts/guard-offline.sh`). Poser le modèle
// dans `schema.prod.prisma` exige une lease ; ce module n'en a pas besoin
// pour fonctionner, et la table se crée de toute façon dans l'éditeur SQL
// Neon — jamais par `prisma db push`, jamais par `migrate`. Le DDL vit dans
// `docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql`.
//
// Le dépôt a déjà ce précédent : `generateCaseFile.ts:210` insère en SQL
// brut dans `casefiles`. Les valeurs passent toutes par des paramètres liés
// (`$queryRaw` en gabarit balisé) ; aucune n'est concaténée.
import { prisma } from "@/lib/prisma";
import { deriverEligibilite } from "./eligibilite";
import type {
  ClasseDeRetention,
  EtatDAutorite,
  EtatDInvalidation,
  LigneDeRegistre,
  NatureObjet,
  Provenance,
} from "./contrat";

/**
 * Les codes d'échec du registre. Domaine FERMÉ : un appelant doit pouvoir
 * distinguer « la base est absente » de « la transition est refusée », parce
 * que ces deux-là n'appellent pas la même conduite.
 */
export type CodeErreurRegistre =
  /** La base n'a pas répondu. L'autorité est INCONNUE. */
  | "REGISTRE_INDISPONIBLE"
  /** La table n'existe pas : la migration n'a pas été appliquée dans Neon. */
  | "TABLE_ABSENTE"
  /** La clé allouée existe déjà. Une collision est une ERREUR, jamais un écrasement. */
  | "CONFLIT_ALLOCATION"
  /** La transition demandée n'est pas ouverte depuis l'état courant. */
  | "TRANSITION_REFUSEE";

export class ErreurRegistre extends Error {
  constructor(
    readonly code: CodeErreurRegistre,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[registre] ${code}: ${message}`);
    this.name = "ErreurRegistre";
  }
}

/**
 * 42P01 = `undefined_table` en PostgreSQL. On le distingue d'une panne parce
 * que la conduite diffère : une table absente est une migration non
 * appliquée — un fait opérationnel connu et corrigeable — là où une panne
 * est un incident. Les confondre ferait chercher au mauvais endroit.
 */
function classerErreur(err: unknown): ErreurRegistre {
  const texte = err instanceof Error ? err.message : String(err);
  if (texte.includes("42P01") || /relation .* does not exist/i.test(texte)) {
    return new ErreurRegistre(
      "TABLE_ABSENTE",
      "table governed_objects absente — migration non appliquée dans l'éditeur SQL Neon",
      err,
    );
  }
  return new ErreurRegistre("REGISTRE_INDISPONIBLE", texte, err);
}

export interface EntreeAllocation {
  readonly bucket: string;
  readonly cle: string;
  readonly identifiant: string;
  readonly natureObjet: NatureObjet;
  readonly provenance: Provenance;
  readonly classeDeRetention: ClasseDeRetention;
  /** L'identité sémantique. Elle vit ICI, jamais dans la clé. */
  readonly sujet: string;
  readonly lot: string | null;
  readonly sha256: string;
  readonly tailleOctets: number;
  readonly typeContenu: string;
  /** Qui produit. Un orphelin sans producteur nommé est un orphelin qu'on cherche à l'aveugle. */
  readonly producteur: string;
}

interface LigneBrute {
  id: string;
  bucket: string;
  storage_key: string;
  object_nature: string;
  provenance: string;
  authority_state: string;
  invalidation_state: string;
  invalidation_reason: string | null;
  invalidated_at: Date | null;
  retention_class: string;
  subject: string;
  batch_id: string | null;
  sha256: string;
  size_bytes: number;
  content_type: string;
  producer: string;
  allocated_at: Date;
  registered_at: Date | null;
}

/**
 * Les valeurs reviennent de SQL en `string`.
 *
 * ⚠️ AUCUN REPLI N'EST APPLIQUÉ ICI, ET C'EST LE POINT. Une valeur hors
 * domaine est portée telle quelle jusqu'à `deriverEligibilite`, qui la
 * reconnaît comme illisible et REFUSE (ETAT_HORS_DOMAINE). Normaliser ici —
 * `?? 'INTENDED'`, `?? 'NONE'` — ferait disparaître l'anomalie AVANT le seul
 * endroit qui sait la refuser. C'est très exactement la faute `?? 0` qui a
 * rabattu l'unique ligne `deep` du dépôt sur `none` : le repli n'a pas
 * signalé la valeur inconnue, il l'a remplacée par une valeur permissive.
 *
 * Les assertions de type ci-dessous sont donc DÉLIBÉRÉES : elles portent une
 * valeur potentiellement hors domaine jusqu'à son juge.
 */
function hydrater(l: LigneBrute): LigneDeRegistre {
  return {
    id: l.id,
    bucket: l.bucket,
    cle: l.storage_key,
    natureObjet: l.object_nature as NatureObjet,
    provenance: l.provenance as Provenance,
    etatDAutorite: l.authority_state as EtatDAutorite,
    etatDInvalidation: l.invalidation_state as EtatDInvalidation,
    classeDeRetention: l.retention_class as ClasseDeRetention,
    sujet: l.subject,
    lot: l.batch_id,
    sha256: l.sha256,
    tailleOctets: Number(l.size_bytes),
    typeContenu: l.content_type,
    producteur: l.producer,
    alloueLe: l.allocated_at,
    enregistreLe: l.registered_at,
    invalideLe: l.invalidated_at,
    motifInvalidation: l.invalidation_reason,
  };
}

/**
 * ÉCRITURE #1 — l'intention. Posée AVANT que le moindre octet entre dans le
 * stockage gouverné.
 *
 * Si cette écriture échoue, il n'y a PAS de PUT : D5, « No registry authority
 * → no governed artifact production ». La disponibilité ne gagne pas contre
 * l'autorité, et la dégradation de service est assumée.
 */
export async function allouer(entree: EntreeAllocation): Promise<LigneDeRegistre> {
  try {
    const lignes = await prisma.$queryRaw<LigneBrute[]>`
      INSERT INTO governed_objects (
        id, bucket, storage_key, object_nature, provenance, authority_state,
        invalidation_state, retention_class, subject, batch_id,
        sha256, size_bytes, content_type, producer
      ) VALUES (
        ${entree.identifiant}, ${entree.bucket}, ${entree.cle},
        ${entree.natureObjet}, ${entree.provenance}, 'INTENDED',
        'NONE', ${entree.classeDeRetention}, ${entree.sujet}, ${entree.lot},
        ${entree.sha256}, ${entree.tailleOctets}, ${entree.typeContenu}, ${entree.producteur}
      )
      RETURNING *`;
    const ligne = lignes[0];
    if (!ligne) {
      throw new ErreurRegistre("REGISTRE_INDISPONIBLE", "INSERT sans ligne rendue");
    }
    return hydrater(ligne);
  } catch (err) {
    if (err instanceof ErreurRegistre) throw err;
    const texte = err instanceof Error ? err.message : String(err);
    // F6 — deux tirages qui viseraient la même clé. Sous la forme allouée
    // c'est un uuid, donc improbable ; sous la forme historique c'était
    // `{ms}-{slug}-{hash8}`, où deux tirages des MÊMES octets dans la MÊME
    // milliseconde produisaient la même clé et le second ÉCRASAIT le premier,
    // en silence, sur un préfixe dit immuable. L'index unique transforme cet
    // écrasement en erreur. Bénéfice non recherché du design, mais réel.
    if (texte.includes("23505") || /duplicate key|unique constraint/i.test(texte)) {
      throw new ErreurRegistre("CONFLIT_ALLOCATION", `clé déjà allouée: ${entree.cle}`, err);
    }
    throw classerErreur(err);
  }
}

/**
 * ÉCRITURE #2 — la confirmation, APRÈS un PutObject rendu OK.
 *
 * La transition n'est ouverte que depuis INTENDED ou STORED_UNCONFIRMED, et
 * seulement si AUCUNE invalidation n'est prononcée. Sans cette seconde
 * condition, une confirmation tardive ressusciterait un artefact mis en
 * quarantaine — la quarantaine doit tenir contre le processus, pas seulement
 * contre les lecteurs.
 *
 * Si cette écriture échoue alors que le PUT a réussi : la ligne reste
 * INTENDED, l'objet existe, sa clé est CONNUE. On ne retombe jamais dans
 * « objet inconnu ». C'est exactement ce que l'allocation préalable achète.
 */
export async function confirmerEnregistrement(identifiant: string): Promise<void> {
  let touchees: number;
  try {
    touchees = await prisma.$executeRaw`
      UPDATE governed_objects
         SET authority_state = 'REGISTERED',
             registered_at   = now(),
             updated_at      = now()
       WHERE id = ${identifiant}
         AND authority_state IN ('INTENDED', 'STORED_UNCONFIRMED')
         AND invalidation_state = 'NONE'`;
  } catch (err) {
    throw classerErreur(err);
  }
  if (touchees !== 1) {
    throw new ErreurRegistre(
      "TRANSITION_REFUSEE",
      `confirmation refusée pour ${identifiant} (${touchees} ligne(s) touchée(s)) — ` +
        "état courant hors transition, ou invalidation prononcée",
    );
  }
}

/**
 * La lecture d'autorité. Rend `null` quand AUCUNE ligne n'existe — ce qui
 * n'est pas « autorisé par défaut » : c'est au gate de traduire l'absence en
 * refus (AUCUNE_LIGNE_DE_REGISTRE), et il le fait.
 */
export async function lireParCle(bucket: string, cle: string): Promise<LigneDeRegistre | null> {
  try {
    const lignes = await prisma.$queryRaw<LigneBrute[]>`
      SELECT * FROM governed_objects
       WHERE bucket = ${bucket} AND storage_key = ${cle}
       LIMIT 1`;
    return lignes[0] ? hydrater(lignes[0]) : null;
  } catch (err) {
    throw classerErreur(err);
  }
}

/** La même lecture, par IDENTIFIANT. La supersession raisonne sur des identités. */
export async function lireParIdentifiant(identifiant: string): Promise<LigneDeRegistre | null> {
  try {
    const lignes = await prisma.$queryRaw<LigneBrute[]>`
      SELECT * FROM governed_objects WHERE id = ${identifiant} LIMIT 1`;
    return lignes[0] ? hydrater(lignes[0]) : null;
  } catch (err) {
    throw classerErreur(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CC-OFFLINE-268 · F1 — LA SUPERSESSION
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  UNE SUPERSESSION EST UN JUGEMENT HUMAIN,                              ██
// ██  PAS UNE PROPRIÉTÉ DÉCOUVERTE PAR LE PIPELINE.                         ██
//
// ██  SUPERSEDED NOMME SON REMPLAÇANT, PRÉSERVE L'HISTOIRE,                 ██
// ██  ET RETIRE L'AUTORITÉ DE DÉLIVRANCE COURANTE.                          ██
//
// ─── CE QUE CETTE PRIMITIVE N'EST PAS ─────────────────────────────────────
//
// ⛔ Ce n'est PAS un `invalidate(id, state)` générique. `WITHDRAWN_BY_DECISION`
//    et `INVALID_AUTHORITY` n'ont pas d'écrivain, et n'en gagnent pas un ici :
//    une primitive qui accepterait l'état en paramètre laisserait un appelant
//    prononcer un retrait en croyant prononcer un remplacement.
//
// ⛔ Ce n'est PAS un cycle de vie d'artefacts. Il n'y a ni `unsuperseder`, ni
//    retour à `NONE`, ni effacement. SUPERSEDED EST TERMINAL, et le mutant 10
//    le tient : une seconde tentative est refusée par la garde elle-même.
//
// ─── POURQUOI LE REMPLAÇANT EST UN PARAMÈTRE, ET PAS UNE LECTURE DU MOTIF ──
//
// Le schéma ne porte pas de colonne `replacement_registry_id`, et aucun DDL
// n'est posé pour en créer une : l'identité du remplaçant est donc ÉCRITE dans
// `invalidation_reason`, sous une forme non ambiguë.
//
// Mais `invalidation_reason` est une TRACE LISIBLE, jamais une autorité. Le
// remplaçant entre par un PARAMÈTRE TYPÉ DISTINCT, il est LU en base et VALIDÉ
// avant la moindre écriture. Déduire le remplaçant du texte du motif ferait de
// la prose la source de vérité — exactement ce que ce module refuse partout
// ailleurs.
//
// ─── CE QUE LA PRIMITIVE NE TOUCHE JAMAIS ─────────────────────────────────
//
// Les octets, le digest, la taille, la clé d'objet, l'identité de registre et
// les horodatages d'origine. Une supersession retire une AUTORITÉ ; elle
// n'efface pas une HISTOIRE. Le refus de délivrance qui en découle existait
// déjà — `deriverEligibilite` rejette tout état d'invalidation ≠ `NONE`, et il
// le fait AVANT de regarder l'état d'autorité.

/** Ce qui fait REFUSER une supersession, nommément. Domaine FERMÉ. */
export type CauseDeRefusSupersession =
  | "ANCIEN_INTROUVABLE"
  | "REMPLACANT_INTROUVABLE"
  | "IDENTITES_IDENTIQUES"
  | "ANCIEN_NON_ENREGISTRE"
  | "ANCIEN_DEJA_INVALIDE"
  | "REMPLACANT_NON_ENREGISTRE"
  | "REMPLACANT_INVALIDE"
  | "REMPLACANT_NON_DELIVRABLE"
  | "MOTIF_VIDE";

export type ResultatSupersession =
  | { readonly prononcee: true; readonly ligne: LigneDeRegistre }
  | { readonly prononcee: false; readonly cause: CauseDeRefusSupersession; readonly explication: string };

const REFUS_SUPERSESSION = (
  cause: CauseDeRefusSupersession,
  explication: string,
): ResultatSupersession => ({ prononcee: false, cause, explication });

/**
 * Prononcer qu'un artefact gouverné est DÉPASSÉ PAR UN AUTRE.
 *
 * ⚠️ L'AUTORITÉ DE DÉCISION N'EST PAS ICI. Cette fonction EXÉCUTE un jugement
 * déjà rendu par une autorité humaine ; elle ne le rend pas. Aucun flux, aucun
 * réconciliateur, aucune route ne doit l'appeler : elle est faite pour une
 * procédure nommée, sous ordre explicite, et le `motif` est ce qui porte la
 * trace lisible de cet ordre.
 *
 * Les préconditions sont vérifiées AVANT toute écriture, et l'`UPDATE` les
 * REVÉRIFIE dans sa propre clause `WHERE` : entre la lecture et l'écriture, la
 * base peut bouger. Une seule ligne doit être touchée — 0 ou plusieurs est un
 * FAIL CLOSED, et rien n'est écrit ailleurs.
 */
export async function superseder(
  ancienIdentifiant: string,
  remplacementIdentifiant: string,
  motif: string,
): Promise<ResultatSupersession> {
  if (motif.trim().length === 0) {
    return REFUS_SUPERSESSION(
      "MOTIF_VIDE",
      "une supersession sans motif est indiscernable d'une erreur de manipulation",
    );
  }
  if (ancienIdentifiant === remplacementIdentifiant) {
    return REFUS_SUPERSESSION(
      "IDENTITES_IDENTIQUES",
      "un artefact ne se remplace pas lui-même",
    );
  }

  const ancien = await lireParIdentifiant(ancienIdentifiant);
  if (!ancien) {
    return REFUS_SUPERSESSION("ANCIEN_INTROUVABLE", `aucune ligne de registre pour ${ancienIdentifiant}`);
  }
  const remplacant = await lireParIdentifiant(remplacementIdentifiant);
  if (!remplacant) {
    return REFUS_SUPERSESSION("REMPLACANT_INTROUVABLE", `aucune ligne de registre pour ${remplacementIdentifiant}`);
  }

  if (ancien.etatDInvalidation !== "NONE") {
    // TERMINALITÉ : c'est ici que la SECONDE tentative tombe.
    return REFUS_SUPERSESSION(
      "ANCIEN_DEJA_INVALIDE",
      `${ancienIdentifiant} porte déjà l'invalidation ${ancien.etatDInvalidation} — une invalidation ne se rejoue pas`,
    );
  }
  if (ancien.etatDAutorite !== "REGISTERED") {
    return REFUS_SUPERSESSION(
      "ANCIEN_NON_ENREGISTRE",
      `${ancienIdentifiant} est ${ancien.etatDAutorite} — on ne dépasse que ce qui a été enregistré`,
    );
  }
  if (remplacant.etatDInvalidation !== "NONE") {
    return REFUS_SUPERSESSION(
      "REMPLACANT_INVALIDE",
      `${remplacementIdentifiant} porte l'invalidation ${remplacant.etatDInvalidation}`,
    );
  }
  if (remplacant.etatDAutorite !== "REGISTERED") {
    return REFUS_SUPERSESSION(
      "REMPLACANT_NON_ENREGISTRE",
      `${remplacementIdentifiant} est ${remplacant.etatDAutorite}`,
    );
  }

  // ── LE CONTRÔLE QUI DISTINGUE « IL EXISTE » DE « IL PEUT PRENDRE SA PLACE »
  //
  // Retirer l'autorité de délivrance d'un artefact au profit d'un remplaçant
  // qui n'est pas lui-même délivrable laisserait le sujet SANS artefact
  // courant. L'éligibilité est jugée par l'autorité EXISTANTE, pas par une
  // seconde règle écrite ici.
  const eligibilite = deriverEligibilite(remplacant);
  if (!eligibilite.publiable) {
    return REFUS_SUPERSESSION(
      "REMPLACANT_NON_DELIVRABLE",
      `${remplacementIdentifiant} n'est pas délivrable (${eligibilite.raison}) — ` +
        "un remplaçant qu'on ne peut pas délivrer ne remplace rien",
    );
  }

  // ── L'ÉCRITURE. Atomique, gardée, et elle REVÉRIFIE les préconditions de
  //    l'ancien : entre la lecture et l'écriture, la base peut bouger.
  //    ⛔ `sha256`, `size_bytes`, `storage_key`, `bucket` et `id` ne sont pas
  //       dans le SET, et ne doivent jamais y entrer.
  let touchees: number;
  try {
    touchees = await prisma.$executeRaw`
      UPDATE governed_objects
         SET invalidation_state  = 'SUPERSEDED',
             invalidation_reason = ${motif},
             invalidated_at      = now(),
             updated_at          = now()
       WHERE id = ${ancienIdentifiant}
         AND authority_state = 'REGISTERED'
         AND invalidation_state = 'NONE'`;
  } catch (err) {
    throw classerErreur(err);
  }
  if (touchees !== 1) {
    throw new ErreurRegistre(
      "TRANSITION_REFUSEE",
      `supersession refusée pour ${ancienIdentifiant} (${touchees} ligne(s) touchée(s)) — ` +
        "l'état a changé entre la vérification et l'écriture",
    );
  }

  const relue = await lireParIdentifiant(ancienIdentifiant);
  if (!relue || relue.etatDInvalidation !== "SUPERSEDED") {
    throw new ErreurRegistre(
      "TRANSITION_REFUSEE",
      `la relecture de ${ancienIdentifiant} ne confirme pas la supersession`,
    );
  }
  return { prononcee: true, ligne: relue };
}

/**
 * CC-OFFLINE-310 · LES LIGNES D'UN SUJET. LECTURE BORNÉE, RIEN D'AUTRE.
 *
 * ██  CE N'EST PAS UNE NOUVELLE AUTORITÉ. C'EST UNE LECTURE DU REGISTRE.   ██
 *
 * `listerLignes` filtre sur le COMPARTIMENT : obtenir les lignes d'un sujet par
 * elle imposerait de charger toute la table et de filtrer en mémoire. D'où
 * cette primitive — et elle ne fait QUE `WHERE subject = …`.
 *
 * ⛔ CE QU'ELLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ :
 *
 *    · aucun `ORDER BY` sémantique — pas de `registered_at DESC`, pas de
 *      « latest », pas de « current », pas de « canonical » ;
 *    · aucune sélection — elle ne désigne pas, elle ÉNUMÈRE ;
 *    · aucun filtrage d'éligibilité — le jugement appartient à
 *      `deriverEligibilite`, et le recopier ici ferait une SECONDE AUTORITÉ ;
 *    · aucun masquage d'un invalidé — un artefact conservé sans autorité de
 *      remise fait partie de l'histoire du sujet, et l'histoire se lit.
 *
 *        LISTER ≠ DÉSIGNER.  HISTORIQUE ≠ AUTORITÉ COURANTE.
 *
 * L'ordre est celui de l'IDENTITÉ DE REGISTRE : neutre, stable, et porteur
 * d'aucune préférence. Il est posé ici pour que l'appelant n'ait pas à choisir
 * un ordre — et donc pas à en inventer un qui signifierait quelque chose.
 */
export async function listerParSujet(sujet: string): Promise<LigneDeRegistre[]> {
  try {
    const lignes = await prisma.$queryRaw<LigneBrute[]>`
      SELECT * FROM governed_objects WHERE subject = ${sujet} ORDER BY id`;
    return lignes.map(hydrater);
  } catch (err) {
    throw classerErreur(err);
  }
}

/** Toutes les lignes du compartiment — la direction DB→R2 de la réconciliation. */
export async function listerLignes(bucket: string): Promise<LigneDeRegistre[]> {
  try {
    const lignes = await prisma.$queryRaw<LigneBrute[]>`
      SELECT * FROM governed_objects WHERE bucket = ${bucket}`;
    return lignes.map(hydrater);
  } catch (err) {
    throw classerErreur(err);
  }
}
