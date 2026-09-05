// --- BUILD 7 / SIMILARITY V2 — LE VOCABULAIRE DE LA COMPARAISON -----------
//
// PUR. Aucun réseau, aucune base, aucune persistance.
//
// ██ LA QUESTION, EXACTEMENT ██
//
//   « Quelles caractéristiques DÉMONTRÉES de ce sujet ont déjà été observées
//     dans des cas antérieurs, et sur quelle PREUVE repose chaque similarité
//     ou différence ? »
//
// Ce n'est PAS « ce sujet ressemble-t-il à un scam ». La différence n'est pas
// rhétorique : la seconde question demande un score et un seuil, et produit un
// verdict que rien dans les données ne soutient. La première demande, pour
// chaque caractéristique, ce qui a été comparé, avec quelles valeurs, sur
// quelle preuve, et pourquoi le résultat est celui-là.
//
// ─── LES CINQ ÉTATS D'OBSERVABILITÉ, ET POURQUOI ILS NE FUSIONNENT PAS ────
//
//   OBSERVED        la caractéristique a été établie, avec sa preuve
//   NOT_OBSERVED    le moteur a regardé l'échantillon et n'y a rien trouvé
//   NOT_MEASURABLE  la grandeur ne se mesure pas depuis ce qui existe
//   CENSORED        la collecte a été coupée avant que la question soit posée
//   MISSING         la caractéristique n'a jamais été extraite pour ce sujet
//
// Les fondre en un `null`, un `false` ou un `0` est LA faute que ce module
// existe pour rendre impossible. Un `null` unique dirait « on ne sait pas »
// à quatre questions différentes — et le lecteur attribuerait la réponse à la
// mauvaise. Pire : deux `null` côte à côte se lisent comme une ressemblance.
//
// MISSING n'est pas un état qu'une observation peut porter : c'est ce que le
// comparateur constate quand aucune observation n'existe. Le type l'impose
// (`FeatureObservation.state` exclut MISSING) pour qu'on ne puisse pas
// fabriquer une « absence » munie d'une nature et d'une méthode.
//
// ─── CENSORED, L'ÉTAT, N'EST PAS `coverage.complete = false` ──────────────
//
// Deux faits distincts, et ils coexistent :
//
//   state = CENSORED          la collecte s'est arrêtée avant qu'AUCUNE valeur
//                             puisse être établie — il n'y a rien à comparer
//   state = OBSERVED          une valeur EXISTE, mais elle est un PLANCHER :
//   + coverage.complete=false la collecte bornée a pu en manquer d'autres
//
// Le second cas est le plus fréquent et le plus dangereux : la valeur est là,
// elle a l'air complète, et une différence lue dessus serait une différence
// inventée par le budget de collecte. Voir INV-4 dans ./invariants.

import type { DataNature } from "@/lib/data-nature/nature";

/**
 * La version de la règle de comparaison. CITABLE : deux comparaisons rendues
 * sous deux versions ne se comparent pas entre elles.
 *
 * ██ ELLE NE RÉSOUT PAS ENCORE DANS LE REGISTRE DES MÉTHODOLOGIES. ██
 * C'est délibéré et c'est dit : geler un artefact de méthodologie est une
 * décision de doctrine, pas un effet de bord d'un build de code. Tant que
 * l'artefact n'existe pas, AUCUNE sortie de ce comparateur ne peut être
 * publiée ni persistée — la réserve est portée par chaque résultat, et un
 * test la fait tomber le jour où l'artefact est gelé.
 */
export const SIMILARITY_COMPARE_RULE_VERSION = "similarity/compare@v1";

/** La version du CONTRAT de feature. Distincte : le contrat peut changer sans
 *  que la règle de comparaison bouge, et inversement. */
export const SIMILARITY_CONTRACT_VERSION = "similarity/feature-contract@v1";

// ═══ LES FAMILLES ═════════════════════════════════════════════════════════
//
// Une famille n'est PAS un regroupement d'affichage : c'est le moteur qui a
// produit la sortie. Le lecteur doit pouvoir remonter d'une comparaison au
// module qui l'a rendue possible, sans relire le code.

export type FeatureFamily =
  | "IDENTITY"
  | "TEMPORAL"
  | "FUNDING_GRAPH"
  | "SHILL_CORRELATION"
  | "COORDINATED_EXIT"
  | "PRE_SHILL";

// ═══ LES TROIS SORTES DE VALEUR, ET CE QU'ELLES AUTORISENT ════════════════
//
//   CATEGORICAL  une étiquette issue d'un vocabulaire FERMÉ, produite en amont
//                par une règle gelée. Égalité ou différence, rien entre les deux.
//   SET          un ensemble d'identifiants DÉMONTRÉS (adresses, venues, mints).
//                Le recouvrement est mesurable sans aucun seuil : partagé,
//                à gauche seulement, à droite seulement.
//   ORDINAL      une grandeur (un compte, des secondes). ██ JAMAIS COMPARÉE ██
//                — voir INV-8 : dire « proche » exigerait un seuil, et un seuil
//                choisi ici ne mesurerait que lui-même. La grandeur est
//                TRANSPORTÉE des deux côtés pour que le lecteur juge ; le
//                comparateur, lui, s'abstient et le dit.
export type FeatureKind = "CATEGORICAL" | "SET" | "ORDINAL";

export type ObservabilityState =
  | "OBSERVED"
  | "NOT_OBSERVED"
  | "NOT_MEASURABLE"
  | "CENSORED"
  | "MISSING";

/** Les états qu'une OBSERVATION peut porter. MISSING n'en est pas : il se
 *  constate à la comparaison, il ne se construit pas. */
export type ObservedSideState = Exclude<ObservabilityState, "MISSING">;

export type FeatureValue =
  | { readonly kind: "CATEGORICAL"; readonly value: string }
  | { readonly kind: "SET"; readonly values: readonly string[] }
  | { readonly kind: "ORDINAL"; readonly value: number; readonly unit: string };

/**
 * L'ÉTAT DE LA COLLECTE qui a produit la caractéristique.
 *
 * `upstream` porte la couverture du moteur d'origine TELLE QUELLE. Les trois
 * couvertures de Coordinated Exit (sujets / transactions / preuve primaire)
 * répondent à trois questions différentes ; les aplatir en un booléen
 * produirait un drapeau incapable de dire lequel des trois manque. Le booléen
 * `complete` existe pour que l'invariant s'applique mécaniquement ; `upstream`
 * existe pour que rien ne soit perdu.
 */
export interface FeatureCoverage {
  complete: boolean;
  /** Renseigné SI ET SEULEMENT SI `complete` est faux. */
  censoredBy: string | null;
  upstream: Readonly<Record<string, unknown>>;
}

/**
 * Un pointeur vers la preuve. JAMAIS un résumé.
 *
 * Une comparaison sans preuve opposable n'est pas une observation, seulement
 * une affirmation — et c'est exactement ce que la question produit refuse.
 */
export interface EvidenceRef {
  /** `tx_signature`, `post_id`, `group_key`, `occasion_id`… */
  kind: string;
  refs: readonly string[];
}

/**
 * LA MÉTHODE, ET SES PARAMÈTRES.
 *
 * `parameters` n'est pas décoratif : deux co-sorties mesurées sous deux
 * fenêtres différentes ne se comparent pas, et rien dans les VALEURS ne le
 * dirait. C'est ce champ que lit INV-9.
 */
export interface FeatureMethod {
  /**
   * Doit résoudre dans le registre gelé (`isKnownMethodRef`), ou être `null`.
   * Une référence inventée serait un mensonge auditable : mieux vaut `null`
   * assumé qu'un ref qui ne mène nulle part.
   */
  methodRef: string | null;
  /** La version de règle du producteur. Obligatoire, non vide. */
  ruleVersion: string;
  parameters: Readonly<Record<string, string | number | boolean>>;
}

/**
 * UNE CARACTÉRISTIQUE OBSERVÉE D'UN SUJET.
 *
 * `nature`, `experimental` et `nominative` ne sont pas fournis par l'appelant :
 * ils viennent du REGISTRE (./registry). Un adaptateur ne peut donc pas
 * requalifier une INFERENCE en PRIMARY_OBSERVATION, ni faire tomber le drapeau
 * expérimental d'une sortie PRE-SHILL, en se contentant de passer une autre
 * valeur.
 */
export interface FeatureObservation {
  featureKey: string;
  family: FeatureFamily;
  kind: FeatureKind;
  state: ObservedSideState;
  /** Non nul SI ET SEULEMENT SI `state === "OBSERVED"`. */
  value: FeatureValue | null;
  /** Non nul SI ET SEULEMENT SI `state !== "OBSERVED"`. Une limite, jamais une conclusion. */
  stateReason: string | null;
  nature: DataNature;
  method: FeatureMethod;
  coverage: FeatureCoverage;
  evidence: readonly EvidenceRef[];
  /** Sortie de moteur EXPÉRIMENTAL (PRE-SHILL). Ne devient jamais canonique. */
  experimental: boolean;
  /** Porte des identifiants de personnes/comptes. Jamais retail-visible. */
  nominative: boolean;
}

/** Le sujet et ce qu'on a su en extraire. `subjectRef` est opaque : un caseId,
 *  un mint, un identifiant d'ensemble de wallets — le module ne l'interprète pas. */
export interface SubjectFeatureSet {
  subjectRef: string;
  observations: readonly FeatureObservation[];
}

// ═══ LA SORTIE DU COMPARATEUR ═════════════════════════════════════════════

/** Le vocabulaire est FERMÉ. Il n'y a pas de cinquième valeur, et il n'y a
 *  pas de nombre. */
export type ComparisonVerdict = "MATCH" | "PARTIAL_MATCH" | "DIFFERENT" | "NOT_COMPARABLE";

/**
 * POURQUOI ce verdict. Énuméré, jamais de la prose libre : un motif en texte
 * libre n'est ni comptable, ni testable, ni contestable ligne à ligne.
 */
export type ComparisonReasonCode =
  /** MATCH */
  | "EQUAL_VALUE"
  | "IDENTICAL_SET"
  /** PARTIAL_MATCH */
  | "SET_OVERLAP_PARTIAL"
  /** DIFFERENT */
  | "VALUE_DIFFERS"
  | "SET_DISJOINT"
  /** NOT_COMPARABLE */
  | "SIDE_NOT_OBSERVABLE"
  | "COVERAGE_CENSORED_NEGATIVE_WITHHELD"
  | "METHOD_MISMATCH"
  | "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD";

/** Un côté de la comparaison, tel qu'il s'est présenté. `nature`, `method` et
 *  `coverage` sont `null` SI ET SEULEMENT SI le côté est MISSING. */
export interface ComparisonSide {
  subjectRef: string;
  state: ObservabilityState;
  value: FeatureValue | null;
  stateReason: string | null;
  nature: DataNature | null;
  method: FeatureMethod | null;
  coverage: FeatureCoverage | null;
  evidence: readonly EvidenceRef[];
  experimental: boolean;
  nominative: boolean;
}

/** Le recouvrement de deux ensembles. Trois listes, jamais un ratio : un
 *  ratio serait un score déguisé, et il faudrait un seuil pour le lire. */
export interface SetOverlap {
  shared: readonly string[];
  onlyLeft: readonly string[];
  onlyRight: readonly string[];
}

export interface ComparisonBasis {
  featureKey: string;
  family: FeatureFamily;
  kind: FeatureKind;
  /** Ce qui a été comparé, en clair. */
  comparedOn: string;
  /**
   * Le sens de la feature, TEL QUE LE REGISTRE LE GÈLE — démentis compris.
   * Il voyage avec le résultat parce qu'un lecteur qui reçoit « MATCH » sans
   * « NARROW_WINDOW_CLUSTER n'est pas COORDINATED_EXIT » lira le mauvais fait.
   */
  meaning: string;
  left: ComparisonSide;
  right: ComparisonSide;
  /** Présent uniquement pour les SET effectivement comparés. */
  overlap: SetOverlap | null;
  /**
   * ██ Sous couverture censurée, tout résultat est un PLANCHER. ██ Jamais une
   * identité démontrée, jamais une différence démontrée.
   */
  resultIsFloor: boolean;
  reasonCode: ComparisonReasonCode;
  reason: string;
  experimental: boolean;
  nominative: boolean;
  ruleVersion: string;
}

export interface ComparisonResult {
  verdict: ComparisonVerdict;
  /** La nature du RÉSULTAT : la MOINS autoritaire des deux côtés (I1/§1.2).
   *  `null` quand un côté est MISSING — on ne classe pas une absence. */
  resultNature: DataNature | null;
  basis: ComparisonBasis;
  /** Les réserves méthodologiques, portées par CHAQUE comparaison. */
  reservations: readonly string[];
}

export interface SubjectComparison {
  contractVersion: string;
  ruleVersion: string;
  leftSubjectRef: string;
  rightSubjectRef: string;
  /** Un résultat par feature du REGISTRE — y compris celles qui manquent des
   *  deux côtés. Le lecteur doit voir ce qui n'a PAS été comparé. */
  results: readonly ComparisonResult[];
}
