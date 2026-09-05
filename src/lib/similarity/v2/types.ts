// --- BUILD 7 / @v2 — LE VOCABULAIRE ÉTENDU --------------------------------
//
// PUR. Aucun réseau, aucune base, aucune persistance.
//
// ██ POURQUOI UN MODULE SÉPARÉ PLUTÔT QU'UNE ÉVOLUTION DE @v1 ██
//
// @v1 est GELÉ et doit rester EXÉCUTABLE : c'est la seule façon de mesurer un
// delta @v1→@v2 sur le même corpus. Modifier `src/lib/similarity/compare.ts`
// détruirait la référence à laquelle on compare — on ne saurait plus si un
// changement de résultat vient de la méthode ou de la réécriture.
//
// Les deux versions COEXISTENT donc, et la duplication du comparateur est
// délibérée. Ce qui est PARTAGÉ est ce qui ne dépend d'aucune version :
// `assertNoAggregateScore`, `assertNoVerdictLanguage`, `assertPositiveContent`,
// `leastAuthoritative`, le registre des méthodologies.
//
// ─── CE QUE @v2 AJOUTE, ET RIEN D'AUTRE ──────────────────────────────────
//
//   P0  une AGRÉGATION groupe→sujet déclarée PAR FEATURE, avec sa portée
//   P1  un état INADMISSIBLE, distinct de toute forme d'absence
//   P2  une RÉSOLUTION TEMPORELLE explicite, et l'interdiction de fabriquer
//       une heure là où la source n'en donne pas
//   P3  une ATTRIBUTION d'adresse, et l'interdiction d'attacher une identité
//       sémantique à une adresse non étiquetée
//
// Les quatre verdicts, l'interdiction de score, l'interdiction de seuil et les
// neuf invariants de @v1 sont REPRIS À L'IDENTIQUE. @v2 n'assouplit rien.

import type { DataNature } from "@/lib/data-nature/nature";
import type {
  EvidenceRef,
  FeatureCoverage,
  FeatureFamily,
  FeatureKind,
  FeatureMethod,
  FeatureValue,
  SetOverlap,
} from "../types";

export type { EvidenceRef, FeatureCoverage, FeatureFamily, FeatureKind, FeatureMethod, FeatureValue, SetOverlap };

export const SIMILARITY_COMPARE_V2_RULE_VERSION = "similarity/compare@v2";
export const SIMILARITY_CONTRACT_V2_VERSION = "similarity/feature-contract@v2";

// ═══ P1 — LE SIXIÈME ÉTAT ═════════════════════════════════════════════════
//
// ██ CE QUE S3 A MESURÉ, ET QUE @v1 NE SAVAIT PAS DIRE ██
//
// BOTIFY porte 5 ShillEvent dont `rowNature` est NULL, et 5 KolTokenLink dont
// `rowNature` vaut EDITORIAL_ASSERTION alors que le registre déclare la feature
// PRIMARY_OBSERVATION. Dans les deux cas la donnée EXISTE et ne peut PAS
// soutenir la feature. @v1 n'avait aucun état pour ça : le run S3 a dû les
// ranger sous NOT_OBSERVED en portant le motif dans le texte.
//
// NOT_OBSERVED dit « on a regardé l'échantillon et il n'y avait rien ». C'est
// FAUX ici : il y avait quelque chose, et c'est nous qui l'avons refusé. La
// différence n'est pas cosmétique — sous NOT_OBSERVED, un lecteur conclut que
// la collecte est à élargir ; sous INADMISSIBLE, il sait que c'est la
// QUALIFICATION de la donnée qui bloque, et que collecter davantage de la même
// chose ne changera rien.

export type ObservabilityStateV2 =
  | "OBSERVED"
  | "NOT_OBSERVED"
  | "NOT_MEASURABLE"
  | "CENSORED"
  | "INADMISSIBLE"
  | "MISSING";

/** MISSING reste non constructible : il se CONSTATE à la comparaison. */
export type ObservedSideStateV2 = Exclude<ObservabilityStateV2, "MISSING">;

/** Pourquoi la donnée ne peut pas soutenir la feature. Énuméré, jamais libre. */
export type InadmissibilityCause =
  /** La ligne source n'a pas de nature (UNCLASSIFIED). */
  | "DATA_NATURE_MISSING"
  /** La ligne source a une nature, et ce n'est pas celle que la feature exige. */
  | "DATA_NATURE_MISMATCH"
  /** Méthode, provenance ou preuve exigée par le contrat, non satisfaite. */
  | "PROVENANCE_UNSATISFIED";

export interface InadmissibilityDetail {
  cause: InadmissibilityCause;
  /** Ce qui a été trouvé, tel quel. Jamais un résumé. */
  found: string;
  /** Ce que le contrat exigeait. */
  required: string;
  /** Combien de lignes source sont concernées, quand le nombre porte du sens. */
  sourceRowCount: number | null;
}

// ═══ P0 — L'AGRÉGATION GROUPE → SUJET ═════════════════════════════════════
//
// ██ LE DÉFAUT QUE @v2 FERME ██
//
// Les dimensions de co-sortie sont définies PAR GROUPE — le registre le dit
// mot pour mot : « dans le groupe », « du premier au dernier acte du groupe ».
// VINE en a six. @v1 ne disait rien du niveau SUJET, et le run S3 a dû choisir
// une règle : l'unanimité. Conséquence mesurée : RAYDIUM et
// 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1, DÉMONTRÉS par 3 groupes sur 6,
// disparaissaient au niveau sujet. Une information réelle était perdue par une
// règle que personne n'avait ratifiée.
//
// ██ ET LE DÉFAUT QUE @v2 REFUSE D'OUVRIR ██
//
// Il n'y a AUCUN VOTE MAJORITAIRE. « 5 groupes sur 6 disent SELL_ONLY, donc le
// sujet est SELL_ONLY » serait un seuil déguisé — pourquoi 5/6 et pas 4/6 ? —
// et il écraserait le groupe qui dit autre chose. Quand les groupes divergent,
// la portée le DIT (CONFLICTING_GROUPS) et aucune valeur sujet n'est produite.
//
// SOME_GROUPS N'EST PAS UNE VÉRITÉ SUJET-ENTIER. Une valeur démontrée par
// 3 groupes sur 6 est démontrée — et elle est démontrée PAR TROIS GROUPES SUR
// SIX. La portée voyage avec la valeur, jusque dans le résultat de comparaison.

export type AggregationRule =
  /** La valeur n'existe au niveau sujet que si TOUS les groupes la démontrent. */
  | "ALL_OR_NOTHING"
  /** Un fait démontré par au moins un groupe EST démontré. La portée le dit. */
  | "DEMONSTRATED_BY_ANY"
  /** Une grandeur par groupe n'a pas de valeur sujet. Les faits sont préservés. */
  | "PER_GROUP_MAGNITUDE"
  /** La feature se calcule directement au niveau sujet : rien à agréger. */
  | "SUBJECT_LEVEL";

export type AggregationScope =
  | "ALL_GROUPS"
  | "SOME_GROUPS"
  | "CONFLICTING_GROUPS"
  | "NO_GROUP"
  | "PER_GROUP_ONLY"
  /** Feature non agrégée : elle est calculée au niveau sujet. */
  | "NOT_AGGREGATED";

/** Le fait porté par UN groupe. Préservé, jamais résumé. */
export interface PerGroupFact {
  groupRef: string;
  /** `null` = ce groupe ne démontre rien pour cette feature. */
  value: string | number | null;
}

export interface AggregationDetail {
  rule: AggregationRule;
  scope: AggregationScope;
  groupsConsidered: number;
  /**
   * Combien de groupes démontrent quelque chose.
   *
   * ██ LE NOM N'EST PAS UN CAPRICE. ██ Il s'appelait `groupsDemonstrating` — et
   * `assertNoAggregateScore`, partagé avec @v1, le REFUSAIT : sa liste de clés
   * interdites contient « rating », que « demonst-RATING » contient. La garde
   * fonctionne par sous-chaîne, elle est délibérément large, et @v1 est gelé :
   * on ne l'assouplit pas pour un faux positif, on renomme le champ.
   */
  groupsWithValue: number;
  /** ██ LES FAITS DE NIVEAU GROUPE, INTACTS. ██ */
  perGroup: readonly PerGroupFact[];
  /**
   * Les valeurs DISTINCTES démontrées. Deux ou plus ⇒ CONFLICTING_GROUPS, et
   * aucune valeur sujet n'est produite. C'est ce champ que lit INV-11.
   */
  distinctValues: readonly string[];
}

// ═══ P2 — LA RÉSOLUTION TEMPORELLE ════════════════════════════════════════
//
// ██ MINUIT N'EST PAS UNE OBSERVATION. ██
//
// Les 5 ShillEvent de BOTIFY portent `tweetTimestamp = 2025-01-11T00:00:00.000Z`
// et `timestampSource = date_only`. L'heure n'a jamais été observée : elle a
// été FABRIQUÉE par la valeur par défaut d'un type de colonne. Transporter cet
// instant, c'est affirmer une minute que personne n'a mesurée — et un écart de
// quelques minutes est exactement ce que les moteurs de ce produit mesurent.
//
// @v2 transporte donc la DATE, pas l'instant, et refuse mécaniquement toute
// valeur DAY portant une composante horaire.

export type TemporalResolution = "INSTANT" | "DAY";

export interface TemporalDetail {
  resolution: TemporalResolution;
  /**
   * DAY  → `YYYY-MM-DD`, sans composante horaire, JAMAIS.
   * INSTANT → un instant ISO complet, en UTC.
   */
  value: string;
  /** D'où vient la résolution : `date_only`, `snowflake`, `source_timestamp`… */
  provenance: string;
}

// ═══ P3 — L'ATTRIBUTION D'ADRESSE ═════════════════════════════════════════
//
// ██ CE QUE S3 A TROUVÉ, ET QUE @v2 DOIT ENCADRER ██
//
// `exit.demonstrated_destination` rend MATCH sur
// 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1. Cette adresse n'a AUCUNE
// étiquette auditable dans le produit — ni KNOWN_ROUTERS, ni KNOWN_INFRA — et
// les trois groupes qui la nomment sont exactement ceux dont le venue est
// RAYDIUM. Si c'est de l'infrastructure d'AMM, la co-occurrence ne vaut rien.
//
// LA RÉPONSE N'EST PAS DE CESSER DE COMPARER. Une adresse identique est un
// IDENTIFIANT FACTUEL identique, et le taire appauvrirait le résultat. La
// réponse est de dire ce qu'on ne sait pas : l'adresse est comparée BRUTE, son
// attribution est UNATTRIBUTED, et aucune identité d'entité, aucune lecture de
// venue, aucun poids probant ne s'y attache.
//
// L'ÉTIQUETTE SUIT LA MÊME RÈGLE QUE `qualifyFundingRelationship` : non
// auditable ⇒ traitée comme absente. Une identité sans provenance laisserait
// l'annotation d'un tiers décider comment INTERLIGENS lit ses propres preuves.

export type AttributionStatus =
  /** Aucune étiquette auditable. L'adresse est un identifiant, et rien d'autre. */
  | "UNATTRIBUTED"
  /** Un nom DÉCLARÉ par la source (programme d'un indexeur). Rapporté, non prouvé. */
  | "DECLARED_BY_SOURCE"
  /** Une étiquette auditable, avec sa provenance. La seule identité opposable. */
  | "ATTRIBUTED";

export interface AttributionDetail {
  status: AttributionStatus;
  /** Non nul UNIQUEMENT si `status` vaut DECLARED_BY_SOURCE ou ATTRIBUTED. */
  label: string | null;
  /** Non nul UNIQUEMENT si `status` vaut ATTRIBUTED. Où vérifier l'étiquette. */
  provenance: string | null;
}

// ═══ L'OBSERVATION @v2 ════════════════════════════════════════════════════

export interface FeatureObservationV2 {
  featureKey: string;
  family: FeatureFamily;
  kind: FeatureKind;
  state: ObservedSideStateV2;
  value: FeatureValue | null;
  stateReason: string | null;
  nature: DataNature;
  method: FeatureMethod;
  coverage: FeatureCoverage;
  evidence: readonly EvidenceRef[];
  experimental: boolean;
  nominative: boolean;
  /** Non nul SI ET SEULEMENT SI `state === "INADMISSIBLE"`. */
  inadmissibility: InadmissibilityDetail | null;
  /** Toujours présent : `NOT_AGGREGATED` quand la feature ne s'agrège pas. */
  aggregation: AggregationDetail;
  /** Non nul SI ET SEULEMENT SI le registre déclare la feature porteuse d'adresse. */
  attribution: AttributionDetail | null;
  /** Non nul quand la feature porte un fait daté. */
  temporal: TemporalDetail | null;
}

export interface SubjectFeatureSetV2 {
  subjectRef: string;
  observations: readonly FeatureObservationV2[];
}

// ═══ LA SORTIE — MÊMES VERDICTS, DEUX MOTIFS DE PLUS ══════════════════════

export type ComparisonVerdictV2 = "MATCH" | "PARTIAL_MATCH" | "DIFFERENT" | "NOT_COMPARABLE";

export type ComparisonReasonCodeV2 =
  | "EQUAL_VALUE"
  | "IDENTICAL_SET"
  | "SET_OVERLAP_PARTIAL"
  | "VALUE_DIFFERS"
  | "SET_DISJOINT"
  | "SIDE_NOT_OBSERVABLE"
  /** ██ P1 — jamais confondu avec SIDE_NOT_OBSERVABLE. ██ */
  | "SIDE_INADMISSIBLE"
  /** ██ P2 — la comparaison demandait plus fin que ce que la source donne. ██ */
  | "TEMPORAL_RESOLUTION_INSUFFICIENT"
  | "COVERAGE_CENSORED_NEGATIVE_WITHHELD"
  | "METHOD_MISMATCH"
  | "ORDINAL_REQUIRES_UNDECLARED_THRESHOLD";

export interface ComparisonSideV2 {
  subjectRef: string;
  state: ObservabilityStateV2;
  value: FeatureValue | null;
  stateReason: string | null;
  nature: DataNature | null;
  method: FeatureMethod | null;
  coverage: FeatureCoverage | null;
  evidence: readonly EvidenceRef[];
  experimental: boolean;
  nominative: boolean;
  inadmissibility: InadmissibilityDetail | null;
  /** `null` uniquement quand le côté est MISSING. */
  aggregation: AggregationDetail | null;
  attribution: AttributionDetail | null;
  temporal: TemporalDetail | null;
}

export interface ComparisonBasisV2 {
  featureKey: string;
  family: FeatureFamily;
  kind: FeatureKind;
  comparedOn: string;
  meaning: string;
  left: ComparisonSideV2;
  right: ComparisonSideV2;
  overlap: SetOverlap | null;
  resultIsFloor: boolean;
  /**
   * ██ P0 — VRAI dès qu'un côté observé ne l'est PAS par tous ses groupes. ██
   * Le résultat ne vaut alors que pour la portée déclarée, et le dire ici évite
   * qu'un lecteur en fasse une vérité sujet-entier.
   */
  scopeRestricted: boolean;
  /** ██ P3 — VRAI dès qu'un côté compare une adresse sans attribution. ██ */
  unattributedIdentifier: boolean;
  reasonCode: ComparisonReasonCodeV2;
  reason: string;
  experimental: boolean;
  nominative: boolean;
  ruleVersion: string;
}

export interface ComparisonResultV2 {
  verdict: ComparisonVerdictV2;
  resultNature: DataNature | null;
  basis: ComparisonBasisV2;
  reservations: readonly string[];
}

export interface SubjectComparisonV2 {
  contractVersion: string;
  ruleVersion: string;
  leftSubjectRef: string;
  rightSubjectRef: string;
  results: readonly ComparisonResultV2[];
}
