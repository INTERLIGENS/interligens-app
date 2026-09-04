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
