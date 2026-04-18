import { NextRequest, NextResponse } from "next/server";
import { getVaultWorkspace, assertCaseOwnership } from "@/lib/vault/auth.server";
import { enqueueOrchestration } from "@/lib/vault/intelligence/queue";
import { runCaseIntelligenceOrchestrator } from "@/lib/vault/intelligence/orchestrator";
import type {
  OrchestratorInput,
  TriggerType,
  EngineId,
} from "@/lib/vault/intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ caseId: string }> };

const VALID_TRIGGERS: TriggerType[] = [
  "LEAD_ADDED",
  "EVIDENCE_ADDED",
  "NOTE_ADDED",
  "CASE_OPENED",
  "MANUAL_ENGINE_RUN",
];
const VALID_ENGINES: EngineId[] = [
  "KOL_Registry",
  "Intel_Vault",
  "Observed_Proceeds",
  "Related_Suggestions",
];

// POST /api/investigators/cases/[caseId]/orchestrate
// Body: { triggerType, entityId?, manualEngine? }
//
// Owner-only. Goes through the per-case queue (debounced + coalesced).
// Caller gets the OrchestratorResult back when the run finishes — this is
// intentionally synchronous at the API layer because the queue already
// prevents duplicate work. If you need pure fire-and-forget, ignore the
// response.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const triggerType = body.triggerType as TriggerType;
  if (!VALID_TRIGGERS.includes(triggerType)) {
    return NextResponse.json({ error: "bad_triggerType" }, { status: 400 });
  }
  const entityId =
    typeof body.entityId === "string" && body.entityId.trim()
      ? body.entityId
      : undefined;
  const manualEngine =
    typeof body.manualEngine === "string" && VALID_ENGINES.includes(body.manualEngine as EngineId)
      ? (body.manualEngine as EngineId)
      : undefined;

  const input: OrchestratorInput = {
    caseId,
    workspaceId: ctx.workspace.id,
    triggerType,
    entityId,
    manualEngine,
  };

  try {
    const result = await enqueueOrchestration(input, runCaseIntelligenceOrchestrator);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[orchestrate] failed", err);
    return NextResponse.json(
      {
        success: false,
        eventsCreated: 0,
        error:
          err instanceof Error ? err.message : "orchestrator_failed",
      },
      { status: 200 }
    );
  }
}
