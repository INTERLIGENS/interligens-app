// ─── E-RC · L'ÉLIGIBILITÉ — DÉRIVÉE, JAMAIS STOCKÉE ──────────────────────
//
// ██  "Publication eligibility is derived authority, not persisted         ██
// ██   duplicated state."                                                  ██
//
// ─── POURQUOI UNE FONCTION ET PAS UNE COLONNE ────────────────────────────
//
// Une colonne `publiable` serait une SECONDE source de vérité pour une
// propriété qui en a déjà une — les cinq faces. Deux sources divergent : ce
// n'est pas une hypothèse, c'est l'Invariant Propagation Failure, et ce
// dépôt l'a déjà payé une fois. `evidenceDepth` : domaine de six valeurs,
// deux sites de lecture faisant `?? 0`, l'unique ligne `deep` (enquête
// ZachXBT, 17,8 M$ de pertes retail) rabattue sur `none`, verdict public
// « SIGNAL ». Une colonne d'éligibilité poserait cette faute volontairement,
// sur la propriété qui décide ce qu'un cabinet ouvre.
//
// ─── FAIL-CLOSED, ET PAR LISTE BLANCHE ───────────────────────────────────
//
// P2. La seule combinaison qui PUBLIE est énumérée ; tout le reste retient,
// y compris — et surtout — ce qu'on ne sait pas lire. Un `!== 'ABANDONED'`
// aurait laissé passer par défaut le prochain état ajouté sans passer par
// ici. C'est le mécanisme exact des sept sites de mélange documenté dans
// `src/lib/evidence-chain/eligibility.ts`.
import {
  DOCTRINE,
  estClasseDeRetention,
  estEtatDAutorite,
  estEtatDInvalidation,
  estNatureObjet,
  estProvenance,
  type FacesDAutorite,
} from "./contrat";

/**
 * Les raisons de refus. Domaine FERMÉ, et chacune est NOMMÉE.
 *
 * Un refus anonyme est indiscernable d'une panne — c'est la leçon des quatre
 * 401 du lot F, identiques au statut et venus de deux couches différentes.
 * Rien ici ne rend un refus sans dire lequel.
 */
export type RaisonDeRefus =
  /** L'état d'autorité n'est pas REGISTERED. L'opération gouvernée n'est pas close. */
  | "NON_ENREGISTRE"
  /** Un JUGEMENT a retiré l'autorité. Les octets, eux, restent. */
  | "AUTORITE_INVALIDEE"
  /** Une des cinq faces porte une valeur hors domaine. Fail-closed. */
  | "ETAT_HORS_DOMAINE"
  /** Clé dans le périmètre gouverné, aucune ligne de registre. */
  | "AUCUNE_LIGNE_DE_REGISTRE"
  /** Le registre n'a pas pu être interrogé. L'autorité est INCONNUE, donc refusée. */
  | "REGISTRE_INDISPONIBLE";

export type Eligibilite =
  | { readonly publiable: true }
  | { readonly publiable: false; readonly raison: RaisonDeRefus };

const RETENU = (raison: RaisonDeRefus): Eligibilite => ({ publiable: false, raison });

/**
 * LA dérivation. Cinq faces entrent, une décision sort.
 *
 * `classeDeRetention` entre dans la signature parce que le contrat la
 * compte parmi les faces — mais aucune classe n'ACCORDE. Conserver un
 * artefact à titre probatoire ne le rend pas publiable ; c'est exactement
 * "Preservation of an invalid artifact does not preserve its publication
 * authority", pris dans l'autre sens.
 */
export function deriverEligibilite(faces: FacesDAutorite): Eligibilite {
  // Le domaine d'abord : on ne juge pas une valeur qu'on ne sait pas lire.
  if (
    !estNatureObjet(faces.natureObjet) ||
    !estProvenance(faces.provenance) ||
    !estEtatDAutorite(faces.etatDAutorite) ||
    !estEtatDInvalidation(faces.etatDInvalidation) ||
    !estClasseDeRetention(faces.classeDeRetention)
  ) {
    return RETENU("ETAT_HORS_DOMAINE");
  }

  // Le jugement passe AVANT le processus : un artefact peut être parfaitement
  // enregistré et néanmoins invalidé. L'ordre inverse rendrait « non
  // enregistré » pour un objet dont le vrai motif est une décision — et le
  // motif rendu serait faux.
  if (faces.etatDInvalidation !== "NONE") return RETENU("AUTORITE_INVALIDEE");

  if (faces.etatDAutorite !== "REGISTERED") return RETENU("NON_ENREGISTRE");

  return { publiable: true };
}

/**
 * Le texte du refus. Il PORTE la doctrine, et c'est le point : une doctrine
 * sans lecteur est `evidentiaryStatus` — « l'exclusion était une déclaration
 * sans effet ». Ici, chaque refus d'artefact invalidé rappelle, à celui qui
 * le lit, que la quarantaine est PROSPECTIVE.
 */
export function expliquerRefus(raison: RaisonDeRefus): string {
  switch (raison) {
    case "AUTORITE_INVALIDEE":
      return (
        "Artefact conservé, autorité de publication retirée. " +
        DOCTRINE.PRESERVATION_SANS_AUTORITE +
        " " +
        DOCTRINE.QUARANTAINE_PROSPECTIVE
      );
    case "NON_ENREGISTRE":
      return (
        "L'opération gouvernée n'est pas close pour cet objet : ses octets " +
        "peuvent exister sans que son autorité soit enregistrée. " +
        DOCTRINE.OPERATION_UNIQUE
      );
    case "AUCUNE_LIGNE_DE_REGISTRE":
      return (
        "Objet présent dans le périmètre gouverné sans ligne de registre. " +
        DOCTRINE.IDENTITE_ALLOUEE
      );
    case "ETAT_HORS_DOMAINE":
      return (
        "Une face d'autorité porte une valeur hors domaine. Une valeur qu'on " +
        "ne sait pas lire n'est pas une valeur permissive."
      );
    case "REGISTRE_INDISPONIBLE":
      return (
        "Le registre n'a pas pu être interrogé : l'autorité est inconnue, " +
        "donc refusée. No registry authority → no governed artifact delivery."
      );
  }
}
