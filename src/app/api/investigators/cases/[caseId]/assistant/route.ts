import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

type ChatMsg = { role: "user" | "assistant"; content: string };

type CaseContext = {
  title?: string;
  template?: string | null;
  entities?: Array<{
    type: string;
    value: string;
    label: string | null;
    tigerScore: number | null;
  }>;
  hypotheses?: Array<{
    title: string;
    status: string;
    confidence: number;
  }>;
  enrichment?: Record<
    string,
    {
      inKolRegistry?: boolean;
      isKnownBad?: boolean;
      kolName?: string | null;
    }
  >;
};

function buildSystemPrompt(ctx: CaseContext): string {
  const entityLines = (ctx.entities ?? [])
    .map(
      (e) =>
        `- ${e.type} | ${e.value}${e.label ? ` | ${e.label}` : ""}${e.tigerScore != null ? ` | TigerScore ${e.tigerScore}` : ""}`
    )
    .join("\n");
  const hypoLines = (ctx.hypotheses ?? [])
    .map((h) => `- ${h.title} (${h.status}, ${h.confidence}%)`)
    .join("\n");
  const enrichmentHits = Object.entries(ctx.enrichment ?? {})
    .filter(([, v]) => v?.inKolRegistry || v?.isKnownBad)
    .map(([id, v]) => {
      const flags: string[] = [];
      if (v?.isKnownBad) flags.push("KNOWN_BAD");
      if (v?.inKolRegistry) flags.push(`KOL${v.kolName ? `:${v.kolName}` : ""}`);
      return `- ${id}: ${flags.join(", ")}`;
    })
    .join("\n");

  return `You are an investigative intelligence assistant for INTERLIGENS, a crypto anti-scam platform. You are helping an investigator working on a case.

CASE CONTEXT:
Title: ${ctx.title ?? "(untitled)"}
Template: ${ctx.template ?? "blank"}

ENTITIES IN THIS CASE:
${entityLines || "(none yet)"}

HYPOTHESES:
${hypoLines || "(none yet)"}

CROSS-INTELLIGENCE HITS:
${enrichmentHits || "(none)"}

YOUR ROLE:
- Help analyze patterns in the entities
- Suggest next investigation steps
- Help formulate hypotheses
- Help draft summaries or reports
- Answer questions about crypto investigation methodology
- You only see derived entities — never raw files or private notes
- Always distinguish facts (from entities) vs inferences (your analysis)
- Use investigator-grade language
- Be direct and concrete, not verbose`;
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

  const caseContext: CaseContext =
    typeof body.caseContext === "object" && body.caseContext !== null
      ? (body.caseContext as CaseContext)
      : {};

  const systemPrompt = buildSystemPrompt(caseContext);
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
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const responseText =
      textBlock && "text" in textBlock && typeof textBlock.text === "string"
        ? textBlock.text
        : "";

    const actualTokens =
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0);

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
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
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
