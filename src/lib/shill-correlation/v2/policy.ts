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
  baselineOffsetSeconds: 24 * 3600,
  baselineMaxPagesPerOccasion: 300,
  minLift: 2.0,
  liftGatesClassification: true,
  unmeasuredLiftCapsClassification: true,
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
  "baselineOffsetSeconds",
  // Cible GPT du 2026-09-03 : 24 h / 300 pages / NOT_MEASURABLE au depassement.
  // Reste EN ATTENTE : la sonde a livre un resultat qui doit etre tranche avant
  // de figer (temoin anterieur a l'existence du token sur 78 % du corpus).
  "baselineMaxPagesPerOccasion",
  "minLift",
  "liftGatesClassification",
] as const;

/**
 * Valeurs RATIFIEES - sorties de AWAITING_RATIFICATION par decision datee.
 * Une liste d'attente qui garde ce qui a ete tranche ment sur ce qui reste a
 * trancher : c'est la seule raison d'etre de cette seconde liste.
 */
export const RATIFIED = [
  { key: "unmeasuredLiftCapsClassification", value: true, on: "2026-08-30", by: "fondateur" },
] as const;
