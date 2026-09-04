// F0 — surface publique. Extraction factuelle + observation « source commune ».
// Aucune persistance, aucune collecte, aucun label de coordination.
export {
  FUNDING_EDGE_NATURE,
  FUNDING_GRAPH_RULE_VERSION,
  LAMPORTS_PER_SOL,
  type FundingEdge,
  type FundingEdgeNature,
  type NativeTransferInput,
  type TransferBearingTx,
} from "./types";
export { buildFundingEdges, type BuildEdgesResult } from "./edges";
export {
  MIN_SHARED_RECIPIENTS,
  SHARED_FUNDER_RULE_VERSION,
  sharedFunder,
  type FunderLink,
  type SharedFunder,
  type SharedFunderObservation,
} from "./sharedFunder";
export {
  FUNDING_SNAPSHOT_RULE_VERSION,
  buildFundingSnapshot,
  type FunderStructure,
  type FundingSnapshot,
  type FundingSnapshotInput,
} from "./snapshot";
export {
  DUST_FLOOR_LAMPORTS,
  FUNDING_RELATIONSHIP_METHOD_REF,
  FUNDING_RELATIONSHIP_POLICY_VERSION,
  RENT_EXEMPT_MINIMUM_LAMPORTS,
  qualifyFundingRelationship,
  type AddressLabelInput,
  type CoverageInput,
  type FundingRelationshipCategory,
  type QualifiedFundingRelationship,
  type QualifyFundingRelationshipInput,
} from "./qualify";
export {
  EDGE_PROOF_FLOOR_MEANING,
  buildEdgeProofCoverage,
  type EdgeProofCompleteness,
  type EdgeProofCoverage,
  type EdgeProofIncompletenessReason,
  FUNDING_EDGE_TABLE,
  FUNDING_RELATIONSHIP_TABLE,
  FundingNatureRegistryMismatchError,
  buildFundingEdgeRow,
  buildFundingRelationshipRow,
  persistFundingGraph,
  satisfiesFundingEdgeChecks,
  satisfiesFundingRelationshipChecks,
  type FundingEdgeRow,
  type FundingGraphStore,
  type FundingRelationshipRow,
  type KeyConflict,
  type PersistFundingGraphInput,
  type PersistReport,
  type StoredEdge,
  type StoredRelationship,
} from "./persistence";
