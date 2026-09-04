// --- F1 — LA PHOTO DE FINANCEMENT ------------------------------------------
//
// PURE. Elle ne collecte rien : on lui donne des transactions DÉJÀ collectées
// et la liste des sujets, elle rend ce que ces transactions établissent.
//
// ─── POURQUOI LES SUJETS SONT UN PARAMÈTRE, ET NON DÉDUITS ICI ───────────
//
// « Qui est un acheteur » est une question de sémantique de token — quel mint,
// quelle fenêtre, quelle ancre. La faire entrer ici obligerait ce module à
// connaître les mints, les ancres et les fenêtres, et à importer la couche qui
// les définit. Le graphe de financement resterait alors juste tant que cette
// couche resterait juste.
//
// L'appelant nomme ses sujets ; ce module dit ce que les transferts en disent.
// C'est ce qui le rend réutilisable par PRE-SHILL-STRUCTURAL comme par
// Coordinated Exit, sans qu'aucun des deux n'hérite des définitions de l'autre.
//
// ██ COÛT MARGINAL NUL. ██ Les transferts natifs voyagent déjà dans les pages
// que la collecte P0 paie pour les acquisitions. Les lire une seconde fois ne
// coûte aucun appel : la photo est un sous-produit, pas une collecte.
//
// ─── CE QUE LA PHOTO PEUT VOIR, ET CE QU'ELLE NE VERRA JAMAIS ────────────
//
// Mesuré sur le sujet #1 (2026-09-04) : sur 29 acquéreurs du token, 10 seulement
// apparaissent comme destinataires de SOL dans les transferts collectés, et
// aucun bailleur n'en touche deux.
//
// La cause est structurelle, pas accidentelle. Une collecte cadrée sur un MINT
// rend les transactions qui touchent ce mint ; les transferts SOL qu'on y voit
// sont ceux qui accompagnent ces transactions — frais, routage de swap. Le
// financement RÉEL d'un wallet — un envoi depuis un exchange, des jours plus
// tôt, sans rapport avec ce token — n'y figure par construction jamais.
//
// Une photo tirée de cette source est donc PARTIELLE PAR CONSTRUCTION, et son
// `NOT_OBSERVED` porte d'autant moins. `edgesConsidered` dit sur quoi
// l'observation a porté : c'est ce chiffre, et non l'absence, qui doit être lu.
// Atteindre le financement réel demanderait une collecte par WALLET — un autre
// coût, une autre phase.
//
// AUCUN LABEL. La photo compte des arêtes et nomme des bailleurs. Elle ne dit
// pas ce que cela signifie — cette lecture est une INFERENCE, produite
// ailleurs, sur une base traçable, et jamais par le module qui constate.

import { buildFundingEdges, type BuildEdgesResult } from "./edges";
import { sharedFunder, type SharedFunderObservation } from "./sharedFunder";
import { FUNDING_EDGE_NATURE, type FundingEdge, type TransferBearingTx } from "./types";

export const FUNDING_SNAPSHOT_RULE_VERSION = "funding-graph/snapshot@v1";

/**
 * La structure des bailleurs observés — un DÉCOMPTE, pas une lecture.
 *
 * La séparation `amongSubjects` / `external` n'est pas cosmétique : un sujet
 * qui en finance deux autres et un tiers qui les finance tous les deux sont
 * deux faits différents. Les additionner produirait un nombre dont personne ne
 * pourrait dire ce qu'il compte.
 */
export interface FunderStructure {
  observedFunders: number;
  amongSubjects: number;
  external: number;
}

export interface FundingSnapshot {
  ruleVersion: string;
  rowNature: typeof FUNDING_EDGE_NATURE;
  /** Les sujets tels que l'appelant les a nommés, dédupliqués. */
  subjects: string[];
  edges: {
    transfersSeen: number;
    kept: number;
    skipped: BuildEdgesResult["skipped"];
  };
  sharedFunder: SharedFunderObservation;
  /** `null` quand rien n'a été observé — un décompte de rien n'est pas zéro. */
  funderStructure: FunderStructure | null;
}

export interface FundingSnapshotInput {
  /** Les wallets dont on veut la photo. Nommés par l'appelant. */
  subjects: readonly string[];
  /** Transactions DÉJÀ collectées. Aucune n'est demandée au réseau. */
  txs: readonly TransferBearingTx[];
}

/**
 * Construit la photo de financement à partir de transactions déjà en main.
 *
 * Rend aussi les arêtes brutes : la photo doit pouvoir être recontrôlée sur
 * ses propres pièces, sans refaire l'extraction.
 */
export function buildFundingSnapshot(
  input: FundingSnapshotInput,
): FundingSnapshot & { edgeList: FundingEdge[] } {
  const built = buildFundingEdges(input.txs);
  const observation = sharedFunder(input.subjects, built.edges);

  const funderStructure: FunderStructure | null = observation.observed
    ? {
        observedFunders: observation.funders.length,
        amongSubjects: observation.funders.filter((f) => f.funderIsAmongSubjects).length,
        external: observation.funders.filter((f) => !f.funderIsAmongSubjects).length,
      }
    : null;

  return {
    ruleVersion: FUNDING_SNAPSHOT_RULE_VERSION,
    rowNature: FUNDING_EDGE_NATURE,
    subjects: observation.subjects,
    edges: {
      transfersSeen: built.transfersSeen,
      kept: built.edges.length,
      skipped: built.skipped,
    },
    sharedFunder: observation,
    funderStructure,
    edgeList: built.edges,
  };
}
