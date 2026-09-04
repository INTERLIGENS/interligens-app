// --- BUILD 4 / A — DÉTECTEUR FRONT-RUN --------------------------------
//
// ██ CE QUE CE DÉTECTEUR EST, ET CE QU'IL N'EST PAS ██
//
// Il s'appelle FRONT-RUN, pas « pre-shill ». La distinction n'est pas de
// vocabulaire : la fenêtre d'observation disponible fait DIX MINUTES
// (`ANALYSIS_WINDOW.preSeconds = 600`), et les 1 119 observations `pre_tweet`
// mesurées s'étalent de −600 s à −32 s. Rien au-delà, parce que rien n'a
// jamais collecté au-delà.
//
// Dix minutes avant, c'est un front-run. Une ACCUMULATION STRUCTURELLE —
// positionnement sur des heures ou des jours — est une autre question, qui
// demande une autre fenêtre et un autre budget. Elle s'appelle
// PRE-SHILL STRUCTURAL ACCUMULATION et n'est pas traitée ici.
//
// Confondre les deux ferait passer une mesure de front-run pour une preuve de
// préparation. Ce sont deux affirmations différentes sur le monde.
//
// ─── LA QUESTION, EXACTEMENT ──────────────────────────────────────────────
//
// Un wallet déjà vu en `pre_tweet` sur PLUSIEURS promotions réapparaît-il
// avant une promotion FUTURE plus souvent que la base ?
//
// « Future » est le mot qui porte le poids : le détecteur est entraîné sur des
// occasions antérieures à une date de coupure, et évalué sur les postérieures.
// Un wallet identifié après coup sur les mêmes données ne prédirait rien.
//
// PUR. Aucune écriture, aucun réseau, aucun Helius.

/**
 * ██ SEUILS FIGÉS AVANT LE BACKTEST ██
 *
 * Ils sont posés à partir de la seule distribution de récurrence, mesurée le
 * 2026-09-04 AVANT toute évaluation :
 *
 *   1 occasion  465 wallets      4 occasions   3
 *   2           276              5             4
 *   3            16              6/7/9         1 chacun
 *
 * MIN_OCCASIONS = 3. Deux occasions est le MODE de la distribution — 276
 * wallets, plus d'un tiers du total. Un seuil à 2 ne distingue donc rien : il
 * retiendrait la population ordinaire. Trois est le premier rang où la
 * récurrence cesse d'être explicable par deux achats indépendants sur un
 * marché où les mêmes wallets tradent les mêmes tokens.
 *
 * MIN_DISTINCT_KOLS = 2. Un wallet vu avant les posts d'un SEUL KOL a une
 * explication banale : il suit ce KOL, ou il est ce KOL. Exiger deux KOL
 * distincts écarte cette lecture sans rien supposer d'une coordination — ce
 * qui reste est un wallet positionné avant plusieurs sources indépendantes.
 *
 * ILS NE SERONT PAS AJUSTÉS APRÈS AVOIR VU LE RÉSULTAT. Un seuil choisi pour
 * que la métrique sorte bien ne mesure plus que lui-même.
 */
export const MIN_OCCASIONS = 3;
export const MIN_DISTINCT_KOLS = 2;

/** Version de règle, citable — deux évaluations sous deux seuils ne se comparent pas. */
export const FRONT_RUN_RULE_VERSION = "pre-shill/front-run@v1";

/** Une présence observée : ce wallet a acheté avant CE post. */
export interface PreTweetObservation {
  wallet: string;
  occasionId: string;
  kolHandle: string;
  /** Ancre de l'occasion — sert au découpage temporel, jamais au score. */
  observedAt: Date;
}

export interface WalletRecurrence {
  wallet: string;
  occasions: number;
  distinctKols: number;
  qualifies: boolean;
}

/**
 * Récurrence par wallet sur un ensemble d'occasions.
 *
 * Compte des occasions DISTINCTES, pas des observations : deux achats du même
 * wallet sur la même occasion sont un seul positionnement, et les compter deux
 * fois gonflerait la récurrence sans qu'aucun comportement ne se répète.
 */
export function computeRecurrence(
  observations: readonly PreTweetObservation[],
  minOccasions = MIN_OCCASIONS,
  minKols = MIN_DISTINCT_KOLS,
): Map<string, WalletRecurrence> {
  const occ = new Map<string, Set<string>>();
  const kols = new Map<string, Set<string>>();

  for (const o of observations) {
    if (!occ.has(o.wallet)) occ.set(o.wallet, new Set());
    if (!kols.has(o.wallet)) kols.set(o.wallet, new Set());
    occ.get(o.wallet)!.add(o.occasionId);
    kols.get(o.wallet)!.add(o.kolHandle);
  }

  const out = new Map<string, WalletRecurrence>();
  for (const [wallet, os] of occ) {
    const ks = kols.get(wallet)!.size;
    out.set(wallet, {
      wallet,
      occasions: os.size,
      distinctKols: ks,
      qualifies: os.size >= minOccasions && ks >= minKols,
    });
  }
  return out;
}

export interface BacktestResult {
  ruleVersion: string;
  thresholds: { minOccasions: number; minDistinctKols: number };
  split: { cutoff: string; trainOccasions: number; testOccasions: number };
  /** Wallets retenus par la règle SUR LE TRAIN seulement. */
  flagged: number;
  /** Tous les wallets vus en train — la population de référence. */
  trainWallets: number;
  /** Présences (wallet, occasion) observées en test, parmi les retenus. */
  flaggedHits: number;
  flaggedTrials: number;
  flaggedRate: number;
  /** Idem pour la population de référence : le taux de base. */
  baseHits: number;
  baseTrials: number;
  baseRate: number;
  /**
   * Rapport des deux taux. NON un verdict : une séparation mesurée sur un
   * corpus de cette taille est une piste, pas un résultat.
   */
  separation: number | null;
}

/**
 * BACKTEST OUT-OF-SAMPLE TEMPOREL.
 *
 * La règle est appliquée aux occasions ANTÉRIEURES à la coupure, et évaluée
 * sur les POSTÉRIEURES. Aucun wallet n'est retenu grâce à une occasion de
 * test : sans cette séparation, on mesurerait la capacité à décrire le passé.
 *
 * Le dénominateur est le nombre d'ESSAIS — (wallet, occasion de test) — et non
 * le nombre d'occasions. Un wallet ne peut être présent qu'aux occasions qui
 * lui sont offertes, et comparer deux populations de tailles différentes sur
 * un dénominateur commun fausserait le rapport.
 */
export function backtestFrontRun(
  observations: readonly PreTweetObservation[],
  cutoff: Date,
  minOccasions = MIN_OCCASIONS,
  minKols = MIN_DISTINCT_KOLS,
): BacktestResult {
  const train = observations.filter((o) => o.observedAt < cutoff);
  const test = observations.filter((o) => o.observedAt >= cutoff);

  const trainOccasions = new Set(train.map((o) => o.occasionId));
  const testOccasions = new Set(test.map((o) => o.occasionId));

  const recurrence = computeRecurrence(train, minOccasions, minKols);
  const flagged = [...recurrence.values()].filter((r) => r.qualifies).map((r) => r.wallet);
  const allTrain = [...recurrence.keys()];

  // Présences en test, indexées par occasion.
  const presentByOccasion = new Map<string, Set<string>>();
  for (const o of test) {
    if (!presentByOccasion.has(o.occasionId)) presentByOccasion.set(o.occasionId, new Set());
    presentByOccasion.get(o.occasionId)!.add(o.wallet);
  }

  const count = (population: readonly string[]) => {
    let hits = 0;
    for (const oid of testOccasions) {
      const present = presentByOccasion.get(oid) ?? new Set<string>();
      for (const w of population) if (present.has(w)) hits++;
    }
    return { hits, trials: population.length * testOccasions.size };
  };

  const f = count(flagged);
  const b = count(allTrain);
  const flaggedRate = f.trials > 0 ? f.hits / f.trials : 0;
  const baseRate = b.trials > 0 ? b.hits / b.trials : 0;

  return {
    ruleVersion: FRONT_RUN_RULE_VERSION,
    thresholds: { minOccasions, minDistinctKols: minKols },
    split: {
      cutoff: cutoff.toISOString(),
      trainOccasions: trainOccasions.size,
      testOccasions: testOccasions.size,
    },
    flagged: flagged.length,
    trainWallets: allTrain.length,
    flaggedHits: f.hits,
    flaggedTrials: f.trials,
    flaggedRate,
    baseHits: b.hits,
    baseTrials: b.trials,
    baseRate,
    separation: baseRate > 0 ? flaggedRate / baseRate : null,
  };
}

/**
 * Le même backtest, restreint à UN KOL.
 *
 * Un signal porté par un seul KOL n'est pas un signal : c'est la description
 * d'un acteur. La ventilation par KOL est donc une garde, pas un détail de
 * présentation — elle dit si la séparation globale tient ailleurs qu'à un
 * endroit.
 */
export function backtestByKol(
  observations: readonly PreTweetObservation[],
  cutoff: Date,
  minOccasions = MIN_OCCASIONS,
  minKols = MIN_DISTINCT_KOLS,
): Map<string, BacktestResult> {
  const kols = new Set(observations.map((o) => o.kolHandle));
  const out = new Map<string, BacktestResult>();
  for (const k of kols) {
    // Les wallets sont retenus sur le corpus COMPLET (la règle exige deux KOL
    // distincts, donc elle ne peut pas s'appliquer à un KOL isolé), mais
    // l'ÉVALUATION porte sur les seules occasions de ce KOL.
    const scoped = observations.filter((o) => o.kolHandle === k);
    const train = observations.filter((o) => o.observedAt < cutoff);
    const recurrence = computeRecurrence(train, minOccasions, minKols);
    const flagged = [...recurrence.values()].filter((r) => r.qualifies).map((r) => r.wallet);
    const allTrain = [...recurrence.keys()];

    const test = scoped.filter((o) => o.observedAt >= cutoff);
    const testOccasions = new Set(test.map((o) => o.occasionId));
    const presentByOccasion = new Map<string, Set<string>>();
    for (const o of test) {
      if (!presentByOccasion.has(o.occasionId)) presentByOccasion.set(o.occasionId, new Set());
      presentByOccasion.get(o.occasionId)!.add(o.wallet);
    }
    const count = (pop: readonly string[]) => {
      let hits = 0;
      for (const oid of testOccasions) {
        const p = presentByOccasion.get(oid) ?? new Set<string>();
        for (const w of pop) if (p.has(w)) hits++;
      }
      return { hits, trials: pop.length * testOccasions.size };
    };
    const f = count(flagged);
    const b = count(allTrain);
    const fr = f.trials > 0 ? f.hits / f.trials : 0;
    const br = b.trials > 0 ? b.hits / b.trials : 0;

    out.set(k, {
      ruleVersion: FRONT_RUN_RULE_VERSION,
      thresholds: { minOccasions, minDistinctKols: minKols },
      split: {
        cutoff: cutoff.toISOString(),
        trainOccasions: new Set(train.map((o) => o.occasionId)).size,
        testOccasions: testOccasions.size,
      },
      flagged: flagged.length,
      trainWallets: allTrain.length,
      flaggedHits: f.hits,
      flaggedTrials: f.trials,
      flaggedRate: fr,
      baseHits: b.hits,
      baseTrials: b.trials,
      baseRate: br,
      separation: br > 0 ? fr / br : null,
    });
  }
  return out;
}
