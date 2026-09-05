// --- BUILD 7 / @v2 — SURFACE PUBLIQUE -------------------------------------
//
// @v2 CORRIGE la méthode ; il n'élargit pas le contrat. Mêmes 17 features,
// mêmes 4 verdicts, mêmes interdits. Ce qu'il ajoute : un sixième état
// (INADMISSIBLE), une agrégation groupe→sujet déclarée par feature, une
// résolution temporelle explicite, et une attribution d'adresse.
//
// @v1 reste importable et exécutable depuis `@/lib/similarity` — c'est ce qui
// rend le delta @v1→@v2 mesurable sur un corpus identique.

export {
  SIMILARITY_COMPARE_V2_RULE_VERSION,
  SIMILARITY_CONTRACT_V2_VERSION,
  type AggregationDetail,
  type AggregationRule,
  type AggregationScope,
  type AttributionDetail,
  type AttributionStatus,
  type ComparisonBasisV2,
  type ComparisonReasonCodeV2,
  type ComparisonResultV2,
  type ComparisonSideV2,
  type ComparisonVerdictV2,
  type FeatureObservationV2,
  type InadmissibilityCause,
  type InadmissibilityDetail,
  type ObservabilityStateV2,
  type ObservedSideStateV2,
  type PerGroupFact,
  type SubjectComparisonV2,
  type SubjectFeatureSetV2,
  type TemporalDetail,
  type TemporalResolution,
} from "./types";

export {
  SIMILARITY_FEATURE_KEYS_V2,
  SIMILARITY_FEATURE_REGISTRY_V2,
  UnknownFeatureV2Error,
  specForV2,
  type FeatureSpecV2,
} from "./registry";

export {
  MalformedObservationV2Error,
  UNATTRIBUTED,
  buildFeatureObservationV2,
  declaredBySource,
  type BuildFeatureObservationV2Input,
} from "./observation";

export {
  aggregateCategorical,
  aggregateMagnitude,
  notAggregated,
  type AggregatedCategorical,
  type CategoricalGroupFact,
} from "./aggregate";

export {
  ALLOWED_VERDICT_REASONS_V2,
  FabricatedInstantError,
  InadmissibleDowngradedError,
  MajorityVoteError,
  SCOPE_RESERVATION,
  ScopeLaunderedError,
  UNATTRIBUTED_RESERVATION,
  UnattributedIdentityError,
  assertAttributionCoherent,
  assertComparisonInvariantsV2,
  assertNoFabricatedInstant,
  type ComparisonSourcesV2,
} from "./invariants";

export {
  SIMILARITY_RESERVATIONS_V2,
  compareFeatureV2,
  compareSubjectsV2,
} from "./compare";
