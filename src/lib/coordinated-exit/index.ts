// BUILD 6 / F0 — surface publique. Observation seule : aucun score, aucun label,
// aucune lecture de coordination. Le module n'importe ni prisma ni réseau.
export {
  COORDINATED_EXIT_EXTRACT_VERSION,
  EXIT_EVENT_NATURE,
  OBSERVED_COUNTERPARTY_MEANING,
  type EvidenceProvenance,
  type ExitCandidateTx,
  type ExitEvent,
  type ExitEventNature,
  type ExitEventType,
  type ExitNativeTransfer,
  type ExitTokenBalanceChange,
  type ExitTokenTransfer,
} from "./types";
export {
  extractExitEvents,
  type ExitExclusionReason,
  type ExtractExitEventsInput,
  type ExtractExitEventsResult,
} from "./extract";
export {
  CO_EXIT_RULE_VERSION,
  MIN_SUBJECTS_IN_GROUP,
  MissingCoExitWindowError,
  observeCoExit,
  summarizeCoverage,
  type CoExitGroup,
  type CoExitObservation,
  type CoExitPair,
  type ExitCoverage,
  type ObserveCoExitInput,
  type PrimaryEvidenceCoverage,
  type SubjectCoverage,
  type TransactionCoverage,
} from "./coExit";
