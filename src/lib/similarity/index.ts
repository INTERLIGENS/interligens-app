// --- BUILD 7 / SIMILARITY V2 — SURFACE PUBLIQUE ---------------------------
//
// ÉTAT : S0→S2 livrés. Le contrat de feature et le comparateur existent, purs
// et testés. L'EXÉCUTION SUR CORPUS (S3) N'EST PAS COMMENCÉE et attend une
// ratification architecte.
//
// Interdits absolus tenus par ce module, et vérifiés par ses tests :
//   · aucun score global, aucun classement, aucun seuil ;
//   · aucun accès réseau, base ou Helius — les adaptateurs prennent des TYPES ;
//   · aucune persistance, aucun DDL ;
//   · aucune conclusion de culpabilité, de scam, de coordination ou
//     d'opérateur commun ;
//   · aucune sortie publiable tant que `similarity/compare@v1` ne résout pas
//     sur un artefact de méthodologie gelé.

export {
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_CONTRACT_VERSION,
  type ComparisonBasis,
  type ComparisonReasonCode,
  type ComparisonResult,
  type ComparisonSide,
  type ComparisonVerdict,
  type EvidenceRef,
  type FeatureCoverage,
  type FeatureFamily,
  type FeatureKind,
  type FeatureMethod,
  type FeatureObservation,
  type FeatureValue,
  type ObservabilityState,
  type ObservedSideState,
  type SetOverlap,
  type SubjectComparison,
  type SubjectFeatureSet,
} from "./types";

export {
  SIMILARITY_FEATURE_KEYS,
  SIMILARITY_FEATURE_REGISTRY,
  UnknownFeatureError,
  specFor,
  type FeatureSpec,
} from "./registry";

export {
  MalformedObservationError,
  buildFeatureObservation,
  completeCoverage,
  type BuildFeatureObservationInput,
} from "./observation";

export {
  ALLOWED_VERDICT_REASONS,
  AbsenceBecameFindingError,
  CensoredNegativeError,
  EmptyObservationError,
  ExperimentalLaunderedError,
  FORBIDDEN_CONCLUSION_LEXICON,
  ForbiddenConclusionError,
  MethodMismatchNotFlaggedError,
  NatureUpRankError,
  StateCollapseError,
  UnattributableComparisonError,
  assertComparisonInvariants,
  assertNoAggregateScore,
  assertNoVerdictLanguage,
  assertPositiveContent,
  type ComparisonSources,
} from "./invariants";

export { SIMILARITY_RESERVATIONS, compareFeature, compareSubjects } from "./compare";

export {
  SHILL_FORWARD_BRIDGE_POLICY_VERSION,
  coverageFromExit,
  coverageFromFundingRelationship,
  observationsFromAnchor,
  observationsFromCoExit,
  observationsFromFrontRun,
  observationsFromFundingRelationships,
  observationsFromFundingSnapshot,
  observationsFromOccasionHandles,
  observationsFromPromotionQualification,
  observationsFromTokenIdentity,
} from "./adapters";
