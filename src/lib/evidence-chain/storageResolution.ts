/**
 * LA RÉSOLUTION DE STOCKAGE — où sont les octets de CETTE pièce.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « Evidentiary eligibility does not imply storage resolvability. An
 *     irreversible evidence operation requires both. »
 *
 * ─── CE QUE `tsaPendingUniverseSql` NE DIT PAS ──────────────────────────────
 *
 * `"tsaToken" IS NULL AND <éligible>` établit qu'une pièce a le DROIT d'être
 * horodatée : elle n'a pas de jeton, et aucune décision ne l'a disqualifiée.
 * Il ne dit RIEN de l'endroit où ses octets se trouvent. Les deux propriétés
 * sont indépendantes, et une écriture irréversible exige les DEUX.
 *
 * Mesuré : les ~1 101 pièces existantes ont leurs octets dans le compartiment
 * où le REPLI les a écrites, et `EvidenceItem` ne porte que `r2Key` — aucune
 * colonne ne dit dans QUEL compartiment. Leur éligibilité probatoire est
 * intacte ; leur localisation, elle, n'est établie par aucune autorité.
 *
 * ─── L'INTERDIT, ET IL EST LE CŒUR ──────────────────────────────────────────
 *
 * ⚠️ AUCUN REPLI. Quand la localisation n'est pas résolvable, on REFUSE. On ne
 * « va voir dans `reports` au cas où » : ce repli réintroduirait exactement
 * l'ambiguïté que le fail-closed vient de supprimer, et il la réintroduirait
 * au pire endroit — juste avant une écriture irréversible chez un tiers.
 *
 * ⚠️ ET SURTOUT : chercher au mauvais endroit et ne rien trouver N'EST PAS
 * constater une absence. « Absent du nouveau compartiment » ≠ « octets
 * absents ». Un mauvais compartiment n'est pas une mesure d'absence — c'est la
 * même doctrine que `object_unreadable` face à `object_absent`, et que
 * `CANNOT_MEASURE` face à `NO_DELETE_RULE`. Un refus d'intermédiaire, une
 * non-observation, une recherche au mauvais endroit : aucune n'est un fait.
 *
 * ─── CE QUE CE MODULE N'EST PAS ─────────────────────────────────────────────
 *
 * Ce n'est PAS une autorité de localisation. C'est le REGISTRE qui en
 * accueillera une, et le refus qui tient tant qu'il est vide. Le registre est
 * vide aujourd'hui, et c'est la mesure — pas un oubli.
 */
import type { S3Client } from "@aws-sdk/client-s3";
import { getEvidenceObject } from "./r2";
import { ouvrirCompartimentGouverne } from "./compartment";
import type { ReadObjectFn } from "./readback";

/** Ce qu'une autorité de localisation a besoin de voir d'une pièce. */
export interface LigneALocaliser {
  readonly id: string;
  readonly r2Key: string | null;
}

/**
 * UNE AUTORITÉ DE LOCALISATION. Elle NOMME le compartiment d'une pièce, ou
 * rend `null` pour dire « je ne revendique pas celle-ci ».
 *
 * Elle ne DEVINE pas. Une autorité qui rendrait un compartiment par défaut ne
 * serait pas une autorité : ce serait le repli, sous un autre nom.
 */
export interface AutoriteDeLocalisation {
  readonly nom: string;
  readonly localiser: (ligne: LigneALocaliser) => string | null;
}

/**
 * LE REGISTRE — VIDE, et c'est un CONSTAT, pas un trou.
 *
 * Aucune autorité ne peut aujourd'hui dire dans quel compartiment vit une
 * pièce donnée : rien en base ne le porte, et aucune convention de clé ne le
 * porte non plus (`contentAddressedKey` décrit un CHEMIN, pas un compartiment).
 *
 * Le jour où une autorité existera — colonne par objet, table de résolution,
 * convention de préfixe — elle s'inscrit ICI, en une entrée, et tout le reste
 * du chemin la suit sans changer. Les formes envisageables et leur coût sont
 * décrits dans docs/prep/T1_RESOLUTION_DE_STOCKAGE_2026-09-15.md ; aucune
 * n'est construite dans cette fenêtre.
 */
export const AUTORITES_DE_LOCALISATION: readonly AutoriteDeLocalisation[] = Object.freeze([]);

// ═══════════════════════════════════════════════════════════════════════════
// LA RÉSOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résolu : le compartiment est NOMMÉ, et la capacité de lecture qui lui est
 * LIÉE est rendue en même temps.
 *
 * Les deux vont ensemble à dessein. Rendre le nom sans le lecteur laisserait
 * l'appelant libre d'ouvrir un autre compartiment ; rendre le lecteur sans le
 * nom empêcherait de dire où l'on a lu. Surtout : le lecteur N'EXISTE PAS
 * tant que la résolution n'a pas réussi, ce qui rend structurellement
 * impossible de lire avant d'avoir résolu.
 */
export interface LocalisationResolue {
  readonly ok: true;
  readonly compartiment: string;
  readonly autorite: string;
  readonly readObject: ReadObjectFn;
}

export interface LocalisationNonResolue {
  readonly ok: false;
  /** Pourquoi. Jamais « inconnu », jamais vide. */
  readonly detail: string;
}

export type ResolutionDeLocalisation = LocalisationResolue | LocalisationNonResolue;

/** La capacité injectée dans le gate. Elle ne reçoit QUE la ligne. */
export type ResolveStorageFn = (
  ligne: LigneALocaliser,
) => Promise<ResolutionDeLocalisation> | ResolutionDeLocalisation;

function nonResolue(detail: string): LocalisationNonResolue {
  return { ok: false, detail };
}

/**
 * L'OUVREUR — la seule façon de transformer un nom de compartiment en capacité
 * de lecture. Un compartiment nommé qu'aucun ouvreur ne sait ouvrir n'est PAS
 * résolu : le nommer ne suffit pas, il faut pouvoir y lire.
 *
 * Aujourd'hui l'unique ouvreur est la porte gouvernée. C'est délibéré : c'est
 * ce qui rend le repli vers `R2_BUCKET_NAME` non pas interdit par convention,
 * mais INATTEIGNABLE — il n'existe aucun chemin de code qui y mène.
 */
function ouvrir(
  compartimentVoulu: string,
  env: Record<string, string | undefined>,
): { s3: S3Client; bucket: string } | { refus: string } {
  const porte = ouvrirCompartimentGouverne(env);
  if (!porte.ok) {
    return { refus: `aucun ouvreur disponible pour « ${compartimentVoulu} » — ${porte.cause} : ${porte.detail}` };
  }
  if (porte.bucket !== compartimentVoulu) {
    return {
      refus:
        `le compartiment « ${compartimentVoulu} » est NOMMÉ mais aucun ouvreur gouverné ne le dessert ` +
        `(la porte gouvernée ouvre « ${porte.bucket} »). Lire ailleurs serait chercher au mauvais endroit, ` +
        `et ne rien y trouver ne serait pas une mesure d'absence.`,
    };
  }
  return { s3: porte.s3, bucket: porte.bucket };
}

/**
 * Résout la localisation d'UNE pièce, ou refuse en le disant.
 *
 * L'ordre est le contrat :
 *   1. y a-t-il une clé de stockage ?      (sinon il n'y a rien à localiser)
 *   2. une autorité revendique-t-elle ?    (sinon : NON RÉSOLU)
 *   3. plusieurs, et en désaccord ?        (une ambiguïté n'est pas une résolution)
 *   4. l'ouvreur gouverné dessert-il ce compartiment ?
 *
 * Aucune branche ne rend un compartiment par défaut. C'est vérifiable à l'œil :
 * la seule source d'un nom de compartiment est `autorite.localiser`.
 */
export function resoudreLocalisation(
  ligne: LigneALocaliser,
  env: Record<string, string | undefined> = process.env,
  /**
   * Le registre, INJECTABLE — et c'est ce qui rend la branche POSITIVE
   * éprouvable sans inventer une autorité dans le code de production, ni
   * réécrire la fonction dans un test. Une reproduction côté test serait une
   * seconde source de vérité, et elle vieillirait.
   */
  registre: readonly AutoriteDeLocalisation[] = AUTORITES_DE_LOCALISATION,
): ResolutionDeLocalisation {
  const cle = (ligne.r2Key ?? "").trim();
  if (!cle) {
    return nonResolue(
      `la pièce ${ligne.id} ne porte aucune clé de stockage : il n'y a pas de localisation à résoudre.`,
    );
  }

  const revendications = registre.map((a) => ({ nom: a.nom, compartiment: a.localiser(ligne) }))
    .filter((r): r is { nom: string; compartiment: string } => typeof r.compartiment === "string" && r.compartiment.length > 0);

  if (revendications.length === 0) {
    return nonResolue(
      `aucune autorité de localisation ne revendique la pièce ${ligne.id} (clé « ${cle} »). ` +
        (registre.length === 0
          ? "Le registre des autorités de localisation est VIDE : aucun mécanisme du dépôt ne sait aujourd'hui " +
            "dans quel compartiment vivent les octets d'une pièce donnée. C'est une DETTE DE MIGRATION / " +
            "RÉSOLUTION, pas une impossibilité — et surtout pas une absence d'octets."
          : `${registre.length} autorité(s) inscrite(s), aucune ne la revendique.`),
    );
  }

  const distincts = [...new Set(revendications.map((r) => r.compartiment))];
  if (distincts.length > 1) {
    return nonResolue(
      `${revendications.length} autorités désignent des compartiments DIFFÉRENTS pour la pièce ${ligne.id} ` +
        `(${revendications.map((r) => `${r.nom}→${r.compartiment}`).join(", ")}). ` +
        "Une ambiguïté n'est pas une résolution : on ne choisit pas, on refuse.",
    );
  }

  const compartiment = distincts[0];
  const ouvert = ouvrir(compartiment, env);
  if ("refus" in ouvert) return nonResolue(ouvert.refus);

  return {
    ok: true,
    compartiment: ouvert.bucket,
    autorite: revendications.map((r) => r.nom).join("+"),
    readObject: (key: string) => getEvidenceObject(ouvert.s3, ouvert.bucket, key),
  };
}

/** La capacité, prête à injecter dans le gate. */
export function resolveurGouverne(
  env: Record<string, string | undefined> = process.env,
  registre: readonly AutoriteDeLocalisation[] = AUTORITES_DE_LOCALISATION,
): ResolveStorageFn {
  return (ligne) => resoudreLocalisation(ligne, env, registre);
}
