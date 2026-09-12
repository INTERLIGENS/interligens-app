// ─── LA TABLE DES FONDATIONS — quel chemin de donnée PEUT être fondé ─────
//
// ██  Ce n'est PAS une liste noire de noms de champs.                      ██
//
// La table ne dit jamais « `note` est interdit ». Elle dit : « pour CE chemin
// (table, colonne), voici la décision de publication qui pourrait le fonder —
// ou il n'en existe aucune ».
//
// La différence est la mesure qui fonde tout ce lot : `KolTokenLink.note`
// porte tour à tour un STATE de workflow (TOESCOIN : « Internal review
// pending — not public, not legal-reviewed »), une ASSERTION nominative
// (BOTIFY : « Dad wallet received full supply allocation and dumped »), une
// OBSERVATION factuelle (DIONE : adresses de contrats, dates de migration) et
// du JSON de seed brut (BULLISH : `seededFrom: bullish_seed_2026-05-14`).
//
// UN MÊME NOM, QUATRE NATURES. Une liste noire se serait trompée trois fois
// sur quatre. Ce qui est indexé ici, c'est le CHEMIN — donc la provenance —
// et la nature se déclare à la construction de l'unité.
//
// ─── `null` EST UNE MESURE, PAS UNE POLITIQUE ───────────────────────────
//
// Chaque `null` ci-dessous a été vérifié dans `prisma/schema.prod.prisma` :
// la table ne porte AUCUNE colonne de décision. Ce n'est pas « on a décidé de
// ne pas publier », c'est « il n'existe rien qui puisse l'autoriser ».
// Un refus, pas une qualification.

import type { ReferentielDeDecision } from "./uniteGouvernee";

/** Un chemin de donnée, nommé par (table ou forme, colonne). */
export type CheminDeDonnee =
  // ── Aucune fondation possible ──────────────────────────────────────────
  /** `KolCase` ne porte ni publishStatus, ni visibility, ni isPublic. */
  | "KolCase.evidence"
  /** `KolTokenLink.visibility` autorise le LIEN, jamais la prose de la note.
   *  Mesuré : 9 dossiers « launch » sur 9 portent du contenu interne. */
  | "KolTokenLink.note"
  /** Le graphe est un JSON statique commité. Aucune ligne de décision
   *  n'existe à son sujet, nulle part. */
  | "NetworkNode.notes"
  | "NetworkEdge.label"
  /** Narration libre et datée : « BK Mom begins 10-week GHOST cashout
   *  ($5,207, 26 tx) », « Djordje Stupar (@planted) admits… ». Même classe
   *  que `NetworkNode.notes`, cinquième porteur. */
  | "NetworkGraph.timeline"
  /** Montants PAR SUJET NOMMÉ (`totalScammedUsd_bkokoski`) — la classe que
   *  `KolProfile.proceedsPublication` gouverne ailleurs, ici sans aucune
   *  décision. Plus `personCount`, qui trahirait la taille de l'ensemble
   *  retiré. */
  | "NetworkGraph.metrics"
  /** Métadonnée d'ingénierie servie : « INTERLIGENS prod DB (5 profiles,
   *  29 evidences, 47 wallets…) ». Même classe que C1. */
  | "NetworkGraph.sourceOfTruth"
  /** Un MONTANT ENCAISSÉ par un sujet nommé, porté directement sur le nœud
   *  (`totalScammedUsd: 4500000` sur `bkokoski`). Les proceeds relèvent de
   *  `KolProfile.proceedsPublication` — une décision DISTINCTE de
   *  `publishStatus`. Un sujet publié n'a pas, par ce seul fait, ses montants
   *  publiés : c'est ce que `proceedsGate` tient partout ailleurs. Le graphe
   *  n'a aucun moyen de présenter cette décision-là. */
  | "NetworkNode.totalScammedUsd"
  /** L'appartenance à la Watchlist : `handlesV2` est un tableau TypeScript
   *  écrit à la main. Il n'y a pas de magasin où lire une décision. */
  | "Watchlist.appartenance"
  // ── Fondation possible ─────────────────────────────────────────────────
  | "KolProfile.displayName"
  | "KolProfile.tier"
  | "PlatformCaseFile.summary";

const FONDATION: Record<CheminDeDonnee, ReferentielDeDecision | null> = {
  "KolCase.evidence": null,
  "KolTokenLink.note": null,
  "NetworkNode.notes": null,
  "NetworkEdge.label": null,
  "NetworkGraph.timeline": null,
  "NetworkGraph.metrics": null,
  "NetworkGraph.sourceOfTruth": null,
  "NetworkNode.totalScammedUsd": null,
  "Watchlist.appartenance": null,
  "KolProfile.displayName": "KolProfile.publishStatus",
  "KolProfile.tier": "KolProfile.publishStatus",
  "PlatformCaseFile.summary": "PlatformCaseFile.publishStatus",
};

export function fondationPossiblePour(chemin: CheminDeDonnee): ReferentielDeDecision | null {
  return FONDATION[chemin];
}

/** Les chemins dont aucune décision ne peut jamais autoriser le contenu. */
export function cheminsSansFondationPossible(): readonly CheminDeDonnee[] {
  return (Object.keys(FONDATION) as CheminDeDonnee[]).filter((c) => FONDATION[c] === null);
}
