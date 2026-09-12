// ─── E-RC · LA RÉCONCILIATION — BIDIRECTIONNELLE, ET NON DESTRUCTIVE ─────
//
// ██  P4 : rejouable, convergente, et JAMAIS une suppression.             ██
//
// ─── POURQUOI LES DEUX DIRECTIONS, ET POURQUOI ENSEMBLE ──────────────────
//
// F1. Une réconciliation DB→R2 seule ne voit jamais les OBJETS SANS LIGNE —
// donc jamais le témoin « avant ». Une R2→DB seule ne voit jamais les LIGNES
// SANS OBJET — donc jamais une autorité enregistrée pour des octets absents.
// Une seule direction est pire que rien : elle crée la confiance sans la
// couverture.
//
// ─── CE MODULE NE TOUCHE RIEN ────────────────────────────────────────────
//
// Il CLASSE. Il propose au plus une transition d'ÉTAT DE REGISTRE — donc une
// écriture en base, jamais sur un objet. Aucun Copy, aucun Delete, aucune
// métadonnée : marquer la preuve détruirait ce qu'elle prouve, et un objet
// réécrit n'est plus celui qui a été produit.
import {
  causeProbable,
  estAnterieurALaBorneLegacy,
  estDansPerimetreGouverne,
  type CauseProbable,
} from "./identite";
import type { EtatDAutorite, LigneDeRegistre } from "./contrat";

/**
 * L'échéance T de P3 : au-delà, un état non terminal n'est plus une fenêtre,
 * c'est un INCIDENT. 15 minutes — une génération de dossier lance un Chromium
 * headless et se compte en dizaines de secondes ; l'ordre de grandeur laisse
 * passer la lenteur sans laisser passer l'oubli.
 */
export const DELAI_RECONCILIATION_MS = 15 * 60 * 1000;

/** Ce que la sonde R2 observe. `HeadObject` uniquement — jamais `GetObject`. */
export interface ObjetObserve {
  readonly cle: string;
  readonly tailleOctets: number;
  readonly derniereModification: Date;
  /**
   * La métadonnée `sha256` posée à l'écriture, quand elle existe.
   *
   * ⚠️ JAMAIS L'ETag. En multipart l'ETag n'est pas un MD5, et rien ne
   * garantit sa forme chez R2. Fonder l'intégrité dessus donnerait des
   * divergences fantômes sur les gros artefacts — et la seule alternative
   * serait un GetObject, qui ferait SORTIR les octets du compartiment pour
   * les comparer. On ne lit pas une preuve pour vérifier qu'elle est intacte.
   */
  readonly sha256Metadonnee: string | null;
}

export type VerdictReconciliation =
  /** Ligne enregistrée, objet présent, intégrité vérifiée. Rien à faire. */
  | "CONFORME"
  /** Intention récente sans objet. La fenêtre est ouverte, elle est bornée. */
  | "INTENTION_EN_ATTENTE"
  /** Intention sans objet au-delà de T. Non destructif : rien n'est supprimé. */
  | "ABANDON"
  /** Objet présent et vérifié sous une intention : l'opération se CLÔT ici. */
  | "PROMOTION_POSSIBLE"
  /** Objet présent, intégrité invérifiable (métadonnée absente). Non publiable. */
  | "PRESENT_NON_VERIFIABLE"
  /** Taille ou empreinte divergentes. INCIDENT — aucune transition automatique. */
  | "INCOHERENCE_INTEGRITE"
  /** Abandon prononcé, objet pourtant présent — le PUT à faux négatif, arrivé tard. */
  | "ABANDONNE_MAIS_PRESENT"
  /** Autorité enregistrée, octets absents. INCIDENT le plus grave : F1. */
  | "LIGNE_SANS_OBJET"
  /** Objet du périmètre gouverné, aucune ligne. L'état du témoin « avant ». */
  | "ORPHELIN"
  /** Antérieur à la borne : non enregistré, et qualifié comme tel. Aucune conclusion historique. */
  | "LEGACY_NON_ENREGISTRE"
  /** Hors `reports/`. Dette E COMPTÉE — un trou compté est une dette, un trou non compté est un oubli. */
  | "HORS_PERIMETRE";

export interface Classement {
  readonly cle: string;
  readonly verdict: VerdictReconciliation;
  /**
   * La seule écriture jamais proposée : un état de REGISTRE. `null` quand le
   * cas demande un humain — et quatre le demandent, à dessein.
   */
  readonly transitionProposee: EtatDAutorite | null;
  readonly causeProbable: CauseProbable | null;
  readonly detail: string;
}

function integriteVerifiee(ligne: LigneDeRegistre, objet: ObjetObserve): boolean {
  return (
    ligne.sha256 !== null &&
    objet.sha256Metadonnee !== null &&
    objet.sha256Metadonnee === ligne.sha256 &&
    objet.tailleOctets === ligne.tailleOctets
  );
}

/**
 * Y a-t-il seulement DEUX empreintes à comparer ? Une ligne née de
 * l'observation n'en porte pas ; l'absence des deux côtés n'est pas une
 * divergence, c'est une comparaison qui n'existe pas. Les confondre
 * signalerait un incident d'intégrité là où il n'y a qu'un fait non établi.
 */
function comparaisonPossible(ligne: LigneDeRegistre, objet: ObjetObserve): boolean {
  return ligne.sha256 !== null && objet.sha256Metadonnee !== null;
}

/**
 * Classer UN couple (ligne, objet). L'un des deux peut manquer — c'est même
 * tout l'intérêt : les deux cas d'absence sont les deux directions.
 */
export function classer(
  ligne: LigneDeRegistre | null,
  objet: ObjetObserve | null,
  maintenant: Date,
  delaiMs: number = DELAI_RECONCILIATION_MS,
): Classement {
  // ── Direction R2→DB : un objet, aucune ligne ─────────────────────────
  if (!ligne) {
    if (!objet) throw new Error("[reconciliation] classer() appelé sans ligne ni objet");
    if (!estDansPerimetreGouverne(objet.cle)) {
      return {
        cle: objet.cle,
        verdict: "HORS_PERIMETRE",
        transitionProposee: null,
        causeProbable: null,
        detail: "hors du périmètre gouverné de phase 1 (reports/) — dette E comptée",
      };
    }
    if (estAnterieurALaBorneLegacy(objet.derniereModification)) {
      return {
        cle: objet.cle,
        verdict: "LEGACY_NON_ENREGISTRE",
        transitionProposee: "LEGACY_UNREGISTERED",
        causeProbable: causeProbable(objet.cle),
        detail:
          "antérieur à la borne legacy — non enregistré, et qualifié comme tel. " +
          "Aucune conclusion sur ce qu'il a été.",
      };
    }
    return {
      cle: objet.cle,
      verdict: "ORPHELIN",
      transitionProposee: "ORPHAN_CONFIRMED",
      causeProbable: causeProbable(objet.cle),
      detail: "objet du périmètre gouverné sans ligne de registre",
    };
  }

  // ── Direction DB→R2 : une ligne, aucun objet ─────────────────────────
  if (!objet) {
    if (ligne.etatDAutorite === "REGISTERED") {
      return {
        cle: ligne.cle,
        verdict: "LIGNE_SANS_OBJET",
        transitionProposee: null,
        causeProbable: null,
        detail:
          "autorité enregistrée, octets absents — le registre affirme ce que le " +
          "stockage ne porte pas. Aucune transition automatique : cet écart se tranche.",
      };
    }
    const ageMs = maintenant.getTime() - ligne.alloueLe.getTime();
    if (ligne.etatDAutorite === "INTENDED" && ageMs > delaiMs) {
      return {
        cle: ligne.cle,
        verdict: "ABANDON",
        transitionProposee: "ABANDONED",
        causeProbable: null,
        detail: `intention sans objet depuis ${Math.round(ageMs / 60000)} min (T = ${Math.round(delaiMs / 60000)} min)`,
      };
    }
    return {
      cle: ligne.cle,
      verdict: "INTENTION_EN_ATTENTE",
      transitionProposee: null,
      causeProbable: null,
      detail: `fenêtre ouverte depuis ${Math.round(ageMs / 1000)} s — bornée par T`,
    };
  }

  // ── Les deux présents ────────────────────────────────────────────────
  if (comparaisonPossible(ligne, objet) && !integriteVerifiee(ligne, objet)) {
    return {
      cle: ligne.cle,
      verdict: "INCOHERENCE_INTEGRITE",
      transitionProposee: null,
      causeProbable: null,
      detail:
        `empreinte ou taille divergentes — registre ${ligne.sha256?.slice(0, 12)}…/${ligne.tailleOctets} o, ` +
        `objet ${objet.sha256Metadonnee?.slice(0, 12)}…/${objet.tailleOctets} o`,
    };
  }

  if (ligne.etatDAutorite === "ABANDONED") {
    return {
      cle: ligne.cle,
      verdict: "ABANDONNE_MAIS_PRESENT",
      transitionProposee: null,
      causeProbable: null,
      detail:
        "abandon prononcé, objet pourtant présent — le PUT à faux négatif arrivé " +
        "après T. L'objet reste, l'autorité ne se rend pas d'elle-même.",
    };
  }

  if (!integriteVerifiee(ligne, objet)) {
    return {
      cle: ligne.cle,
      verdict: "PRESENT_NON_VERIFIABLE",
      transitionProposee: "STORED_UNCONFIRMED",
      causeProbable: causeProbable(objet.cle),
      detail:
        "objet présent, intégrité non établie (empreinte absente d'un côté au " +
        "moins) — « présent » n'est pas « vérifié »",
    };
  }

  if (ligne.etatDAutorite === "REGISTERED") {
    return {
      cle: ligne.cle,
      verdict: "CONFORME",
      transitionProposee: null,
      causeProbable: null,
      detail: "intégrité vérifiée sur taille + empreinte, sans lire un octet",
    };
  }

  return {
    cle: ligne.cle,
    verdict: "PROMOTION_POSSIBLE",
    transitionProposee: "REGISTERED",
    causeProbable: null,
    detail:
      "objet présent et vérifié sous une intention — c'est la clôture de " +
      "l'opération gouvernée interrompue entre le PUT et la confirmation",
  };
}

/**
 * Les verdicts qui APPELLENT UN HUMAIN. Ils ne se résorbent pas tout seuls,
 * et un réconciliateur qui les tairait rendrait « tout va bien » sur un
 * désaccord entre le registre et le stockage.
 */
export const VERDICTS_INCIDENT: readonly VerdictReconciliation[] = Object.freeze([
  "LIGNE_SANS_OBJET",
  "INCOHERENCE_INTEGRITE",
  "ABANDONNE_MAIS_PRESENT",
  "ORPHELIN",
]);

export function estIncident(v: VerdictReconciliation): boolean {
  return VERDICTS_INCIDENT.includes(v);
}
