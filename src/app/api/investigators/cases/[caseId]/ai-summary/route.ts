import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

const SYSTEM_PROMPT = `You are an investigative intelligence assistant for INTERLIGENS, a crypto anti-scam platform. Your role is to help investigators translate complex on-chain evidence into clear summaries.

You only work with derived data — never raw files or private notes. Always distinguish facts from inferences. Never invent information. Never mention handles, wallets, or specific values that were not provided in the input.

You must respond with valid JSON only, no prose before or after.`;

function mockRetail() {
  return {
    summary:
      "This case is pending analysis. The Anthropic API key is not configured on this deployment, so no AI summary has been generated. Once the key is added, re-run the summary button.",
    redFlags: [
      "ANTHROPIC_API_KEY environment variable is missing",
      "No live analysis available for this case",
    ],
    riskLevel: "LOW",
    riskJustification: "Mock response — no real analysis performed.",
    disclaimer:
      "This summary is a placeholder generated client-side. Add ANTHROPIC_API_KEY to enable real analysis.",
  };
}

function mockInvestigator() {
  return {
    caseAssessment:
      "Anthropic API key not configured on this deployment. No live case analysis available.",
    keyPatterns: ["Environment variable ANTHROPIC_API_KEY missing"],
    evidenceStrengths: [],
    openQuestions: ["Configure ANTHROPIC_API_KEY in Vercel env"],
    nextSteps: ["Add the API key via Vercel UI, then regenerate"],
    publishabilityNote:
      "Cannot assess publishability without AI analysis configured.",
  };
}

type CaseEntity = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  tigerScore: number | null;
};

type CaseHypothesis = {
  title: string;
  status: string;
  confidence: number;
};

type CaseTimeline = {
  date: string;
  title: string;
  description: string | null;
};

function buildRetailPrompt(data: {
  entities: CaseEntity[];
  hypotheses: CaseHypothesis[];
  timeline: CaseTimeline[];
}) {
  return `Analyze this case and generate a retail-readable summary.

Entities: ${JSON.stringify(data.entities)}
Hypotheses: ${JSON.stringify(data.hypotheses)}
Timeline: ${JSON.stringify(data.timeline)}

Generate:
1. ONE PARAGRAPH summary (3-4 sentences, retail-readable, no jargon)
2. KEY RED FLAGS (3-5 bullet points, concrete, sourced from entities)
3. RISK LEVEL: LOW / MEDIUM / HIGH with one-sentence justification
4. DISCLAIMER: what is confirmed vs what is inferred

Format as JSON: { "summary": string, "redFlags": string[], "riskLevel": "LOW" | "MEDIUM" | "HIGH", "riskJustification": string, "disclaimer": string }`;
}

function buildInvestigatorPrompt(data: {
  entities: CaseEntity[];
  hypotheses: CaseHypothesis[];
  timeline: CaseTimeline[];
}) {
  return `Analyze this case data and provide an investigator-grade assessment.

Entities: ${JSON.stringify(data.entities)}
Hypotheses: ${JSON.stringify(data.hypotheses)}
Timeline: ${JSON.stringify(data.timeline)}

Return JSON:
{
  "caseAssessment": string (2-3 sentences, technical, investigator-grade),
  "keyPatterns": string[] (3-5 patterns identified),
  "evidenceStrengths": string[] (what's well-documented),
  "openQuestions": string[] (what still needs investigation),
  "nextSteps": string[] (3 concrete recommended actions),
  "publishabilityNote": string (is this case ready to publish? why/why not?)
}`;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const mode: "retail" | "investigator" =
    body.mode === "investigator" ? "investigator" : "retail";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "AI_SUMMARY_MOCK",
      actor: ctx.access.label,
      request,
      metadata: { mode, reason: "no_api_key" },
    });
    if (mode === "investigator") {
      return NextResponse.json({
        analysis: mockInvestigator(),
        mock: true,
      });
    }
    return NextResponse.json({ summary: mockRetail(), mock: true });
  }

  const entitiesRaw = await prisma.vaultCaseEntity.findMany({
    where: { caseId },
    take: 500,
  });
  const hypothesesRaw = await prisma.vaultHypothesis.findMany({
    where: { caseId },
    take: 100,
  });
  const timelineRaw = await prisma.vaultTimelineEvent.findMany({
    where: { caseId },
    orderBy: { eventDate: "asc" },
    take: 200,
  });

  const entities: CaseEntity[] = entitiesRaw.map((e) => ({
    id: e.id,
    type: e.type,
    value: e.value,
    label: e.label,
    tigerScore: e.tigerScore,
  }));
  const hypotheses: CaseHypothesis[] = hypothesesRaw.map((h) => ({
    title: h.title,
    status: h.status,
    confidence: h.confidence,
  }));
  const timeline: CaseTimeline[] = timelineRaw.map((t) => ({
    date: t.eventDate.toISOString(),
    title: t.title,
    description: t.description,
  }));

  const userPrompt =
    mode === "investigator"
      ? buildInvestigatorPrompt({ entities, hypotheses, timeline })
      : buildRetailPrompt({ entities, hypotheses, timeline });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw =
      textBlock && "text" in textBlock && typeof textBlock.text === "string"
        ? textBlock.text
        : "";
    const parsed = extractJson(raw);

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "parse_failed", raw },
        { status: 502 }
      );
    }

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "AI_SUMMARY_GENERATED",
      actor: ctx.access.label,
      request,
      metadata: {
        mode,
        entityCount: entities.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    });

    if (mode === "investigator") {
      return NextResponse.json({ analysis: parsed });
    }
    return NextResponse.json({ summary: parsed });
  } catch (err) {
    console.error("[ai-summary] claude call failed", err);
    return NextResponse.json({ error: "ai_call_failed" }, { status: 500 });
  }
}
