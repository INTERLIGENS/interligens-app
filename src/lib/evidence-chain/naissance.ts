/**
 * LA NAISSANCE DES OCTETS — le SEUL chemin par lequel une pièce gouvernée
 * obtient des octets persistés.
 *
 * ██  LES DEUX INVARIANTS QUI COMMANDENT CE FICHIER                          ██
 *
 *   INVARIANT 1 — « Governed evidence birth and governed evidence readback have
 *     different compartment permissions: legacy compartments may remain
 *     readable without becoming valid destinations for new evidence. »
 *
 *   INVARIANT 2 — « Content addressing prevents accidental naming divergence;
 *     it does not by itself prevent overwrite or authorize adoption of
 *     preexisting bytes. »
 *
 * ─── CE QUE CE MODULE FAIT, DANS CET ORDRE, ET L'ORDRE EST LE CONTRAT ───────
 *
 *   1. EXIGER la capacité WRITE sur LE compartiment de naissance.
 *      → `exigerCapaciteDEcriture`. Refus AVANT tout appel réseau : une porte
 *        déclarée en lecture n'est pas « essayée pour voir ».
 *   2. ÉCRIRE conditionnellement, si et seulement si la clé est libre.
 *      → `putEvidenceObjectIfAbsent` (`IfNoneMatch: "*"`, atomique côté serveur).
 *
 * L'étape 1 ne rend PAS l'étape 2 sûre à elle seule, et réciproquement : la
 * première dit OÙ et AVEC QUOI on a le droit d'écrire, la seconde dit qu'on
 * n'écrase pas ce qui est déjà là. Deux défauts distincts, deux verrous.
 *
 * ─── ⛔ CE QU'IL NE FAIT PAS, ET C'EST DÉLIBÉRÉ ──────────────────────────────
 *
 * Il n'ADOPTE JAMAIS des octets préexistants. Quand la clé est occupée, il rend
 * `OBJECT_ALREADY_EXISTS` et s'arrête. Il ne relit pas les octets présents, ne
 * compare pas leur hash, et surtout ne conclut pas « c'est le même contenu,
 * donc c'est notre pièce » : l'identité des octets n'est pas l'autorité de leur
 * naissance. Un objet déjà présent sous la même clé SHA n'est pas
 * automatiquement réutilisable comme preuve — il lui manquerait l'autorité de
 * naissance et d'ingestion gouvernée, et aucune relecture ne la fabrique.
 *
 * Il ne SUPPRIME rien, ne réessaie pas sans condition, et n'a aucun repli.
 */
import {
  exigerCapaciteDEcriture,
  type CompartimentOuvert,
  type CompartimentRefuse,
} from "./compartment";
import { putEvidenceObjectIfAbsent } from "./r2";

/** Les octets sont nés : la clé était libre, et elle ne l'est plus. */
export interface NaissanceEtablie {
  readonly ok: true;
  readonly bucket: string;
  readonly key: string;
  readonly etag: string | null;
}

/**
 * La naissance est REFUSÉE, et la cause dit laquelle des deux moitiés a parlé.
 *
 * `cause` reprend le vocabulaire de `CompartimentRefuse` pour les refus de
 * permission, et `OBJECT_ALREADY_EXISTS` pour le refus du stockage. Les deux
 * n'appellent pas le même geste : le premier se répare dans la configuration ou
 * dans l'appel, le second ne se « répare » pas du tout — il se constate.
 */
export interface NaissanceRefusee {
  readonly ok: false;
  readonly cause: CompartimentRefuse["cause"] | "OBJECT_ALREADY_EXISTS";
  readonly detail: string;
}

export type ResultatDeNaissance = NaissanceEtablie | NaissanceRefusee;

/**
 * Fait naître les octets d'une pièce gouvernée, ou refuse en le nommant.
 *
 * ⚠️ Ne lève JAMAIS pour un refus de permission ni pour une clé occupée : un
 * refus qui lève se fait ranger en « erreur de stockage » par le premier `catch`
 * venu, et la cause est perdue. Les erreurs de TRANSPORT, elles, sont bien
 * propagées — elles ne sont pas des constats.
 */
export async function faireNaitreLesOctets(
  porte: CompartimentOuvert,
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<ResultatDeNaissance> {
  // ── 1 · LA PERMISSION. Avant tout octet, avant tout appel réseau.
  const ecriture = exigerCapaciteDEcriture(porte);
  if ("ok" in ecriture) return { ok: false, cause: ecriture.cause, detail: ecriture.detail };

  // ── 2 · L'ÉCRITURE, CONDITIONNELLE. Aucun HEAD préalable : un pré-HEAD
  // fabriquerait une garantie avec une fenêtre TOCTOU au milieu.
  const r = await putEvidenceObjectIfAbsent(ecriture.s3, ecriture.bucket, key, body, contentType);
  if (!r.ok) return { ok: false, cause: r.cause, detail: r.detail };

  return { ok: true, bucket: ecriture.bucket, key, etag: r.etag };
}
