/**
 * Shared types for the Case Intelligence Orchestrator.
 *
 * The contract between engines, queue and API lives here. Intentionally
 * kept free of runtime imports so both server routes and Node-only engine
 * modules can consume it.
 */

export type TriggerType =
  | "LEAD_ADDED"
  | "EVIDENCE_ADDED"
  | "NOTE_ADDED"
  | "CASE_OPENED"
  | "MANUAL_ENGINE_RUN";

export type AssistanceMode = "FULL_ASSIST" | "BALANCED" | "MANUAL_FIRST";

export type EngineMode = "AUTO" | "MANUAL";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OrchestrationStatus = "IDLE" | "RUNNING" | "PARTIAL" | "FAILED";

// All Tier-1 engines must identify themselves with one of these strings.
// The value is persisted on VaultCaseIntelligenceEvent.sourceModule — keep
// stable; adding new values is fine, renaming is not.
export type EngineId =
  | "KOL_Registry"
  | "Intel_Vault"
  | "Observed_Proceeds"
  | "Related_Suggestions"
  | "Laundry_Trail"
  | "Wallet_Journey"
  | "Case_Correlation"
  | "Threat_Intel";

export type EventType =
  | "KOL_MATCH_FOUND"
  | "INTEL_VAULT_REFERENCE_FOUND"
  | "OBSERVED_PROCEEDS_FOUND"
  | "RELATED_SUGGESTION"
  | "LAUNDRY_TRAIL_FOUND"
  | "WALLET_JOURNEY_FOUND"
  | "CASE_CORRELATION_FOUND"
  | "THREAT_SIGNAL_FOUND"
  | "PROTOCOL_CONTEXT_FOUND";

export interface OrchestratorInput {
  caseId: string;
  workspaceId: string;
  triggerType: TriggerType;
  entityId?: string;
  /** Only honoured when triggerType === "MANUAL_ENGINE_RUN". */
  manualEngine?: EngineId;
}

export interface NormalizedLead {
  id: string;
  type:
    | "WALLET"
    | "TX_HASH"
    | "HANDLE"
    | "URL"
    | "DOMAIN"
    | "ALIAS"
    | "EMAIL"
    | "IP"
    | "CONTRACT"
    | "OTHER";
  value: string;
  label: string | null;
}

export interface SuggestedEntity {
  type: NormalizedLead["type"];
  value: string;
  label?: string | null;
  reason: string;
}

export interface IntelligenceCard {
  id?: string;
  eventType: EventType;
  title: string;
  summary: string;
  severity: Severity;
  confidence?: number;
  sourceModule: EngineId;
}

export interface OrchestratorUiReaction {
  title: string;
  summary: string;
  cards: IntelligenceCard[];
  suggestions: SuggestedEntity[];
  hasMore: boolean;
  /** Which engines actually ran this pass, success or not. */
  checkedEngines: EngineId[];
  /** Engines that returned an error or timed out. */
  failedEngines: EngineId[];
  /** Set when engines ran successfully but found 0 events / 0 suggestions. */
  noMatches: boolean;
  /** Per-engine readiness breakdown (used for "source not seeded yet" UI). */
  engineStatuses?: Array<{ engine: EngineId; status: SourceStatus }>;
}

export interface OrchestratorResult {
  success: boolean;
  eventsCreated: number;
  uiReaction?: OrchestratorUiReaction;
  failedModules?: EngineId[];
  error?: string;
}

export interface CaseRuntimeContext {
  caseId: string;
  workspaceId: string;
  existingEntities: NormalizedLead[];
  tags: string[];
}

export interface IntelligenceEngineInput {
  caseId: string;
  workspaceId: string;
  entity?: NormalizedLead;
  caseContext: CaseRuntimeContext;
  mode: EngineMode;
  /** Hard ceiling for the engine — if exceeded, return partialResult:true. */
  timeoutMs: number;
}

export interface CaseIntelligenceEventDraft {
  entityId?: string;
  eventType: EventType;
  sourceModule: EngineId;
  severity: Severity;
  title: string;
  summary: string;
  confidence?: number;
  payload: Record<string, unknown>;
}

/**
 * Per-engine source-readiness signal. Surfaces in the reaction panel so the
 * investigator can tell "this engine has no data yet" apart from "this
 * engine ran and found nothing for your input".
 *
 *   HIT                    — engine produced at least one event OR suggestion
 *   NO_INTERNAL_MATCH_YET  — engine ran successfully but the input is not in
 *                            our curated datasets
 *   SOURCE_UNAVAILABLE     — engine's underlying table / feed is empty or
 *                            missing (e.g. AddressLabel has zero rows before
 *                            the OFAC cron seeds it)
 */
export type SourceStatus =
  | "INTERNAL_MATCH_FOUND"
  | "EXTERNAL_THREAT_SIGNAL_FOUND"
  | "NO_INTERNAL_MATCH_YET"
  | "SOURCE_UNAVAILABLE"
  /** @deprecated replaced by INTERNAL_MATCH_FOUND — kept for backward compat. */
  | "HIT";

export interface IntelligenceEngineResult {
  success: boolean;
  events: CaseIntelligenceEventDraft[];
  suggestions?: SuggestedEntity[];
  partialResult?: boolean;
  error?: string;
  /** Engine-declared readiness state — surfaced in the reaction panel. */
  sourceStatus?: SourceStatus;
}

/**
 * Trigger matrix — which engines fire for each trigger. Matches the spec's
 * Rule 2. MANUAL_ENGINE_RUN is routed separately (single engine selected by
 * OrchestratorInput.manualEngine).
 */
export const TRIGGER_ENGINES: Record<
  Exclude<TriggerType, "MANUAL_ENGINE_RUN">,
  EngineId[]
> = {
  LEAD_ADDED: [
    // Founding intelligence seed — external threat signals first (cheapest,
    // broadest coverage on day-1, works on any wallet / domain / URL).
    "Threat_Intel",
    // Tier-1: curated internal matches (KOL actors, proceeds, intel vault).
    "KOL_Registry",
    "Intel_Vault",
    "Observed_Proceeds",
    "Related_Suggestions",
    // Tier-2: on-chain / cross-case analysis.
    "Laundry_Trail",
    "Wallet_Journey",
    "Case_Correlation",
  ],
  NOTE_ADDED: [],
  EVIDENCE_ADDED: [],
  // Cheap sources on re-open: threat intel + intel vault + case correlation.
  CASE_OPENED: ["Threat_Intel", "Intel_Vault", "Case_Correlation"],
};

/**
 * Per-engine timeouts. Numbers from the spec — keep these lean. If an engine
 * routinely blows past its budget it should be optimised, not stretched.
 */
export const ENGINE_TIMEOUTS_MS: Record<EngineId, number> = {
  KOL_Registry: 500,
  Intel_Vault: 800,
  Observed_Proceeds: 1000,
  Related_Suggestions: 500,
  Laundry_Trail: 800,
  Wallet_Journey: 1000,
  Case_Correlation: 700,
  Threat_Intel: 600,
};

export const ORCHESTRATOR_MAX_MS = 10_000;
