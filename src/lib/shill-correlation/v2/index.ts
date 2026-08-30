// --- Shill Correlation Engine v2 - surface publique -----------------------
//
// ETAT : construction. Ce build livre A (separation des fenetres) et B
// (non-mesurabilite). C (nature native persistee) s'arrete au DDL ; D
// (collecteur M1 + chiffrage Helius) n'est pas commence.
//
// AUCUN consommateur ne doit appeler ce module en production. Le passage en
// SHADOW sur donnees reelles est une decision separee, et elle n'est pas prise
// ici.
//
// Interdits absolus tenus par ce module :
//   - aucune publication, aucune surface retail ;
//   - aucun claim nominatif : (kolHandle, wallet) est une co-occurrence ;
//   - aucun branchement TigerScore / REFLEX / PRE-BUY GUARD ;
//   - reviewStatus toujours 'draft'.

export * from "./types";
export {
  DEFAULT_ENGINE_POLICY,
  AWAITING_RATIFICATION,
  RATIFIED,
  FORBIDDEN_POLICY_KEYS,
  type EnginePolicy,
} from "./policy";
export { runEngine, type EngineResult } from "./engine";
export { computeFeatures, computeLift } from "./features";
export { scoreFeatures } from "./scoring";
export {
  observedWindow,
  baselineWindow,
  baselineIsDisjoint,
  windowsOverlap,
  zoneForDelta,
  WINDOW_WIDTH_SECONDS,
  type TimeWindow,
  type WindowKind,
} from "./windows";
export {
  buildObservedSide,
  buildBaselineSide,
  observedTally,
  baselineTally,
  assessObservedFloor,
  assessBaselineFloor,
  observedOccasionsForWallet,
  baselineOccasionsForWallet,
  type ObservedSide,
  type BaselineSide,
} from "./tally";
export {
  buildTelemetry,
  findInconsistencies,
  observedStateAfterFetch,
  baselineStateAfterFetch,
  notCollected,
  markScored,
  isObservedAnalyzable,
} from "./journal";
export {
  buildInferenceEnvelope,
  assertInferenceOnly,
  ENGINE_POLICY_VERSION,
  InferenceOnlyViolation,
} from "./nature";
