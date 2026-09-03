// --- D/M1 - CHIFFRAGE DU COLLECTEUR TEMOIN --------------------------------
//
// ██  READ-ONLY. AUCUN APPEL HELIUS. Ce module ne fait que de l'arithmetique. ██
//
// Il existe pour qu'un chiffre puisse etre CONTESTE plutot que cru : chaque
// entree porte sa provenance, et les entrees NON MESUREES sont marquees comme
// telles. Un tableau de couts dont on ne peut pas relire les hypotheses est un
// tableau qu'on finit par croire.
//
// ─── LES TROIS PROVENANCES, ET POURQUOI ELLES SONT SEPAREES ───────────────
//
//   MEASURED   lu en base ou dans le code, a une date, reproductible
//   DERIVED    calcule a partir de MEASURED, avec le sens du biais ecrit
//   UNVERIFIED pose faute de mieux - c'est CE QU'IL FAUT ALLER CHERCHER
//
// Melanger les trois produirait un cout unique, lisse, invérifiable. Le cout
// de M1 n'est PAS un nombre : c'est une fourchette, et la largeur de la
// fourchette est elle-meme l'information utile.

export type Provenance = "MEASURED" | "DERIVED" | "UNVERIFIED";

export interface Input<T> {
  value: T;
  provenance: Provenance;
  /** Ou ce chiffre a ete lu, ou ce qu'il faudrait faire pour le mesurer. */
  source: string;
}

const m = <T>(value: T, source: string): Input<T> => ({ value, provenance: "MEASURED", source });
const d = <T>(value: T, source: string): Input<T> => ({ value, provenance: "DERIVED", source });
const u = <T>(value: T, source: string): Input<T> => ({ value, provenance: "UNVERIFIED", source });

// ═══ 1. LA MECANIQUE - lue dans le code, pas supposee ═════════════════════

export const MECHANICS = {
  /** helius.ts : `fetchTxs(mint, { limit: 100, before })`. 1 page = 1 appel. */
  txPerCall: m(100, "src/lib/shill-correlation/helius.ts, limit:100"),
  /** types.ts ANALYSIS_WINDOW : 600 + 900. */
  windowWidthSeconds: m(1500, "v2/windows.ts WINDOW_WIDTH_SECONDS"),
  /** policy.ts DEFAULT_ENGINE_POLICY.baselineOffsetSeconds. */
  baselineOffsetSeconds: m(24 * 3600, "v2/policy.ts, AWAITING_RATIFICATION"),
  /** helius.ts DEFAULT_MAX_PAGES. */
  currentMaxPagesPerFetch: m(12, "src/lib/shill-correlation/helius.ts DEFAULT_MAX_PAGES"),
  /**
   * ██ LE FAIT QUI GOUVERNE TOUT LE CHIFFRAGE ██
   * L'API Enhanced n'offre AUCUN seek temporel : seulement un curseur `before`
   * par signature, du plus recent au plus ancien. Atteindre une fenetre passee
   * impose de traverser - et de jeter - tout ce qui s'est passe depuis.
   */
  hasTimestampSeek: m(false, "helius.ts, angle mort documente n°1"),
} as const;

// ═══ 2. LE PRODUIT - mesure en base le 2026-09-03, ep-square-band ═════════

export const CORPUS = {
  shillEvents: m(221, "SELECT count(*) FROM ShillEvent, 2026-09-03"),
  distinctMints: m(88, "count(DISTINCT tokenMint)"),
  resolvedEvents: m(192, "resolutionStatus LIKE 'resolved%' (158 direct + 34 from_tweet)"),
  unresolvedEvents: m(29, "unresolved_ticker - AUCUNE adresse a interroger, jamais collectables"),
  candidates: m(1532, "SELECT count(*) FROM ShillCorrelationCandidate"),
  /**
   * ██ IL N'EXISTE AUCUNE CADENCE D'ARRIVEE MESUREE ██
   * Les 221 evenements ont TOUS ete ingeres en 2026-06 (createdAt), et le
   * tweet le plus recent date du 2026-06-06. Ce corpus est un AMORCAGE, pas un
   * flux. Le moteur forward n'a jamais tourne : sa cadence ne peut donc pas
   * etre mesuree, seulement bornee par le mois le plus dense observe.
   */
  liveArrivalRateIsMeasured: m(false, "createdAt : 221/221 en 2026-06 - amorcage"),
  busiestMonthEvents: m(135, "tweetTimestamp dans 2026-06"),
  busiestMonthKolMintPairs: m(86, "count(DISTINCT kolHandle|tokenMint) dans 2026-06"),
} as const;

// ═══ 3. L'ACTIVITE DES TOKENS - derivee, avec le sens du biais ════════════

export const ACTIVITY = {
  /**
   * Acheteurs DISTINCTS par fenetre d'observation de 1 500 s, mesure sur les
   * 11 evenements reellement collectes (2 169 observations).
   */
  buyersPerWindowP50: m(117, "percentile_disc(0.5) sur ShillBuyerObservation par event"),
  buyersPerWindowP90: m(452, "percentile_disc(0.9) - egal au max, n=11"),
  /**
   * ██ DEUX BIAIS OPPOSES, AUCUN DES DEUX QUANTIFIE ██
   *
   * SOUS-ESTIME : un acheteur distinct vaut AU MOINS une transaction. Les
   *   ventes, les transferts non-acheteurs et les tx multi-acheteurs ne sont
   *   pas comptes. Le taux derive est donc un PLANCHER de l'activite reelle.
   *
   * SUR-ESTIME : ce taux est mesure PENDANT le pic de publication. La fenetre
   *   temoin est, par construction, un moment SANS publication - donc plus
   *   calme. Appliquer le taux de pic a l'ecart de 24 h majore le cout.
   *
   * Les deux biais ne s'annulent pas : rien ne dit qu'ils sont du meme ordre.
   * La seule mesure qui les leve est une sonde a sec sur UN token - un
   * parcours arriere reel, compte sans rien persister. Elle n'a PAS ete faite :
   * elle demande des appels Helius reels, et le fondateur ne les a pas valides.
   */
  rateIsBoundedNotMeasured: d(true, "biais opposes non quantifies - fourchette, pas point"),
} as const;

// ═══ 4. LE PRIX - non verifie, et c'est le point ══════════════════════════

export const PRICING = {
  /**
   * ██ A CONFIRMER SUR LA FACTURE HELIUS ██
   * Aucune constante de cout Helius n'existe dans ce repo (grep exhaustif du
   * 2026-09-03). CLAUDE.md annonce ~279 $/mois TOUS SERVICES CONFONDUS, sans
   * ventilation. Le cout d'un appel Enhanced n'est donc PAS connu ici.
   */
  creditsPerEnhancedCall: u(100, "tarif public Helius de memoire - A VERIFIER sur la facture"),
  usdPerMillionCredits: u(4.99, "Developer 49 $ / 10 M credits - A VERIFIER"),
  monthlyPlanUsd: u(49, "plan suppose Developer - A VERIFIER"),
  includedCreditsPerMonth: u(10_000_000, "quota suppose - A VERIFIER"),
} as const;

// ═══ 5. LE CALCUL ═════════════════════════════════════════════════════════

/**
 * L'INCREMENT REELLEMENT IMPUTABLE A M1.
 *
 * La fenetre temoin est PLUS ANCIENNE que l'observee. Sur un parcours arriere
 * contigu, tout chemin qui atteint le temoin a deja traverse l'observee : les
 * deux se collectent en UN parcours. L'increment de M1 n'est donc pas un
 * second fetch, mais l'ECART entre les deux fenetres, plus le temoin lui-meme.
 *
 *   observee debute a   tweet - 600
 *   temoin finit a      tweet - offset + 900
 *   temoin debute a     tweet - offset - 600
 *
 *   ecart non couvert   = (tweet - 600) - (tweet - offset + 900) = offset - 1500
 *   + largeur du temoin = 1500
 *   increment           = offset
 *
 * Le resultat est exactement `offsetSeconds` : decaler le temoin de N secondes
 * dans le passe coute N secondes d'historique en plus, ni plus ni moins.
 * C'est ce qui fait du decalage un LEVIER DE COUT direct, et non un reglage
 * methodologique sans consequence.
 *
 * Compter deux fetchs complets doublerait un cout qui n'est pas double - et
 * c'est l'erreur naturelle quand on lit « une fenetre de plus ».
 *
 * Le decalage du run (cron quotidien : jusqu'a 24 h entre le tweet et le
 * traitement) n'entre PAS dans l'increment : il est deja paye par le fetch
 * d'observation, qui doit de toute facon remonter jusqu'au tweet.
 */
export function incrementalSpanSeconds(offsetSeconds: number, windowWidth = 1500): number {
  const preSeconds = 600;
  const postSeconds = windowWidth - preSeconds;
  const observedStart = -preSeconds;
  const baselineEnd = -offsetSeconds + postSeconds;
  // L'ecart non couvert par l'observation, plus la largeur du temoin.
  // Se reduit algebriquement a `offsetSeconds` : decaler le temoin de N
  // secondes dans le passe coute exactement N secondes d'historique en plus.
  // La forme longue est gardee : elle montre POURQUOI, la forme courte non.
  return observedStart - baselineEnd + windowWidth;
}

export interface CostScenario {
  label: string;
  offsetSeconds: number;
  buyersPerWindow: number;
  occasionsPerRun: number;
  runsPerDay: number;
}

export interface CostLine {
  label: string;
  /** Transactions a traverser par occasion, PLANCHER. */
  txPerOccasion: number;
  /** Appels Helius par occasion = pages. */
  callsPerOccasion: number;
  callsPerRun: number;
  callsPerMonth: number;
  creditsPerMonth: number;
  usdPerMonth: number;
  /** Le budget de pages actuel suffit-il ? */
  fitsCurrentPageBudget: boolean;
  /** Pages a autoriser pour que la fenetre soit couverte. */
  pagesNeededPerOccasion: number;
}

export function computeCostLine(s: CostScenario): CostLine {
  const spanSeconds = incrementalSpanSeconds(s.offsetSeconds, MECHANICS.windowWidthSeconds.value);
  // Taux PLANCHER : un acheteur distinct = au moins une transaction.
  const txPerSecond = s.buyersPerWindow / MECHANICS.windowWidthSeconds.value;
  const txPerOccasion = Math.ceil(txPerSecond * spanSeconds);
  const callsPerOccasion = Math.ceil(txPerOccasion / MECHANICS.txPerCall.value);
  const callsPerRun = callsPerOccasion * s.occasionsPerRun;
  const callsPerMonth = callsPerRun * s.runsPerDay * 30;
  const creditsPerMonth = callsPerMonth * PRICING.creditsPerEnhancedCall.value;
  const usdPerMonth = (creditsPerMonth / 1_000_000) * PRICING.usdPerMillionCredits.value;

  return {
    label: s.label,
    txPerOccasion,
    callsPerOccasion,
    callsPerRun,
    callsPerMonth,
    creditsPerMonth,
    usdPerMonth,
    pagesNeededPerOccasion: callsPerOccasion,
    fitsCurrentPageBudget: callsPerOccasion <= MECHANICS.currentMaxPagesPerFetch.value,
  };
}

// ═══ 6. CE QUI EST DEJA LOCAL, ET NE SE REPAIE PAS ═══════════════════════

export const ALREADY_LOCAL = {
  /** 2 169 observations sur 11 evenements : la fenetre OBSERVEE de ces 11 est acquise. */
  observedWindowsCollected: m(11, "count(DISTINCT shillEventId) sur ShillBuyerObservation"),
  /** Les 29 unresolved_ticker n'ont pas d'adresse : jamais collectables, jamais factures. */
  neverCollectable: m(29, "resolutionStatus = 'unresolved_ticker'"),
  /**
   * REUTILISATION REELLE, et elle est faible. Un meme mint shille par deux KOL
   * a deux dates a DEUX fenetres temoin distinctes : le cache par mint ne sert
   * que si les fenetres se recouvrent. Mesure : 88 mints pour 221 evenements,
   * mais les dates sont dispersees sur 512 jours.
   */
  mintReuseRatio: d(221 / 88, "evenements / mints distincts = 2,5 - mais fenetres disjointes"),
  cacheSavesCalls: d(false, "fenetres temoin disjointes : un cache par mint ne rejoue rien"),
} as const;

// ═══ 7. LE COMPORTEMENT QUAND LE BUDGET EST ATTEINT ══════════════════════

/**
 * LA REGLE, ecrite ici pour qu'elle soit lisible sans lire baseline.ts :
 *
 *   budget atteint  ->  NOT_MEASURABLE, motif BASELINE_CENSORED
 *   JAMAIS          ->  un temoin partiel presente comme comparable
 *
 * Pourquoi c'est la seule issue tenable : un temoin tronque donne un
 * denominateur TROP PETIT, donc un lift TROP GRAND, donc un candidat
 * sur-classe - et c'est le budget qui l'a produit, pas le comportement du
 * wallet. La degradation silencieuse ne rendrait pas le systeme moins precis :
 * elle le rendrait faux dans la direction qui flatte le produit.
 */
export const BUDGET_BEHAVIOR = {
  onBudgetExhaustedBeforeFirstPage: "baselineState='budget_exhausted' + truncatedBy",
  onBudgetExhaustedMidPaging: "etat reel + baselineTruncatedBy -> censoredMeasurement",
  resultingLift: "UNMEASURED",
  resultingReason: "BASELINE_CENSORED",
  /** Le lift non mesure plafonne la classification a `watch`. Deja en place. */
  classificationCap: "watch (policy.unmeasuredLiftCapsClassification, RATIFIE 2026-08-30)",
  neverDoes: [
    "completer un temoin partiel par une valeur par defaut",
    "traiter un comptage tronque comme un total",
    "rapporter BASELINE_NOT_COLLECTED quand le budget a refuse",
  ],
} as const;
