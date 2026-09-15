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
 * Ce n'est PAS une autorité de localisation. C'est le REGISTRE des autorités,
 * et le refus qui tient tant qu'aucune ne revendique.
 *
 * ─── T1-REGISTRE-DE-LOCALISATION (2026-09-15) : L'AUTORITÉ EST CONÇUE ───────
 *
 * Le ruling qui a suivi la mesure des 31 :
 *   « An evidence object's storage key does not establish its storage
 *     compartment. Storage location requires its own governed authority. »
 *
 * Cette autorité est `evidence_storage_location_journal` — append-only, deux
 * triggers, vocabulaire clos DECLARED_AT_WRITE | VERIFIED_BY_HEAD — et son
 * lecteur est `storageLocationJournal.ts`. Le pont est
 * `autoriteDuRegistreDeLocalisation()`, plus bas.
 *
 * ⚠️ ELLE N'EST PAS ENCORE POSÉE, ET UNE FOIS POSÉE ELLE SERA VIDE. Le
 * comportement de ce module est donc INCHANGÉ pièce par pièce : absence
 * d'événement → STORAGE_LOCATION_UNRESOLVED. Aucun repli n'a été ajouté, et
 * la convention de préfixe reste un NO-GO EXPLICITE — les 31 clés commencent
 * toutes par `reports/`, et c'est précisément pourquoi on ne la lit pas.
 */
import type { S3Client } from "@aws-sdk/client-s3";
import { getEvidenceObject } from "./r2";
import { ouvrirCompartimentGouverne } from "./compartment";
import type { ReadObjectFn } from "./readback";
import type { StorageLocation } from "./storageLocationJournal";

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
 *
 * ─── ET ELLE PEUT OBJECTER, CE QUI N'EST PAS LA MÊME CHOSE QUE SE TAIRE ─────
 *
 * `objecter` est le second verbe, et il a été ajouté le 2026-09-15 parce que
 * son absence était un TROU : avec `localiser` seul, une autorité confrontée à
 * une ligne HORS DOMAINE n'avait qu'un moyen de le dire — rendre `null`. Or
 * `null` signifie « je ne revendique pas », c'est-à-dire une ABSENCE. Une
 * anomalie de la base se serait donc lue comme un simple trou de couverture :
 * exactement la dégradation que le ruling refuse (« une valeur hors domaine
 * rend une cause propre »), et elle aurait été INEXPRIMABLE, donc invérifiable.
 *
 *   localiser → une revendication  · objecter → un refus motivé
 *   les deux muets                 → abstention, et rien d'autre
 *
 * Les objections sont examinées AVANT les revendications : une autorité qui
 * objecte sur une pièce fait refuser, même si une autre la revendique. Une
 * incohérence constatée ne se contourne pas en demandant à quelqu'un d'autre.
 */
export interface AutoriteDeLocalisation {
  readonly nom: string;
  readonly localiser: (ligne: LigneALocaliser) => string | null;
  /**
   * Le motif pour lequel cette autorité REFUSE de laisser résoudre cette pièce,
   * ou `null` si elle n'a rien à objecter. Optionnel : une autorité qui ne sait
   * qu'affirmer reste une autorité valide.
   */
  readonly objecter?: (ligne: LigneALocaliser) => string | null;
}

/**
 * LE REGISTRE DES AUTORITÉS — VIDE PAR DÉFAUT, et c'est un CONSTAT, pas un trou.
 *
 * ⚠️ LE MÊME PIÈGE QU'À LA BASCULE DU JOURNAL DE PROVENANCE, ET LA MÊME RÉPONSE.
 *
 * L'autorité de localisation EXISTE désormais en conception :
 * `evidence_storage_location_journal`, et son lecteur
 * `storageLocationJournal.ts`. Elle n'est PAS inscrite ici pour autant, et ce
 * n'est pas un oubli :
 *
 *   · la table sera POSÉE VIDE. Aucun backfill, aucun préfixe, aucune date.
 *   · une autorité branchée sur une table vide ne revendique RIEN.
 *   · donc, pièce par pièce, le comportement est IDENTIQUE à aujourd'hui :
 *     absence d'événement → STORAGE_LOCATION_UNRESOLVED.
 *
 * L'inscrire en dur ici la rendrait dépendante d'un accès base à l'intérieur
 * d'une fonction PURE et SYNCHRONE. C'est pourquoi le pont est
 * `autoriteDuRegistreDeLocalisation(...)` : l'appelant LIT (asynchrone,
 * `readStorageLocations`), puis INJECTE le résultat déjà résolu. La résolution
 * reste pure ; la base reste au bord.
 *
 * « A new authority is not made operational merely because its schema exists.
 *   It becomes authoritative only after a positive governed witness proves the
 *   path it is meant to govern. » — et ce témoin n'existe pas encore : aucune
 * ligne n'est posée, la fenêtre s'arrête au SQL prêt à coller.
 */
export const AUTORITES_DE_LOCALISATION: readonly AutoriteDeLocalisation[] = Object.freeze([]);

/**
 * LE PONT — le registre gouverné devient une autorité de localisation.
 *
 * Reçoit ce que `readStorageLocations` a DÉJÀ résolu (une `StorageLocation` par
 * identité de pièce) et l'expose sous la forme que `resoudreLocalisation`
 * consomme. Aucun accès base ici : cette fonction est pure, et la résolution le
 * reste.
 *
 * LA CORRESPONDANCE, ET ELLE EST LE SUJET :
 *
 *   localisation ÉTABLIE            → revendication du compartiment
 *   NO_LOCATION_EVENT               → ABSTENTION (ni revendication, ni objection)
 *   ROW_OUT_OF_DOMAIN               → OBJECTION
 *   AMBIGUOUS_LATEST                → OBJECTION
 *   KEY_DIVERGENCE                  → OBJECTION
 *
 * La première ligne de ce tableau est la seule qui produise un compartiment.
 * Et la deuxième est celle qui garantit la bascule sans effet de bord : avec
 * une table vide, TOUTE pièce tombe en abstention, et le refus rendu par
 * `resoudreLocalisation` est mot pour mot celui d'aujourd'hui.
 *
 * ⛔ Les trois dernières ne sont PAS des abstentions. Les y ramener ferait
 * passer une anomalie de la base pour une dette de couverture, et c'est
 * précisément la faute que `objecter` existe pour rendre impossible.
 */
export function autoriteDuRegistreDeLocalisation(
  localisations: ReadonlyMap<string, StorageLocation>,
  nom = "registre-de-localisation",
): AutoriteDeLocalisation {
  return {
    nom,
    localiser: (ligne) => {
      const l = localisations.get(ligne.id);
      return l && l.established ? l.bucket : null;
    },
    objecter: (ligne) => {
      const l = localisations.get(ligne.id);
      if (!l || l.established) return null;
      // L'ABSENCE d'événement n'est pas une objection : c'est le silence
      // légitime d'un registre vide, et il doit rendre le refus HABITUEL.
      if (l.cause === "NO_LOCATION_EVENT") return null;
      return `[${l.cause}] ${l.detail}`;
    },
  };
}

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
 *   2. une autorité OBJECTE-t-elle ?       (une incohérence constatée prime tout)
 *   3. une autorité revendique-t-elle ?    (sinon : NON RÉSOLU)
 *   4. plusieurs, et en désaccord ?        (une ambiguïté n'est pas une résolution)
 *   5. l'ouvreur gouverné dessert-il ce compartiment ?
 *
 * ⚠️ L'ÉTAPE 2 PASSE AVANT L'ÉTAPE 3, ET L'ORDRE EST TOUT LE SUJET. Une
 * autorité qui a constaté une anomalie (dernier événement hors domaine, deux
 * événements concurrents, clé divergente) fait REFUSER — même si une autre
 * autorité, elle, revendique tranquillement un compartiment. Examiner les
 * revendications d'abord permettrait de CONTOURNER une incohérence en
 * demandant à quelqu'un d'autre ; c'est exactement l'arbitrage que le ruling
 * interdit.
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

  // ── LES OBJECTIONS D'ABORD. Une anomalie constatée par une autorité n'est
  // JAMAIS rattrapée par la revendication d'une autre.
  const objections = registre
    .map((a) => ({ nom: a.nom, motif: a.objecter ? a.objecter(ligne) : null }))
    .filter((o): o is { nom: string; motif: string } => typeof o.motif === "string" && o.motif.length > 0);
  if (objections.length > 0) {
    return nonResolue(
      `la localisation de la pièce ${ligne.id} est REFUSÉE par ${objections.length} autorité(s) : ` +
        objections.map((o) => `${o.nom} → ${o.motif}`).join(" ; ") +
        ". Une incohérence ou une ambiguïté constatée ne se contourne pas en interrogeant une autre autorité.",
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
