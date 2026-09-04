// --- F0 — LE MODÈLE D'ARÊTE DE FINANCEMENT --------------------------------
//
// Une arête est un FAIT : « cette adresse a envoyé ce montant à cette adresse,
// dans cette transaction, à cet instant ». Rien d'autre n'y entre.
//
// ─── CE QUE LES CHAMPS DOIVENT À LA DONNÉE RÉELLE ────────────────────────
//
// Mesuré sur les 269 transferts natifs traversés par la collecte P0 (sujet #1,
// sink du 2026-09-04) : `fromUserAccount`, `toUserAccount` et `amount` sont
// présents sur 269/269 ; `signature` et `timestamp` sur 269/269 au niveau de la
// transaction. Aucun champ n'est optionnel dans les faits, donc aucun n'est
// optionnel ici.
//
// ██ `asset` N'EST PAS LU — IL EST CONSTITUTIF. ██ Un transfert NATIF est du
// SOL par définition du champ qui le porte ; il n'existe aucun `mint` sur
// `nativeTransfers`. Le figer à "SOL" dit donc ce qui est vrai, tandis qu'un
// champ « lu » laisserait croire à une provenance qui n'existe pas.
//
// ██ LE MONTANT RESTE EN LAMPORTS. ██ La donnée est un entier de lamports
// (mesuré : 269/269 entiers). Le nommer `amount` inviterait la lecture « SOL »
// et un facteur 10⁹ passerait inaperçu — le nom porte donc l'unité. Aucune
// conversion n'est faite ici : convertir, c'est déjà interpréter.

/** Le nom de l'unité, pour que personne n'ait à le deviner. */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * ██ NATURE — R1/R2. ██ Une arête est une OBSERVATION PRIMAIRE et ne peut pas
 * être autre chose. Toute lecture de coordination est une INFERENCE, produite
 * ailleurs, sur une base traçable, et jamais automatiquement. Le type l'impose
 * plutôt que la convention : il n'y a pas d'autre valeur assignable.
 */
export const FUNDING_EDGE_NATURE = "PRIMARY_OBSERVATION" as const;
export type FundingEdgeNature = typeof FUNDING_EDGE_NATURE;

export const FUNDING_GRAPH_RULE_VERSION = "funding-graph/edges@v1";

/**
 * Un transfert natif, tel que l'API le rend.
 * Aligné sur `NativeTransfer` (src/lib/solanaGraph/types.ts) — mêmes champs,
 * mêmes noms. Deux formes divergentes auraient fini par diverger de sens.
 */
export interface NativeTransferInput {
  fromUserAccount: string;
  toUserAccount: string;
  /** Lamports. Entier. */
  amount: number;
}

/** La transaction qui porte les transferts, réduite à ce que l'arête en tire. */
export interface TransferBearingTx {
  signature: string;
  /** Unix secondes, UTC. L'instant absolu, jamais une heure murale. */
  timestamp: number;
  nativeTransfers?: readonly NativeTransferInput[];
}

/**
 * L'ARÊTE. Un transfert constaté, et sa preuve.
 *
 * `txSignature` + `blockTimeSeconds` ne sont pas décoratifs : ils sont ce qui
 * rend l'arête vérifiable par un tiers sur la chaîne. Une arête sans preuve
 * opposable ne serait plus une observation, seulement une affirmation.
 */
export interface FundingEdge {
  fromWallet: string;
  toWallet: string;
  asset: "SOL";
  amountLamports: number;
  txSignature: string;
  /** Unix secondes, UTC. */
  blockTimeSeconds: number;
  rowNature: FundingEdgeNature;
}
