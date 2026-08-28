// --- CORRECTNESS #1 - l'unite de comptage est l'OCCASION, pas l'evenement ---
//
// LE DEFAUT, MESURE
// `empire_sol1` publie deux tweets sur le MEME mint a 18:57 et 18:58. Chaque
// tweet cree un ShillEvent, et la fenetre d'analyse de chacun couvre
// [-10 min, +15 min] : les deux fenetres se recouvrent presque entierement.
// Les 452 memes acheteurs sont donc collectes deux fois, sous deux eventId.
//
// Consequence directe : `observedShillCount` (numerateur) ET
// `analyzableShillCount` (denominateur) comptent tous deux des doublons, et
// `ratioObserved` vaut mecaniquement 1,00 pour tout wallet present sur une
// paire redondante. Un ratio de 1,00 obtenu ainsi ne dit rien : il dit
// seulement que le meme achat a ete compte deux fois des deux cotes de la
// division.
//
// LE CORRECTIF
// Deux evenements du meme (kolHandle, tokenMint) dont les fenetres se
// recouvrent forment UNE occasion. Le recouvrement est transitif : trois
// tweets espaces de 10 min forment une seule occasion, pas deux.
//
// Deux fenetres [t1-pre, t1+post] et [t2-pre, t2+post] se recouvrent
// ssi |t2 - t1| < pre + post. Avec ANALYSIS_WINDOW (600 / 900) : 1500 s.

import { ANALYSIS_WINDOW } from "./types";

/** Ecart maximal entre deux tweets dont les fenetres se recouvrent encore. */
export const OCCASION_GAP_SECONDS =
  ANALYSIS_WINDOW.preSeconds + ANALYSIS_WINDOW.postSeconds; // 1500

export interface EventForOccasion {
  id: string;
  kolHandle: string;
  tokenMint: string | null;
  tweetTimestamp: Date;
}

export interface OccasionMapping {
  /** eventId -> occasionId. */
  occasionByEvent: Map<string, string>;
  /** occasionId -> eventIds qui le composent. */
  eventsByOccasion: Map<string, string[]>;
  /** Nombre d'evenements replies (events - occasions). */
  collapsed: number;
}

/**
 * Replie les evenements en occasions. Un evenement sans `tokenMint` ne peut pas
 * etre rapproche d'un autre : il reste sa propre occasion, jamais fusionne a
 * l'aveugle. C'est le cas des 29 evenements `unresolved_ticker` en production :
 * ne pas savoir de quel token il s'agit interdit de decider que c'est le meme.
 */
export function buildOccasions(events: EventForOccasion[]): OccasionMapping {
  const occasionByEvent = new Map<string, string>();
  const eventsByOccasion = new Map<string, string[]>();

  const groups = new Map<string, EventForOccasion[]>();
  for (const e of events) {
    // Sans mint : groupe singleton, cle portee par l'id lui-meme.
    const gk = e.tokenMint ? `${e.kolHandle}|${e.tokenMint}` : `|solo|${e.id}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push(e);
  }

  for (const [gk, list] of groups) {
    list.sort((a, b) => a.tweetTimestamp.getTime() - b.tweetTimestamp.getTime());
    let occasionId = "";
    let previousTs = -Infinity;
    for (const e of list) {
      const ts = e.tweetTimestamp.getTime();
      // Chainage transitif : on compare au tweet PRECEDENT, pas au premier de
      // l'occasion - trois tweets a 10 min d'intervalle forment une occasion.
      const continues = ts - previousTs < OCCASION_GAP_SECONDS * 1000;
      if (!continues) occasionId = `${gk}@${ts}`;
      occasionByEvent.set(e.id, occasionId);
      if (!eventsByOccasion.has(occasionId)) eventsByOccasion.set(occasionId, []);
      eventsByOccasion.get(occasionId)!.push(e.id);
      previousTs = ts;
    }
  }

  return {
    occasionByEvent,
    eventsByOccasion,
    collapsed: events.length - eventsByOccasion.size,
  };
}

/**
 * Cle de deduplication d'une observation A L'INTERIEUR d'une occasion.
 *
 * Quand deux evenements d'une meme occasion collectent le meme achat, c'est
 * litteralement la meme transaction on-chain : `firstBuyTxSignature` l'atteste.
 * A defaut de signature (colonne nullable), on retombe sur (wallet, chain) -
 * plus prudent : au pire on fusionne deux achats distincts du meme wallet dans
 * la meme occasion, ce qui reste la lecture voulue (« ce wallet a achete sur
 * cette occasion »), jamais l'inverse.
 */
export function observationDedupKey(o: {
  wallet: string;
  chain: string;
  firstBuyTxSignature: string | null;
}): string {
  return o.firstBuyTxSignature
    ? `tx|${o.firstBuyTxSignature}`
    : `wc|${o.wallet}|${o.chain}`;
}
