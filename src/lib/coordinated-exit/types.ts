// --- BUILD 6 / F0 — LE MODÈLE D'ÉVÉNEMENT DE SORTIE -----------------------
//
// ██ DEUX TYPES, ET ILS NE SE DÉDUISENT PAS L'UN DE L'AUTRE ██
//
//   OUTGOING_TRANSFER  le sujet a envoyé le token hors de son wallet
//   SELL               le sujet a échangé le token contre un autre actif
//
// Un transfert sortant N'EST PAS une vente. Il peut aller vers un second
// wallet du même acteur, vers un dépôt d'exchange, vers un contrat, vers un
// ami. Traiter l'un comme l'autre transformerait un déplacement en cession —
// et c'est exactement l'affirmation qui, en aval, ferait la différence entre
// « ce wallet a bougé ses tokens » et « ce wallet a encaissé ».
//
// SELL exige donc une PREUVE TRANSACTIONNELLE : dans LA MÊME transaction
// atomique, le sujet sort le mint ET reçoit un autre actif. Ce n'est pas une
// heuristique sémantique, c'est la structure de l'échange. Rien d'autre ne
// vaut preuve — pas le type déclaré par l'indexeur, pas le nom du programme,
// pas un `events.swap` présent sur 10 transactions sur 100 (mesuré le
// 2026-09-04 sur le corpus P0).
//
// ─── CE QUE F0 NE FAIT JAMAIS ────────────────────────────────────────────
//
// F0 OBSERVE. Il établit « A sort X à T1, B sort Y à T2, écart N secondes ».
// Il ne conclut ni coordination, ni dump, ni rug, ni intention. Aucun score,
// aucun label, aucun verdict — ces lectures sont des INFÉRENCES, produites
// ailleurs, sur une base traçable, et jamais automatiquement.

/** Nature d'un ExitEvent. Il n'y en a pas d'autre : un acte constaté. */
export const EXIT_EVENT_NATURE = "PRIMARY_OBSERVATION" as const;
export type ExitEventNature = typeof EXIT_EVENT_NATURE;

export const COORDINATED_EXIT_EXTRACT_VERSION = "coordinated-exit/extract@v1";

export type ExitEventType = "OUTGOING_TRANSFER" | "SELL";

/**
 * Comment le type a été DÉMONTRÉ. Voyage avec l'événement : un lecteur doit
 * pouvoir contester la classification sans relire le code.
 */
export interface EvidenceProvenance {
  /** La règle qui a tranché, nommée. */
  rule: typeof COORDINATED_EXIT_EXTRACT_VERSION;
  /**
   * `swap_counter_asset_same_tx` — le sujet a reçu un autre actif DE LA
   *   CONTREPARTIE qui a reçu le mint, dans la même transaction. Seule base
   *   d'un SELL.
   * `token_leaves_wallet_no_counter_asset` — le mint sort, rien ne rentre.
   * `counterparty_rejected_rent_recovery` — un actif est bien rentré, mais il
   *   provient d'un COMPTE DE TOKEN qui se ferme : c'est la récupération d'un
   *   loyer, pas le produit d'un échange. L'événement retombe en transfert.
   * `counterparty_rejected_provenance_undemonstrated` — un actif est rentré,
   *   mais d'une source qui n'a PAS reçu le mint du sujet. Le lien d'échange
   *   n'est pas démontré, donc il n'est pas affirmé. FAIL-CLOSED.
   */
  basis:
    | "swap_counter_asset_same_tx"
    | "token_leaves_wallet_no_counter_asset"
    | "counterparty_rejected_rent_recovery"
    | "counterparty_rejected_provenance_undemonstrated";
  /** Le programme qui a exécuté, tel que la source le déclare. Jamais deviné. */
  source: string | null;
  /** Le type déclaré par l'indexeur — RAPPORTÉ, jamais utilisé comme preuve. */
  indexerType: string | null;
}

/**
 * ██ CE QUE `observedCounterparty*` DIT, ET CE QU'IL NE DIT PAS ██
 *
 * Le nom `proceeds` a été retiré : il se lisait comme « produit de la vente »,
 * et invitait à en faire une base de calcul de plus-value. Mesuré le
 * 2026-09-05 sur le corpus VINE : dans 30 échanges sur 453, le sujet reçoit
 * l'actif de contrepartie PLUSIEURS fois dans la même transaction. Le champ
 * n'en porte qu'une occurrence — celle qui démontre l'échange.
 *
 * C'est donc une CONTREPARTIE OBSERVÉE, attribuée à l'échange démontré. Ce
 * n'est pas le total encaissé, et un P&L bâti dessus serait faux.
 */
export const OBSERVED_COUNTERPARTY_MEANING =
  "Directly observed counterparty asset attributed to the demonstrated exchange. " +
  "NOT a guarantee of total proceeds — a transaction may return the asset several times. " +
  "NEVER usable alone for P&L.";

/**
 * UN ACTE DE SORTIE CONSTATÉ.
 *
 * `destination`, `venue` et `observedCounterparty*` sont NULLABLES par
 * conception. Ils ne
 * sont renseignés que lorsque la transaction les démontre :
 *
 *   destination  un seul destinataire du mint. Plusieurs ⇒ null : dire lequel
 *                serait choisir.
 *   venue        le programme déclaré, quand il est nommé. `UNKNOWN` ⇒ null.
 *   observedCounterparty*  l'actif reçu de la contrepartie de l'échange.
 *                Absent ⇒ null, jamais 0 — zéro affirmerait qu'on a mesuré
 *                une contrepartie nulle.
 */
export interface ExitEvent {
  subjectWallet: string;
  mint: string;
  type: ExitEventType;
  /** Quantité sortie. bigint, strictement > 0. */
  amount: bigint;
  /** Unix secondes, UTC — le block time, tel quel. Aucune compensation. */
  blockTimeSeconds: number;
  txSignature: string;
  destination: string | null;
  venue: string | null;
  /** Mint reçu, ou `native` pour du SOL. `null` si aucun échange démontré. */
  observedCounterpartyAsset: string | null;
  observedCounterpartyAmount: number | null;
  /** Le sens du champ voyage AVEC lui — voir OBSERVED_COUNTERPARTY_MEANING. */
  observedCounterpartyMeaning: string | null;
  rowNature: ExitEventNature;
  evidenceProvenance: EvidenceProvenance;
}

// ═══ L'ENTRÉE — une transaction, telle que l'extraction canonique la rend ══
//
// Aligné sur `HeliusTx` (src/lib/solanaGraph/types.ts) : mêmes champs, mêmes
// noms. F0 N'APPELLE PAS le réseau — il classe un ensemble FOURNI.

export interface ExitTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint: string;
  tokenAmount: number;
}
export interface ExitNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  /** Lamports. */
  amount: number;
}
/**
 * Le changement de solde d'un compte de token, tel que l'extraction canonique
 * le rend. Sert au GARDE : il nomme les comptes de TOKEN de la transaction, et
 * du SOL qui sort d'un compte de token est un loyer récupéré, pas un paiement.
 */
export interface ExitTokenBalanceChange {
  userAccount?: string;
  tokenAccount?: string;
  mint?: string;
}
export interface ExitCandidateTx {
  signature?: string;
  /** Unix secondes, UTC. */
  timestamp?: number;
  type?: string;
  source?: string;
  tokenTransfers?: readonly ExitTokenTransfer[];
  nativeTransfers?: readonly ExitNativeTransfer[];
  /** Optionnel : sans lui, le garde reste FAIL-CLOSED, il ne s'assouplit pas. */
  tokenBalanceChanges?: readonly ExitTokenBalanceChange[];
}
