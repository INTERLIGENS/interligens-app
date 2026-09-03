// --- Shill Correlation Engine v2 - POLITIQUE, seuils a effet produit -------
//
// ##  TOUT CE FICHIER EST « A RATIFIER ». RIEN N'EST FIGE ICI.  ##
//
// Chaque valeur decide, en production, qu'un wallet est signale ou ignore.
// Ce sont des arbitrages produit, nommes et dates pour etre ratifies.
//
// Le moteur produit une PISTE D'ENQUETE, jamais une conclusion. Aucun seuil
// d'ici ne doit etre lu comme une frontiere entre « innocent » et « coupable ».

export interface EnginePolicy {
  /**
   * A RATIFIER - CORRECTIF #2 (feat/cc-offline-41), valeur NON FIGEE.
   *
   * Nombre minimal d'OCCASIONS avant qu'un ratio compte comme recurrence.
   * Mesure du 2026-08-28 : 218 candidats scoraient 77,00 avec observed=1 et
   * analyzable=1 - un ratio de 1,00 dont le denominateur vaut 1. Sous ce
   * plancher, le ratio reste rapporte comme FAIT mais ne credite plus le score.
   *
   * Defaut 3 : aligne sur `shortlist.minOccasions`, deja ratifie cote v1
   * (SCORING.minObservationsForRatio).
   */
  minOccasionsForRatio: number;

  // ══ A - DEUX FENETRES, DEUX PLANCHERS, DEUX NOMS ════════════════════════
  //
  // Le defaut corrige par ce build : en -42, la mesurabilite du lift testait
  //     baselineCounted.size + counted.size >= minBaselineBuys
  // c'est-a-dire la somme des achats TEMOIN et des achats OBSERVES contre un
  // plancher cense qualifier le TEMOIN SEUL. Consequence directe : un wallet
  // avec ZERO achat temoin et 5 achats observes franchissait le plancher du
  // temoin, puis heritait d'un lift plafonne pour cause de temoin nul. Le
  // dispositif entier - mesurer un taux de base - etait contourne par sa
  // propre garde.
  //
  // Les deux planchers sont desormais deux variables, portant deux noms, lues
  // par deux fonctions qui ne voient chacune QU'UN cote (voir tally.ts).

  /**
   * A RATIFIER - M2. Plancher du TEMOIN SEUL, en achats dedupliques collectes
   * dans les fenetres temoin de ce KOL. Ne voit JAMAIS le cote observation.
   *
   * En dessous : le temoin n'est pas un taux de base, c'est un echantillon
   * vide, et aucun lift n'en sort. Defaut 5.
   */
  minBaselineBuys: number;

  /**
   * A RATIFIER - plancher de l'OBSERVATION, variable DISTINCTE et nom
   * DISTINCT (contrainte explicite du cadrage : « plancher sur l'observation
   * = autre variable, autre nom »). Ne voit JAMAIS le cote temoin.
   *
   * Il ne qualifie pas le temoin : il dit qu'un numerateur construit sur trop
   * peu d'achats ne merite pas d'etre rapporte a un taux de base. Defaut 3 -
   * plus bas que `minBaselineBuys` a dessein : le temoin doit etre le cote le
   * mieux fourni, sans quoi le denominateur est le maillon faible.
   */
  minObservedBuys: number;

  /**
   * A RATIFIER - M1. Decalage de la fenetre TEMOIN, en secondes avant
   * l'observation. Le temoin repond a « combien de wallets achetent ce meme
   * token dans une fenetre de meme largeur ou AUCUNE publication n'a eu
   * lieu ? ». Sans lui, 251 achats avant un tweet ne prouvent rien.
   *
   * Defaut -24 h : assez loin pour qu'aucune fenetre d'observation ne le
   * recouvre (largeur 1500 s), assez proche pour rester le meme regime de
   * marche. Un decalage <= 1500 s rend le lift NON MESURABLE, par refus.
   */
  baselineOffsetSeconds: number;
  /**
   * SHILL-M1. Plafond de pages Helius pour la collecte temoin d'UNE occasion.
   *
   * DANS LA POLICY, PAS DANS LE CODE. Un 300 enterre dans helius.ts serait un
   * seuil a effet produit invisible : il decide quelles baselines sont
   * mesurables, donc quels candidats peuvent depasser `watch`. Le laisser hors
   * de la policy le rendrait aussi invisible que le plafond de 1 000 signatures
   * qui a produit les 20 exclusions `high_frequency` de SHILL-C1.
   *
   * Mesure du 2026-09-03 (sonde reelle, 1 token, 46 appels) : 44 pages ont
   * suffi a epuiser l'historique complet d'un token pump.fun shille. 300 laisse
   * 256 pages de marge sur ce cas. Ce n'est PAS une garantie pour un token a
   * forte activite continue - la sonde n'en a pas mesure.
   */
  baselineMaxPagesPerOccasion: number;

  /**
   * A RATIFIER - M2. Lift minimal pour qu'une co-occurrence soit rapportee
   * comme correlation. lift = tauxObserve / tauxTemoin. 1.0 = indiscernable
   * du bruit de fond. Defaut 2.0.
   */
  minLift: number;

  /**
   * A RATIFIER - M2 OPPOSABLE. Quand le lift est MESURE et tombe sous
   * `minLift`, le candidat ne peut pas depasser `watch`.
   *
   * Sans ce verrou, M1 serait mesure mais inoffensif : un wallet a lift 0,83 -
   * qui achete donc PLUS hors publication qu'autour - ressortait quand meme en
   * `high_interest` a 84,79 (mesure sur fixtures -42 le 2026-08-28), parce que
   * le lift ne pese que 0,15 dans la composition. Un conflit journalise mais
   * non opposable est exactement le defaut releve sur le resolveur V3.
   */
  liftGatesClassification: boolean;

  /**
   * ██ RATIFIE le 2026-08-30 (fondateur). VALEUR FIGEE A `true`. ██
   *
   * Un lift NON MESURE plafonne la classification a `watch`.
   *
   * `true` par doctrine SHILL-C1 : `high_interest` affirme une
   * correlation SUPERIEURE au taux de base ; l'affirmer sans avoir mesure le
   * taux de base, c'est franchir un seuil sur une non-mesure - precisement ce
   * que SHILL-C1 interdit.
   *
   * CONSEQUENCE MESURABLE ET ASSUMEE : tant que le collecteur M1 n'existe pas
   * (tache D, non livree), AUCUNE occasion ne porte de temoin, donc AUCUN lift
   * n'est mesurable, donc TOUT candidat est plafonne a `watch`. Le moteur ne
   * produit alors que des pistes. C'est le comportement voulu : il rend le
   * cout de l'absence de temoin visible au lieu de le dissimuler dans un score.
   *
   * Le passer a `false` etait le comportement de -42. C'est desormais un
   * changement de DOCTRINE RATIFIEE, pas un reglage : il exige une nouvelle
   * decision explicite du fondateur, au meme titre qu'une modification de
   * `outputIsInferenceOnly`.
   */
  unmeasuredLiftCapsClassification: boolean;

  /** A RATIFIER - mise en liste courte. Herite du scorer v1. */
  shortlist: { minOccasions: number; minPreTweet: number; minRatio: number };

  /** A RATIFIER - candidat serieux. Herite du scorer v1. */
  serious: { minOccasions: number; minSpecificity: number };

  /** A RATIFIER - poids de composition du score. */
  composite: { recurrence: number; timing: number; specificity: number; lift: number };

  /** A RATIFIER - ponderation des zones temporelles. Heritee de v1. */
  timingWeights: { pre: number; near: number; post: number };

  /** A RATIFIER - saturation du terme de comptage. */
  recurrenceCountCap: number;

  /** A RATIFIER - penalite convexe de sniper generique (destructive). */
  sniperPerExtraKol: number;

  /** A RATIFIER - seuils de confiance. */
  confidence: { highScore: number; mediumScore: number };

  /**
   * VERROU DE DOCTRINE - non ratifiable a false sans decision explicite.
   * Toute sortie du moteur est une INFERENCE. Mettre ceci a false ferait
   * produire des observations primaires par un moteur qui n'observe rien.
   */
  outputIsInferenceOnly: boolean;
}

export const DEFAULT_ENGINE_POLICY: EnginePolicy = {
  minOccasionsForRatio: 3,
  minBaselineBuys: 5,
  minObservedBuys: 3,
  baselineOffsetSeconds: 2 * 3600,
  baselineMaxPagesPerOccasion: 300,
  minLift: 2.0,
  liftGatesClassification: true,
  unmeasuredLiftCapsClassification: false,
  shortlist: { minOccasions: 3, minPreTweet: 2, minRatio: 0.25 },
  serious: { minOccasions: 5, minSpecificity: 50 },
  composite: { recurrence: 0.4, timing: 0.3, specificity: 0.15, lift: 0.15 },
  timingWeights: { pre: 1.0, near: 0.5, post: 0.15 },
  recurrenceCountCap: 5,
  sniperPerExtraKol: 8,
  confidence: { highScore: 70, mediumScore: 45 },
  outputIsInferenceOnly: true,
};

/**
 * ██ IL N'Y A PAS DE `liftCapWhenBaselineZero` DANS CETTE POLITIQUE. ██
 *
 * -42 en portait un (defaut 10) : quand le temoin etait mesure et que le
 * wallet en etait absent, le lift - une division par zero - recevait cette
 * valeur de substitution. C'EST UN EPSILON, sous un autre nom : une valeur
 * inventee pour qu'un calcul impossible rende quand meme un nombre, et ce
 * nombre etait le plus fort du bareme.
 *
 * Le cadrage l'interdit (« zero epsilon »). Le cas n'a pas disparu pour
 * autant : il est rapporte tel qu'il est, sous
 * `features.absentFromMeasuredBaseline`, un FAIT visible en observabilite qui
 * ne credite aucun score. Ajouter une constante ici pour le retransformer en
 * nombre serait la regression exacte que ce build ferme.
 */
export const FORBIDDEN_POLICY_KEYS = ["liftCapWhenBaselineZero"] as const;

/** Valeurs dont la ratification est EN ATTENTE - listees pour la revue. */
export const AWAITING_RATIFICATION = [
  "minOccasionsForRatio",
  "minBaselineBuys",
  "minObservedBuys",
  "minLift",
  "liftGatesClassification",
] as const;

/**
 * Valeurs RATIFIEES - sorties de AWAITING_RATIFICATION par decision datee.
 * Une liste d'attente qui garde ce qui a ete tranche ment sur ce qui reste a
 * trancher : c'est la seule raison d'etre de cette seconde liste.
 */
export const RATIFIED = [
  // ── REVERSE EXPLICITE, 2026-09-03 ──────────────────────────────────────
  // La decision du 2026-08-30 n'est pas effacee : elle est SUPERSEDEE, datee,
  // et son motif de reverse est ecrit. Une ratification qui disparait sans
  // trace laisse croire qu'elle n'a jamais eu lieu.
  {
    key: "unmeasuredLiftCapsClassification",
    value: false,
    on: "2026-09-03",
    by: "architecte",
    note:
      "reverse sur preuve de la sonde M1 : 78 % du corpus (149/192 evenements, " +
      "tokens pump.fun nes juste avant le shill) est STRUCTURELLEMENT " +
      "NOT_MEASURABLE. Plafonner sur cette absence ne mesurait pas une " +
      "correlation faible : cela penalisait la nature du corpus.",
    supersedes: { value: true, on: "2026-08-30", by: "fondateur" },
  },
  // ── M1 fige DANS SON DOMAINE DE VALIDITE, 2026-09-03 ────────────────────
  // Ratifie APRES la sonde reelle (1 token, 46 appels), pas avant : 44 pages
  // ont suffi a epuiser l'historique complet d'un token pump.fun shille, 300
  // laisse 256 pages de marge sur ce cas. Le decalage de 24 h est conserve
  // parce que le probleme mesure n'est PAS le decalage - a 2 h comme a 24 h,
  // un token ne 31 minutes avant le tweet n'a pas de pre-histoire. Reduire le
  // decalage aurait deplace un cout sans reparer un dispositif.
  // ── RÉVOQUÉ, puis re-fixé pour le shadow ────────────────────────────────
  // 86 400 avait été ratifié sur un fondement empirique CONTAMINÉ par le bug
  // d'horloge : ancre décalée de 2 h, donc « le témoin précède l'existence du
  // token » mesuré au mauvais instant. Une ratification fondée sur une mesure
  // démontrée fausse doit être RÉVOQUÉE explicitement - pas conservée au motif
  // qu'elle a été prise.
  {
    key: "baselineOffsetSeconds",
    value: 86_400,
    on: "2026-09-03",
    by: "architecte",
    status: "REVOKED",
    revokedOn: "2026-09-03",
    revokedWhy:
      "fondement empirique contamine par le bug d'alignement temporel " +
      "(ecart constant de 7 200 s, variance nulle sur 896 signatures). " +
      "Ancre corrigee : 24 h rend le temoin VIDE sur 3/3 tokens epuises, " +
      "2 h le rend mesurable sur 2-3/4. Le decalage compte - la mesure qui " +
      "disait le contraire etait fausse.",
  },
  // maxPages CONSERVE : le probleme n'a jamais ete la pagination. 44 pages
  // suffisaient a epuiser l'historique complet du token de reference.
  { key: "baselineMaxPagesPerOccasion", value: 300, on: "2026-09-03", by: "architecte" },
] as const;

/**
 * ── VALEURS RATIFIÉES POUR LE SHADOW SEULEMENT ─────────────────────────────
 *
 * Liste DISTINCTE de `RATIFIED` a dessein. Une valeur de shadow n'est pas une
 * doctrine de production : elle est posee pour que les premieres observations
 * puissent avoir lieu, et c'est le shadow qui dira si elle tient.
 *
 * Les confondre ferait passer un reglage d'experience pour une conclusion.
 */
export const SHADOW_RATIFIED = [
  {
    key: "baselineOffsetSeconds",
    value: 7_200,
    on: "2026-09-03",
    by: "architecte",
    supersedes: { value: 86_400, status: "REVOKED" },
    why:
      "meilleur compromis OBSERVABLE entre separation et mesurabilite : 24 h " +
      "rend M1 quasi inutilisable sur ce corpus (0/3), 4 h perd deja beaucoup " +
      "(1/4), 2 h tient sur 2-3/4.",
    /**
     * ⚠ LIMITE A NE JAMAIS TAIRE. Un temoin a -2 h n'est PAS un « bruit de
     * fond naturel » universel : c'est un CONTROLE PRE-EVENEMENT LOCAL,
     * susceptible d'etre deja contamine par l'accumulation preparatoire du
     * shill lui-meme. Un lift calcule sur cette base peut donc SOUS-ESTIMER
     * l'ecart reel - et cette sous-estimation n'est pas conservatrice au sens
     * ou on l'entend d'habitude : elle rend le dispositif moins sensible, pas
     * plus prudent.
     */
    limitation: "local pre-event control, may include preparatory accumulation",
    finalDoctrine: false,
  },
] as const;

/**
 * ═══ DOCTRINE SHILL-M1 — LE DOMAINE DE VALIDITE DU TEMOIN ═══════════════════
 *
 * Ratifiee le 2026-09-03 (architecte), apres la sonde reelle. Elle dit ce que
 * M1 mesure, ce qu'il refuse de mesurer, et - le point le plus important - ce
 * qu'il n'a PAS le droit de faire au reste du signal.
 *
 * Encodee ici plutot que dans un document : une doctrine qu'aucun test ne lit
 * derive en silence. Voir __tests__/baseline.test.ts.
 */
export const SHILL_M1_DOCTRINE = {
  /** Pre-histoire suffisante et integralement vue -> le temoin est mesurable. */
  validPrehistory: "MEASURABLE",
  /** Token trop jeune : la fenetre precede sa premiere transaction. */
  tokenTooYoung: "NOT_MEASURABLE / BASELINE_PRECEDES_TOKEN_EXISTENCE",
  /** Pagination insuffisante dans les bornes ratifiees. */
  paginationInsufficient: "NOT_MEASURABLE / BASELINE_CENSORED",
  /** Une baseline partielle n'est JAMAIS extrapolee, completee, ni lissee. */
  partialBaselineNeverExtrapolated: true,
  /** M1 n'est JAMAIS une preuve autonome de coordination. */
  neverStandaloneProof: true,
  /**
   * ██ M1 EST ADDITIONNEL ET CONDITIONNEL — TRANCHE LE 2026-09-03 ██
   *
   *   M1 MESURE      -> contribue normalement (bonifie ou penalise selon sa
   *                     valeur : c'est le sens d'une mesure).
   *   M1 NON MESURE  -> ne contribue PAS. Ne bonifie pas, ne penalise pas.
   *                     Son poids est redistribue sur les composantes mesurees
   *                     (scoring.ts, `compositeRenormalized`), et la
   *                     classification comportementale est CONSERVEE.
   *
   * AUCUN motif de non-mesurabilite ne devient une penalite comportementale.
   * Le scoring NE DISTINGUE PAS `BASELINE_PRECEDES_TOKEN_EXISTENCE` de
   * `BASELINE_CENSORED` : les deux disent « on ne sait pas », et un « on ne
   * sait pas » n'a pas de degres au moment de noter. Les motifs restent
   * integralement distincts EN OBSERVABILITE - c'est la qu'ils servent.
   *
   * Le conflit avec la ratification du 2026-08-30 a ete tranche par reverse
   * explicite, sur preuve : 78 % du corpus est structurellement non mesurable.
   * Plafonner sur cette absence ne mesurait pas une correlation faible, cela
   * penalisait la nature du corpus.
   */
  m1IsAdditionalConditional: true,
  measuredM1Contributes: true,
  unmeasuredM1NeitherRewardsNorPenalizes: true,
  scoringIgnoresUnmeasurableReason: true,
  reasonsPreservedInObservability: true,
  conflictsWith: "unmeasuredLiftCapsClassification (RATIFIE 2026-08-30, fondateur) - REVERSE le 2026-09-03",
  conflictResolved: true,
  coreSignalDimensions: ["holdings", "cross_kol_dispersion", "timing"],
} as const;

/**
 * ── PREUVE DE VALIDATION DE L'INSTRUMENT, 2026-09-03 ───────────────────────
 *
 * Enregistree POSITIVEMENT, comme un resultat de mesure - pas comme une
 * promesse. Une reserve levee sans que la mesure qui la leve soit conservee
 * redevient une reserve a la premiere relecture.
 *
 * CE QU'ELLE ETABLIT : une fois l'alignement temporel corrige, v1 et
 * l'instrument actuel comptent LA MEME CHOSE. Accord parfait.
 *
 * CE QU'ELLE N'ETABLIT PAS : que l'un ou l'autre capture EXHAUSTIVEMENT les
 * acheteurs economiquement pertinents. C'est un accord entre deux lectures,
 * pas une preuve d'exhaustivite - d'ou la reserve `proxy_minimum` conservee.
 */
export const INSTRUMENT_AGREEMENT_EVIDENCE = {
  agreement: 1.0,
  pairs: 921,
  tokens: 4,
  kols: 3,
  rule: "toUserAccount du mint, tokenAmount > 0",
  measuredOn: "2026-09-03",
  scope: "corpus teste, ancre corrigee - PAS une garantie universelle",
  establishesExhaustiveness: false,
} as const;
