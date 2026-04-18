/**
 * Case Intelligence Orchestrator — Tier-1 engines.
 *
 * Called async from API routes. Never throws to the caller — the worst case
 * is `{ success: false }` with no events persisted. The trigger matrix in
 * types.ts decides which engines fan out per trigger; MANUAL_ENGINE_RUN
 * routes to a single engine.
 */

import { prisma } from "@/lib/prisma";
import type {
  OrchestratorInput,
  OrchestratorResult,
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  CaseIntelligenceEventDraft,
  NormalizedLead,
  CaseRuntimeContext,
  EngineId,
  AssistanceMode,
  OrchestratorUiReaction,
  IntelligenceCard,
  SuggestedEntity,
} from "./types";
import {
  ENGINE_TIMEOUTS_MS,
  TRIGGER_ENGINES,
  ORCHESTRATOR_MAX_MS,
} from "./types";

import { runKolRegistryEngine } from "./engines/kolRegistry";
import { runIntelVaultEngine } from "./engines/intelVault";
import { runObservedProceedsEngine } from "./engines/observedProceeds";
import { runRelatedSuggestionsEngine } from "./engines/relatedSuggestions";
import { runLaundryTrailEngine } from "./engines/laundryTrail";
import { runWalletJourneyEngine } from "./engines/walletJourney";
import { runCaseCorrelationEngine } from "./engines/caseCorrelation";
import { runThreatIntelEngine } from "./engines/threatIntel";

type EngineFn = (
  input: IntelligenceEngineInput
) => Promise<IntelligenceEngineResult>;

const ENGINES: Record<EngineId, EngineFn> = {
  KOL_Registry: runKolRegistryEngine,
  Intel_Vault: runIntelVaultEngine,
  Observed_Proceeds: runObservedProceedsEngine,
  Related_Suggestions: runRelatedSuggestionsEngine,
  Laundry_Trail: runLaundryTrailEngine,
  Wallet_Journey: runWalletJourneyEngine,
  Case_Correlation: runCaseCorrelationEngine,
  Threat_Intel: runThreatIntelEngine,
};

// Rough staleness threshold for CASE_OPENED light refresh.
const CASE_OPENED_STALE_MS = 10 * 60 * 1000; // 10 min

export async function runCaseIntelligenceOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const startedAt = Date.now();
  console.log(
    `[orchestrator] start caseId=${input.caseId} trigger=${input.triggerType} entityId=${input.entityId ?? "-"}`
  );

  let context: CaseRuntimeContext;
  let assistanceMode: AssistanceMode;
  let entity: NormalizedLead | undefined;
  let enabledEngines: Set<EngineId>;
  try {
    const bootstrap = await loadContext(input);
    context = bootstrap.context;
    assistanceMode = bootstrap.assistanceMode;
    entity = bootstrap.entity;
    enabledEngines = bootstrap.enabledEngines;
    console.log(
      `[orchestrator] bootstrap ok — entity=${entity ? `${entity.type}:${entity.value.slice(0, 10)}…` : "none"} enabled=[${[...enabledEngines].join(",")}]`
    );
  } catch (err) {
    console.error("[orchestrator] bootstrap failed", err);
    return {
      success: false,
      eventsCreated: 0,
      error: err instanceof Error ? err.message : "bootstrap_failed",
    };
  }

  const engineIds = selectEngines(input, enabledEngines);
  console.log(
    `[orchestrator] selected engines=[${engineIds.join(",")}] for trigger=${input.triggerType}`
  );
  if (engineIds.length === 0) {
    await touchSummaryQuiet(input.caseId);
    console.log("[orchestrator] no engines to run — summary touched");
    return { success: true, eventsCreated: 0 };
  }

  // 3. Flip summary to RUNNING (best-effort). This is the DB-level lock
  //    that complements the in-memory queue.
  await setSummaryStatus(input.caseId, "RUNNING");

  // 4. Fan out engines in parallel, each wrapped in its own timeout.
  const results = await Promise.all(
    engineIds.map(async (id) => {
      const engineInput: IntelligenceEngineInput = {
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        entity,
        caseContext: context,
        mode: input.triggerType === "MANUAL_ENGINE_RUN" ? "MANUAL" : "AUTO",
        timeoutMs: Math.min(
          ENGINE_TIMEOUTS_MS[id],
          Math.max(200, ORCHESTRATOR_MAX_MS - (Date.now() - startedAt))
        ),
      };
      const engineStart = Date.now();
      try {
        const r = await ENGINES[id](engineInput);
        console.log(
          `[orchestrator] engine=${id} ok=${r.success} events=${r.events.length} suggestions=${r.suggestions?.length ?? 0} partial=${r.partialResult ?? false} elapsedMs=${Date.now() - engineStart}`
        );
        return { id, r };
      } catch (err) {
        console.error(`[orchestrator] engine=${id} crashed`, err);
        return {
          id,
          r: {
            success: false,
            events: [],
            error: err instanceof Error ? err.message : "engine_crashed",
          } satisfies IntelligenceEngineResult,
        };
      }
    })
  );

  // 5. Persist events (additive — we never edit or remove existing ones).
  const failed: EngineId[] = [];
  const allDrafts: CaseIntelligenceEventDraft[] = [];
  const allSuggestions: SuggestedEntity[] = [];
  const engineStatuses: Array<{
    engine: EngineId;
    status:
      | "INTERNAL_MATCH_FOUND"
      | "EXTERNAL_THREAT_SIGNAL_FOUND"
      | "NO_INTERNAL_MATCH_YET"
      | "SOURCE_UNAVAILABLE";
  }> = [];
  for (const { id, r } of results) {
    if (!r.success || r.error) failed.push(id);
    allDrafts.push(...r.events);
    if (r.suggestions) allSuggestions.push(...r.suggestions);
    // Map legacy HIT onto INTERNAL_MATCH_FOUND; new engines already emit
    // the four-state enum directly.
    const raw = r.sourceStatus;
    const normalised =
      raw === "HIT"
        ? ("INTERNAL_MATCH_FOUND" as const)
        : raw ??
          (r.events.length > 0 || (r.suggestions?.length ?? 0) > 0
            ? "INTERNAL_MATCH_FOUND"
            : "NO_INTERNAL_MATCH_YET");
    engineStatuses.push({ engine: id, status: normalised });
  }

  const created = await persistEvents(
    input,
    allDrafts,
    assistanceMode
  );

  // 6. Refresh summary projection.
  await updateSummary(input.caseId, {
    events: created,
    failed,
  });

  const summary = {
    success: failed.length < engineIds.length,
    eventsCreated: created.length,
    failedModules: failed.length > 0 ? failed : undefined,
    uiReaction: buildUiReaction(
      created,
      allSuggestions,
      engineIds,
      failed,
      entity,
      engineStatuses
    ),
  };
  console.log(
    `[orchestrator] done caseId=${input.caseId} events=${created.length} failed=[${failed.join(",")}] elapsedMs=${Date.now() - startedAt}`
  );
  return summary;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

async function loadContext(input: OrchestratorInput): Promise<{
  context: CaseRuntimeContext;
  assistanceMode: AssistanceMode;
  entity?: NormalizedLead;
  enabledEngines: Set<EngineId>;
}> {
  // NOTE: the assistance columns on VaultWorkspace are added by the
  // migrations_case_intel/001 migration. If it hasn't been run yet, the
  // select() below throws because Prisma expects columns that don't exist.
  // We catch that and fall back to "all engines ON" so the orchestrator
  // still does useful work — users see the intelligence even if the
  // workspace hasn't been migrated.
  let workspace: {
    assistanceLevel?: string;
    autoKolRegistryMode?: string;
    autoIntelVaultMode?: string;
    autoObservedProceedsMode?: string;
    autoLaundryTrailMode?: string;
    autoWalletJourneyMode?: string;
    autoCaseCorrelationMode?: string;
  } | null = null;
  try {
    workspace = await prisma.vaultWorkspace.findUnique({
      where: { id: input.workspaceId },
      select: {
        assistanceLevel: true,
        autoKolRegistryMode: true,
        autoIntelVaultMode: true,
        autoObservedProceedsMode: true,
        autoLaundryTrailMode: true,
        autoWalletJourneyMode: true,
        autoCaseCorrelationMode: true,
      },
    });
  } catch (err) {
    console.warn(
      "[orchestrator] workspace settings query failed (pre-migration?) — falling back to defaults",
      err instanceof Error ? err.message : err
    );
    workspace = null;
  }

  const [caseRow, entityRow] = await Promise.all([
    prisma.vaultCase.findUnique({
      where: { id: input.caseId },
      select: { tagsEnc: true },
    }),
    input.entityId
      ? prisma.vaultCaseEntity.findUnique({
          where: { id: input.entityId },
          select: { id: true, type: true, value: true, label: true },
        })
      : // LEAD_ADDED / MANUAL_ENGINE_RUN without an explicit entityId →
        // enrich the most recent entity in the case. Lets the UI fire the
        // trigger before it has the fresh id in hand.
        input.triggerType === "LEAD_ADDED" ||
          input.triggerType === "MANUAL_ENGINE_RUN"
        ? prisma.vaultCaseEntity.findFirst({
            where: { caseId: input.caseId },
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, value: true, label: true },
          })
        : Promise.resolve(null),
  ]);

  if (!caseRow) throw new Error("case_not_found");

  const existingEntities = await prisma.vaultCaseEntity.findMany({
    where: { caseId: input.caseId },
    select: { id: true, type: true, value: true, label: true },
    take: 200,
  });

  // If we couldn't read the workspace flags (missing columns), treat every
  // Tier-1 engine as ON. Users get the intelligence they expect until the
  // migration lands.
  const flagKol       = workspace?.autoKolRegistryMode      ?? "ON";
  const flagIntel     = workspace?.autoIntelVaultMode       ?? "ON";
  const flagProceeds  = workspace?.autoObservedProceedsMode ?? "ON";
  // Tier-2 defaults: schema default is QUIET. That means "runs and persists
  // events" but UIs that check this flag can decide not to surface a toast.
  // The orchestrator itself treats QUIET and ON identically — only OFF skips.
  const flagLaundry   = workspace?.autoLaundryTrailMode     ?? "QUIET";
  const flagJourney   = workspace?.autoWalletJourneyMode    ?? "ON";
  const flagCaseCorr  = workspace?.autoCaseCorrelationMode  ?? "QUIET";

  const enabled = new Set<EngineId>();
  if (flagKol      !== "OFF") enabled.add("KOL_Registry");
  if (flagIntel    !== "OFF") enabled.add("Intel_Vault");
  if (flagProceeds !== "OFF") enabled.add("Observed_Proceeds");
  if (flagKol      !== "OFF") enabled.add("Related_Suggestions");
  if (flagLaundry  !== "OFF") enabled.add("Laundry_Trail");
  if (flagJourney  !== "OFF") enabled.add("Wallet_Journey");
  if (flagCaseCorr !== "OFF") enabled.add("Case_Correlation");
  // Threat_Intel covers external seeded threat data (OFAC, MetaMask,
  // Phantom, ScamSniffer domains, DefiLlama). No workspace knob for v1 —
  // it's always on; everyone benefits from external threat signals.
  enabled.add("Threat_Intel");

  return {
    context: {
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      tags: [],
      existingEntities,
    },
    assistanceMode:
      (workspace?.assistanceLevel as AssistanceMode | undefined) ??
      "BALANCED",
    entity: entityRow ?? undefined,
    enabledEngines: enabled,
  };
}

// ── Engine selection ─────────────────────────────────────────────────────

function selectEngines(
  input: OrchestratorInput,
  enabled: Set<EngineId>
): EngineId[] {
  if (input.triggerType === "MANUAL_ENGINE_RUN") {
    // Single engine if the caller named one, otherwise re-run the full
    // Tier-1 fanout — same shape as LEAD_ADDED. This makes the "Run
    // checks" button do the obvious thing.
    if (input.manualEngine) {
      return enabled.has(input.manualEngine) ? [input.manualEngine] : [];
    }
    return TRIGGER_ENGINES.LEAD_ADDED.filter((id) => enabled.has(id));
  }
  const planned = TRIGGER_ENGINES[input.triggerType] ?? [];
  return planned.filter((id) => enabled.has(id));
}

// ── Persistence ───────────────────────────────────────────────────────────

async function persistEvents(
  input: OrchestratorInput,
  drafts: CaseIntelligenceEventDraft[],
  mode: AssistanceMode
): Promise<{ id: string; draft: CaseIntelligenceEventDraft }[]> {
  if (drafts.length === 0) return [];
  const created: { id: string; draft: CaseIntelligenceEventDraft }[] = [];

  for (const d of drafts) {
    try {
      const row = await prisma.vaultCaseIntelligenceEvent.create({
        data: {
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          entityId: d.entityId,
          eventType: d.eventType,
          sourceModule: d.sourceModule,
          severity: d.severity,
          title: d.title,
          summary: d.summary,
          confidence: d.confidence,
          assistanceModeAtCreation: mode,
          payload: d.payload as never,
        },
        select: { id: true },
      });
      created.push({ id: row.id, draft: d });
    } catch (err) {
      // Table missing pre-migration — fail soft and keep going.
      console.warn("[orchestrator] persist failed", err);
    }
  }
  return created;
}

async function updateSummary(
  caseId: string,
  args: {
    events: { id: string; draft: CaseIntelligenceEventDraft }[];
    failed: EngineId[];
  }
): Promise<void> {
  const latestEventIds = args.events.slice(-5).map((e) => e.id);
  const strongest = [...args.events]
    .sort((a, b) => severityRank(b.draft.severity) - severityRank(a.draft.severity))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.draft.title,
      severity: e.draft.severity,
      sourceModule: e.draft.sourceModule,
    }));
  const status =
    args.failed.length === 0
      ? "IDLE"
      : args.events.length > 0
        ? "PARTIAL"
        : "FAILED";

  try {
    await prisma.vaultCaseIntelligenceSummary.upsert({
      where: { caseId },
      create: {
        caseId,
        strongestSignals: strongest as never,
        latestEventIds: latestEventIds as never,
        lastOrchestratedAt: new Date(),
        orchestrationStatus: status,
        lastFailedModules: args.failed as never,
      },
      update: {
        strongestSignals: strongest as never,
        latestEventIds: latestEventIds as never,
        lastOrchestratedAt: new Date(),
        orchestrationStatus: status,
        lastFailedModules: args.failed as never,
      },
    });
  } catch (err) {
    console.warn("[orchestrator] summary upsert failed", err);
  }
}

async function touchSummaryQuiet(caseId: string): Promise<void> {
  try {
    await prisma.vaultCaseIntelligenceSummary.upsert({
      where: { caseId },
      create: {
        caseId,
        lastOrchestratedAt: new Date(),
        orchestrationStatus: "IDLE",
      },
      update: {
        lastOrchestratedAt: new Date(),
        orchestrationStatus: "IDLE",
      },
    });
  } catch {
    /* table missing pre-migration — ignore */
  }
}

async function setSummaryStatus(
  caseId: string,
  status: string
): Promise<void> {
  try {
    await prisma.vaultCaseIntelligenceSummary.upsert({
      where: { caseId },
      create: { caseId, orchestrationStatus: status },
      update: { orchestrationStatus: status },
    });
  } catch {
    /* table missing pre-migration — ignore */
  }
}

// ── UI reaction ──────────────────────────────────────────────────────────

function severityRank(s: string): number {
  return s === "CRITICAL" ? 4 : s === "HIGH" ? 3 : s === "MEDIUM" ? 2 : 1;
}

function buildUiReaction(
  events: { id: string; draft: CaseIntelligenceEventDraft }[],
  suggestions: SuggestedEntity[],
  checkedEngines: EngineId[],
  failedEngines: EngineId[],
  entity: NormalizedLead | undefined,
  engineStatuses: Array<{
    engine: EngineId;
    status:
      | "INTERNAL_MATCH_FOUND"
      | "EXTERNAL_THREAT_SIGNAL_FOUND"
      | "NO_INTERNAL_MATCH_YET"
      | "SOURCE_UNAVAILABLE";
  }>
): OrchestratorUiReaction {
  const cards: IntelligenceCard[] = events.slice(0, 5).map((e) => ({
    id: e.id,
    eventType: e.draft.eventType,
    title: e.draft.title,
    summary: e.draft.summary,
    severity: e.draft.severity,
    confidence: e.draft.confidence,
    sourceModule: e.draft.sourceModule,
  }));

  const hasHits = events.length > 0 || suggestions.length > 0;
  const entityLabel = entity
    ? entity.value.length > 18
      ? `${entity.value.slice(0, 8)}…${entity.value.slice(-4)}`
      : entity.value
    : null;

  let title: string;
  let summaryLine: string;

  if (hasHits) {
    const hasExternal = engineStatuses.some(
      (s) => s.status === "EXTERNAL_THREAT_SIGNAL_FOUND"
    );
    const hasInternal = engineStatuses.some(
      (s) => s.status === "INTERNAL_MATCH_FOUND"
    );
    title =
      events.length > 0
        ? hasExternal && hasInternal
          ? `${events.length} intelligence hit${events.length === 1 ? "" : "s"} (internal + external)`
          : hasExternal
            ? `External threat signal found`
            : hasInternal
              ? `${events.length} INTERLIGENS match${events.length === 1 ? "" : "es"}`
              : `${events.length} intelligence hit${events.length === 1 ? "" : "s"}`
        : `${suggestions.length} suggestion${
            suggestions.length === 1 ? "" : "s"
          }`;
    summaryLine =
      events.length > 0
        ? events
            .slice(0, 3)
            .map((e) => e.draft.title)
            .join(" · ")
        : `${suggestions.length} related entit${
            suggestions.length === 1 ? "y" : "ies"
          } to consider`;
  } else if (failedEngines.length === checkedEngines.length && checkedEngines.length > 0) {
    title = "Checks failed";
    summaryLine = `${failedEngines.length} source${
      failedEngines.length === 1 ? "" : "s"
    } errored — try again`;
  } else {
    // Distinguish "sources empty" vs "sources ran, no match".
    const unavailable = engineStatuses.filter(
      (s) => s.status === "SOURCE_UNAVAILABLE"
    );
    const readySources = checkedEngines.length - unavailable.length;
    if (unavailable.length === checkedEngines.length && checkedEngines.length > 0) {
      title = "External source unavailable";
      summaryLine = `${unavailable.length} source${
        unavailable.length === 1 ? "" : "s"
      } not responding — try again later`;
    } else if (unavailable.length > 0) {
      title = "Valid lead, no internal memory yet";
      summaryLine = entityLabel
        ? `${readySources} live source${readySources === 1 ? "" : "s"} had no match for ${entityLabel} · ${unavailable.length} pending`
        : `${readySources} live source${readySources === 1 ? "" : "s"} checked · ${unavailable.length} pending`;
    } else {
      title = "No INTERLIGENS internal actor match yet";
      summaryLine = entityLabel
        ? `Valid lead for ${entityLabel} — external threat signals didn't fire, no internal memory yet. Manual checks available.`
        : `Valid lead — external threat signals didn't fire, no internal memory yet.`;
    }
  }

  return {
    title,
    summary: summaryLine,
    cards,
    suggestions: suggestions.slice(0, 8),
    hasMore: events.length > 5 || suggestions.length > 8,
    checkedEngines,
    failedEngines,
    noMatches: !hasHits && failedEngines.length === 0,
    engineStatuses,
  };
}

export { CASE_OPENED_STALE_MS };
