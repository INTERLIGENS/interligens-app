// --- D/M1 - LE COLLECTEUR DE LA FENETRE TEMOIN ----------------------------
//
// ═══ INVARIANT SHILL-M1 - INTEGRITE DU TEMOIN ═══════════════════════════════
//
//   1. SEPARATION TEMPORELLE. Un temoin doit etre temporellement separe de la
//      fenetre comportementale. Un temoin qui la recouvre se compare a
//      lui-meme et tend mecaniquement vers 1 : ce n'est pas un lift faible,
//      c'est un lift qui ne mesure rien.
//
//   2. INTEGRALITE DANS LES BORNES AUTORISEES. Un temoin qui ne peut pas etre
//      mesure INTEGRALEMENT dans les bornes autorisees (budget d'appels,
//      plafond de pages) rend NOT_MEASURABLE. Jamais extrapole, jamais
//      complete, jamais presente comme comparable.
//
//   3. EXISTENCE DE L'OBJET MESURE. Un temoin anterieur a la premiere
//      transaction du token ne mesure pas « zero achat » : il mesure le vide.
//      Il rend NOT_MEASURABLE sous son propre motif.
//
// POURQUOI 2 ET 3 NE SE CONFONDENT PAS AVEC UN TEMOIN VIDE : un temoin vide
// est le denominateur le plus FAVORABLE qui soit. Extrapoler, completer ou
// simplement laisser passer un vide non constate produit un lift trop grand,
// donc un candidat sur-classe - et c'est l'instrument qui l'a produit, pas le
// comportement du wallet. La direction de l'erreur n'est pas neutre : elle
// flatte le produit. C'est ce qui rend cet invariant non negociable.
//
// Tenu par : ce module (etats + troncature), tally.ts (relevement), features.ts
// (ordre des refus), et __tests__/baseline.test.ts.
// ════════════════════════════════════════════════════════════════════════════
//
// ██  ETAT : CONSTRUIT, NON ARME. AUCUN APPEL HELIUS REEL N'A ETE PASSE.  ██
//
// Ce module orchestre la collecte de la fenetre TEMOIN d'une occasion. Il ne
// contient aucun client HTTP : le fetch lui est INJECTE. Tant que le cout n'est
// pas valide (voir cost.ts et le tableau rendu au fondateur), il n'est cable a
// aucun cron et aucune cle Helius ne le traverse.
//
// ─── CE QUE M1 COUTE, ET POURQUOI CE N'EST PAS « UN FETCH DE PLUS » ───────
//
// L'API Enhanced de Helius N'A PAS DE SEEK TEMPOREL (helius.ts, angle mort 1) :
// on ne peut pas demander « les transactions du 3 juin a 18h ». On pagine en
// arriere depuis MAINTENANT, 100 tx par appel, jusqu'a franchir le debut de la
// fenetre visee. Le cout d'une fenetre ne depend donc PAS de sa largeur, mais
// de TOUT CE QUI S'EST PASSE DEPUIS.
//
// Consequence directe, et c'est le coeur du chiffrage :
//
//   fenetre observee   : [tweet-600s, tweet+900s]
//   fenetre temoin     : [tweet-offset-600s, tweet-offset+900s]   (offset=24h)
//
// La fenetre temoin est PLUS ANCIENNE que l'observee. Sur un parcours arriere
// contigu, tout chemin qui atteint le temoin a DEJA traverse l'observee. Les
// deux fenetres se collectent donc en UN SEUL parcours, et l'increment
// imputable a M1 n'est pas « un second fetch » : ce sont les pages de l'ECART
// entre les deux fenetres. C'est ce que `plannedIncrementalPages` mesure, et
// c'est la seule quantite que le chiffrage a le droit d'appeler « le cout de
// M1 ». Compter deux fetchs complets doublerait un cout qui n'est pas double.
//
// ─── LA REGLE DU BUDGET : PAS DE DEGRADATION SILENCIEUSE ─────────────────
//
// Quand le budget d'appels du run est atteint, ce module ne rend JAMAIS un
// temoin partiel presente comme comparable. Il rend un etat qui force le lift
// a NOT_MEASURABLE avec le motif BASELINE_CENSORED :
//
//   budget epuise AVANT la premiere page  -> baselineState 'budget_exhausted'
//   budget epuise EN COURS de pagination  -> etat reel + baselineTruncatedBy
//
// Les deux chemins aboutissent au meme refus, par deux routes differentes :
// le premier via `buildBaselineSide` (qui remonte la troncature sans compter
// l'occasion comme mesuree), le second via `censoredMeasurement` et
// `compareToThreshold` -> `indeterminate`. Aucun des deux ne produit un
// nombre utilisable comme denominateur.
//
// UN TEMOIN TRONQUE EST PIRE QU'UN TEMOIN ABSENT. Absent, le lift est refuse.
// Tronque et tu par un remplissage, il fait un denominateur TROP PETIT, donc
// un lift TROP GRAND, donc un candidat sur-classe - et c'est le budget, pas le
// comportement du wallet, qui l'a produit.

import { baselineIsDisjoint, baselineWindow, zoneForDelta } from "./windows";
import type { OnChainInstant } from "./anchor";
import type { EnginePolicy } from "./policy";
import type { BaselineBuy, BaselineState } from "./types";

/** Ce que le collecteur a besoin de savoir d'une occasion. Rien de plus. */
export interface BaselineCollectionTarget {
  occasionId: string;
  kolHandle: string;
  /** Adresse base58 resolue. Un ticker non resolu ne peut pas etre collecte. */
  mint: string | null;
  chain: string;
  /**
   * ANCRE ON-CHAIN, pas un timestamp du corpus. `ShillEvent.tweetTimestamp`
   * stocke une heure murale parisienne dans une colonne UTC (mesure du
   * 2026-09-03 : ecart constant, variance nulle). Le passer directement
   * decalait CHAQUE fenetre de 2 h - le type l'interdit desormais.
   * Voir anchor.ts, `onChainAnchorFromCorpus`.
   */
  observedAt: OnChainInstant;
}

/** Une transaction, reduite a ce que la collecte temoin en lit. */
export interface BaselineTx {
  signature: string;
  /** Unix secondes. */
  timestamp: number;
  type: string;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint: string;
    tokenAmount: number;
  }>;
}

/**
 * Le fetch, INJECTE. Rend une page et dit si l'historique est epuise.
 * Sa signature impose le curseur `before` : c'est le seul mode de pagination
 * que l'API offre, et le taire ici laisserait croire a un seek possible.
 */
export type BaselinePageFetcher = (args: {
  mint: string;
  before: string | undefined;
  limit: number;
}) => Promise<BaselineTx[]>;

/**
 * LE BUDGET D'APPELS DU RUN, partage par toutes les occasions.
 *
 * Mutable a dessein : un budget par occasion ne borne rien au niveau du run,
 * et c'est le run qui est facture. `spend()` rend false quand il n'y a plus
 * rien - l'appelant DOIT le lire, il n'y a pas de mode « on continue quand
 * meme ».
 */
export interface CallBudget {
  readonly limit: number;
  spent(): number;
  remaining(): number;
  /** Consomme un appel. `false` = refuse, budget epuise. */
  spend(): boolean;
}

export function createCallBudget(limit: number): CallBudget {
  let spent = 0;
  return {
    limit,
    spent: () => spent,
    remaining: () => Math.max(0, limit - spent),
    spend: () => {
      if (spent >= limit) return false;
      spent++;
      return true;
    },
  };
}

/** Ce que la troncature nomme. Une chaine stable : elle finit en base. */
export const BUDGET_TRUNCATION_REASON = "helius_run_call_budget";
export const PAGE_TRUNCATION_REASON = "helius_page_budget";

export interface BaselineCollectionResult {
  occasionId: string;
  baselineState: BaselineState;
  baselineBuys: BaselineBuy[];
  baselineTruncatedBy: string | null;
  baselineStateDetail: string | null;
  /** Appels reellement consommes par CETTE occasion. */
  callsSpent: number;
  /** Pages traversees qui ne concernaient NI l'une NI l'autre fenetre. */
  pagesDiscarded: number;
  /** La fenetre a-t-elle ete atteinte et depassee ? */
  windowCovered: boolean;
  /**
   * SHILL-M1 §3. `true` = l'historique complet du token a ete vu et sa
   * premiere transaction est POSTERIEURE a la fenetre temoin : le temoin
   * precede l'existence du token. `null` = indeterminable (historique non
   * epuise), et alors ce n'est PAS un constat.
   */
  baselinePrecedesTokenExistence?: boolean | null;
}

/** La plus ancienne transaction vue sur l'ensemble du parcours. */
function inWindowOldest(txs: readonly BaselineTx[]): number | null {
  let min: number | null = null;
  for (const t of txs) if (min == null || t.timestamp < min) min = t.timestamp;
  return min;
}

export interface CollectBaselineOptions {
  fetchPage: BaselinePageFetcher;
  budget: CallBudget;
  /**
   * Override du plafond par occasion. RESERVE AUX TESTS : en production la
   * valeur vient de `policy.baselineMaxPagesPerOccasion`, qui est versionnee.
   */
  maxPagesPerOccasion?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 100;

/**
 * Collecte la fenetre temoin d'UNE occasion.
 *
 * Ne collecte pas la fenetre d'observation : elle est deja collectee ailleurs
 * (v1, buyers.ts). Ce module ne double donc pas un travail existant - il
 * PROLONGE le parcours arriere jusqu'a la fenetre temoin.
 */
export async function collectBaselineWindow(
  target: BaselineCollectionTarget,
  policy: EnginePolicy,
  opts: CollectBaselineOptions,
): Promise<BaselineCollectionResult> {
  const base = {
    occasionId: target.occasionId,
    baselineBuys: [] as BaselineBuy[],
    callsSpent: 0,
    pagesDiscarded: 0,
    windowCovered: false,
  };

  // 0. Le dispositif doit etre valide AVANT de depenser quoi que ce soit. Un
  //    temoin qui recouvre l'observation se comparerait a lui-meme : le
  //    collecter serait payer pour un chiffre qui ne mesure rien.
  if (!baselineIsDisjoint(policy)) {
    return {
      ...base,
      baselineState: "not_collected",
      baselineTruncatedBy: null,
      baselineStateDetail:
        `decalage temoin (${policy.baselineOffsetSeconds}s) <= largeur de fenetre : ` +
        "les deux fenetres se recouvrent, aucune collecte n'est engagee",
    };
  }

  // 1. Un ticker non resolu n'a pas d'adresse a interroger. Ce n'est pas un
  //    echec de collecte : il n'y avait rien a collecter.
  if (!target.mint) {
    return {
      ...base,
      baselineState: "not_collected",
      baselineTruncatedBy: null,
      baselineStateDetail: "mint non resolu - aucune adresse a interroger",
    };
  }

  const win = baselineWindow(target.observedAt, policy);
  const startSec = Math.floor(win.startMs / 1000);
  const endSec = Math.floor(win.endMs / 1000);
  // SHILL-M1 : le plafond vient de la POLICY, pas d'une constante de module.
  // L'override d'options n'existe que pour les tests ; en production c'est la
  // policy qui decide, et elle est versionnee avec le reste.
  const maxPages = opts.maxPagesPerOccasion ?? policy.baselineMaxPagesPerOccasion;
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  // 2. LE BUDGET REFUSE AVANT LA PREMIERE PAGE. Etat distinct, et c'est tout
  //    l'objet de `budget_exhausted` : « on a demande, le budget a refuse »
  //    n'est pas « personne n'a demande ».
  if (opts.budget.remaining() === 0) {
    return {
      ...base,
      baselineState: "budget_exhausted",
      baselineTruncatedBy: BUDGET_TRUNCATION_REASON,
      baselineStateDetail: `budget de run epuise (${opts.budget.limit} appels) avant la premiere page`,
    };
  }

  const inWindow: BaselineTx[] = [];
  const allSeen: BaselineTx[] = [];
  let historyExhausted = false;
  let before: string | undefined;
  let pages = 0;
  let calls = 0;
  let discarded = 0;
  let truncatedBy: string | null = null;
  let covered = false;
  let failed: string | null = null;

  while (pages < maxPages) {
    if (!opts.budget.spend()) {
      truncatedBy = BUDGET_TRUNCATION_REASON;
      break;
    }
    calls++;

    let page: BaselineTx[];
    try {
      page = await opts.fetchPage({ mint: target.mint, before, limit: pageSize });
    } catch (e) {
      // Un echec n'est PAS un vide. On le nomme, et le lift le refusera.
      failed = e instanceof Error ? e.message : String(e);
      break;
    }
    pages++;

    if (page.length === 0) {
      covered = true; // historique epuise : la fenetre est integralement vue
      historyExhausted = true;
      break;
    }
    allSeen.push(...page);

    let usable = 0;
    for (const tx of page) {
      if (tx.timestamp >= startSec && tx.timestamp <= endSec) {
        inWindow.push(tx);
        usable++;
      }
    }
    // Les pages entierement hors fenetre sont le PRIX du seek absent. Les
    // compter les rend visibles au chiffrage plutot que noyees dans un total.
    if (usable === 0) discarded++;

    const last = page[page.length - 1];
    before = last.signature;
    if (last.timestamp < startSec) {
      covered = true;
      break;
    }
  }

  if (!covered && truncatedBy == null && failed == null && pages >= maxPages) {
    truncatedBy = PAGE_TRUNCATION_REASON;
  }

  if (failed != null) {
    return {
      ...base,
      baselineState: "collect_error",
      baselineTruncatedBy: truncatedBy,
      baselineStateDetail: `echec de collecte : ${failed}`,
      callsSpent: calls,
      pagesDiscarded: discarded,
      windowCovered: false,
    };
  }

  const buys = extractBaselineBuys(inWindow, target.mint, win.anchorMs / 1000, target.chain);

  // SHILL-M1 §3. L'anteriorite n'est un CONSTAT que si l'historique a ete
  // epuise : c'est le seul cas ou « aucune transaction plus ancienne » signifie
  // « le token n'existait pas », et non « on a arrete de regarder ».
  const oldestSeen = inWindowOldest(allSeen);
  const precedesExistence =
    historyExhausted && oldestSeen != null && oldestSeen > endSec ? true : historyExhausted ? false : null;

  // 3. UN VIDE N'EST UNE MESURE QUE SI LA FENETRE A ETE VUE EN ENTIER.
  //    Zero achat sur une fenetre tronquee n'est pas « zero achat » : c'est
  //    « zero achat DANS CE QU'ON A REGARDE ». La distinction est exactement
  //    celle que SHILL-C1 impose, et la confondre produirait le denominateur
  //    le plus faux possible.
  const state: BaselineState =
    buys.length > 0 ? "collected_with_buys" : covered ? "collected_empty" : "budget_exhausted";

  return {
    occasionId: target.occasionId,
    baselineState: state,
    baselineBuys: buys,
    baselinePrecedesTokenExistence: precedesExistence,
    baselineTruncatedBy: truncatedBy,
    baselineStateDetail:
      truncatedBy != null
        ? `collecte bornee apres ${pages} page(s) : ${truncatedBy}`
        : `fenetre couverte en ${pages} page(s)`,
    callsSpent: calls,
    pagesDiscarded: discarded,
    windowCovered: covered,
  };
}

/**
 * Meme extraction que la fenetre d'observation, ancree sur l'image DECALEE.
 *
 * L'ancre est celle du temoin, pas celle du tweet : une zone calculee contre
 * le tweet donnerait a chaque achat temoin un delta de -24h, donc `null`, donc
 * un temoin systematiquement vide. Le temoin doit etre lu comme si la
 * publication avait eu lieu a son ancre - c'est le sens meme d'un groupe de
 * controle.
 */
export function extractBaselineBuys(
  txs: readonly BaselineTx[],
  mint: string,
  anchorSeconds: number,
  chain: string,
): BaselineBuy[] {
  const earliest = new Map<string, { ts: number; sig: string }>();

  for (const tx of txs) {
    for (const t of tx.tokenTransfers ?? []) {
      if (t.mint !== mint) continue;
      const wallet = t.toUserAccount;
      if (!wallet || !(t.tokenAmount > 0)) continue;
      const prev = earliest.get(wallet);
      if (!prev || tx.timestamp < prev.ts) {
        earliest.set(wallet, { ts: tx.timestamp, sig: tx.signature });
      }
    }
  }

  const buys: BaselineBuy[] = [];
  for (const [wallet, acq] of earliest) {
    const delta = acq.ts - anchorSeconds;
    const z = zoneForDelta(delta);
    if (!z) continue; // hors fenetre : la page en contenait, pas la fenetre
    buys.push({
      wallet,
      chain,
      deltaSecondsFromBaselineAnchor: delta,
      firstBuyTxSignature: acq.sig,
      // Aucun flux de prix historique cable ici - le taire vaut mieux que
      // l'inventer. Meme choix qu'en PHASE 3 (buyers.ts).
      entryAmountUsd: null,
    });
  }

  buys.sort((a, b) => a.deltaSecondsFromBaselineAnchor - b.deltaSecondsFromBaselineAnchor);
  return buys;
}
