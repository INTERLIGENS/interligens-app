import { NextRequest, NextResponse } from "next/server";
import { llmComplete } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import {
  buildCaseIntelligencePack,
  type CaseIntelligencePack,
} from "@/lib/vault/buildCaseIntelligencePack";

type RouteCtx = { params: Promise<{ caseId: string }> };

type ChatMsg = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(pack: CaseIntelligencePack): string {
  return `You are an investigative intelligence co-pilot for INTERLIGENS, a crypto anti-scam platform. You assist investigators analyzing on-chain fraud, KOL promotion schemes, and crypto scam networks.

You work exclusively from structured derived intelligence.
You never have access to raw files or private investigator notes.
You separate facts from inferences rigorously.

CASE INTELLIGENCE PACK:
${JSON.stringify(pack, null, 2)}

CONFIDENCE ASSESSMENT:
${JSON.stringify(pack.confidenceAssessment, null, 2)}

CONTRADICTIONS:
${JSON.stringify(pack.contradictions, null, 2)}

TIMELINE CORRELATION:
${JSON.stringify(pack.timelineCorrelation, null, 2)}

CRITICAL RULES:
1. Treat entities and cross-intelligence hits as confirmed structured signals.
2. Treat network inference and pattern analysis as analytical indicators, not hard facts.
3. Never collapse inference into confirmed fact.
4. When network intelligence exists, analyze the full network, not isolated entities.
5. When proceeds data exists, correlate with promotion windows if timeline data is available.
6. When laundry trail exists, explain the routing significance.
7. When presenting claims, reference their confidence level and weak points. Never present MEDIUM or LOW confidence claims as facts. Always surface contradictions proactively.
8. When timeline correlation data exists, analyze the temporal pattern. Distinguish between simultaneous activity (stronger signal) and sequential activity (weaker signal). When cashout timing aligns with promotion windows, flag this explicitly as a key investigative signal.
9. Structure every substantive response as:
   FACTS (from entities and cross-intelligence)
   INFERENCES (your analysis)
   GAPS (what is missing)
   NEXT STEPS (concrete recommended actions)
   PUBLICATION CAUTION (what cannot be stated publicly yet)
10. Be direct and concrete. No filler. No generic crypto explanations.
11. Prioritize investigator usefulness over comprehensiveness.
12. Use investigator-grade language. The user is not a beginner.`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message:
          "Assistant is not configured on this deployment. Set ANTHROPIC_API_KEY in Vercel.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMsg[] = rawMessages
    .filter(
      (m: unknown): m is ChatMsg =>
        typeof m === "object" &&
        m !== null &&
        (("role" in m && (m as ChatMsg).role === "user") ||
          (m as ChatMsg).role === "assistant") &&
        typeof (m as ChatMsg).content === "string"
    )
    .slice(-20);
  if (messages.length === 0) {
    return NextResponse.json({ error: "no_messages" }, { status: 400 });
  }

  const pack = await buildCaseIntelligencePack(caseId, ctx.workspace.id);

  // PRIVACY QA — dev-only key audit. Never logs values.
  if (process.env.NODE_ENV !== "production") {
    const packKeys = Object.keys(pack as unknown as Record<string, unknown>);
    const entityKeys =
      pack.entities.length > 0
        ? Object.keys(pack.entities[0] as unknown as Record<string, unknown>)
        : [];
    const forbidden = [
      "contentEnc",
      "contentIv",
      "r2Key",
      "r2Bucket",
      "titleEnc",
      "titleIv",
      "tagsEnc",
      "tagsIv",
      "filenameEnc",
      "filenameIv",
    ];
    const violations = [...packKeys, ...entityKeys].filter((k) =>
      forbidden.includes(k) || k.endsWith("Enc") || k.endsWith("Iv")
    );
    console.log("[assistant][privacy-audit] pack keys:", packKeys);
    console.log("[assistant][privacy-audit] entity keys:", entityKeys);
    console.log(
      "[assistant][privacy-audit] entity count:",
      pack.entities.length
    );
    if (violations.length > 0) {
      console.error(
        "[assistant][privacy-audit] FORBIDDEN KEYS LEAKED:",
        violations
      );
    }
  }

  const systemPrompt = buildSystemPrompt(pack);
  const estimatedInputTokens =
    estimateTokens(systemPrompt) +
    messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const estimatedTotal = estimatedInputTokens + 1500;

  const workspace = await prisma.vaultWorkspace.findUnique({
    where: { id: ctx.workspace.id },
    select: { assistantTokensUsed: true, assistantTokensLimit: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "workspace_not_found" }, { status: 500 });
  }

  if (workspace.assistantTokensUsed + estimatedTotal > workspace.assistantTokensLimit) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: "Monthly AI quota reached. Contact INTERLIGENS to increase.",
        used: workspace.assistantTokensUsed,
        limit: workspace.assistantTokensLimit,
      },
      { status: 429 }
    );
  }

  try {
    const llmRes = await llmComplete({
      useCase: "case_assistant",
      systemPrompt,
      maxTokens: 1500,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    if (llmRes.fallbackUsed) {
      console.error("[assistant] llm fallback", llmRes.error);
      return NextResponse.json({ error: "ai_call_failed" }, { status: 500 });
    }

    const responseText = llmRes.content;
    const actualTokens = llmRes.tokensUsed ?? 0;

    await prisma.vaultWorkspace.update({
      where: { id: ctx.workspace.id },
      data: { assistantTokensUsed: { increment: actualTokens } },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "ASSISTANT_QUERY",
      actor: ctx.access.label,
      request,
      metadata: {
        inputTokens: llmRes.inputTokens,
        outputTokens: llmRes.outputTokens,
      },
    });

    const updated = await prisma.vaultWorkspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { assistantTokensUsed: true, assistantTokensLimit: true },
    });

    return NextResponse.json({
      response: responseText,
      tokensUsed: updated?.assistantTokensUsed ?? 0,
      tokensLimit: updated?.assistantTokensLimit ?? 0,
    });
  } catch (err) {
    console.error("[assistant] claude call failed", err);
    return NextResponse.json({ error: "ai_call_failed" }, { status: 500 });
  }
}
