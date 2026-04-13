/**
 * POST /api/mobile/v1/ask
 *
 * Mobile-facing ASK INTERLIGENS endpoint.
 * Auth: X-Mobile-Api-Token header (MOBILE_API_TOKEN env var).
 * Body: { question, address, scanContext: { score, tier, riskLevel }, locale?, history? }
 * Response: { answer: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { llmComplete } from "@/lib/llm";
import type { AnalysisSummary, Verdict } from "@/lib/explanation/types";
import { prisma } from "@/lib/prisma";
import { buildGroundingContext } from "@/lib/ask/groundingContext";
import { generateWhyBullets } from "@/lib/ask/whyBullets";

// ── Rate limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

function checkRL(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIER_TO_VERDICT: Record<string, Verdict> = {
  GREEN: "LOW",
  ORANGE: "MODERATE",
  RED: "CRITICAL",
};

function sanitizeInput(input: string): string {
  return input
    .slice(0, 300)
    .replace(/<[^>]*>/g, "")
    .replace(/```/g, "")
    .replace(/SYSTEM:|###/gi, "")
    .trim();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,3} */g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[\n]+/g, " ")
    .trim();
}

function buildSystemPrompt(
  summary: AnalysisSummary,
  locale: string,
  history: Array<{ role: string; content: string }>,
  kolContext: string | null,
): string {
  const isFr = locale === "fr";
  const lang = isFr ? "French" : "English";

  const verdictOpener: Record<string, Record<string, string>> = {
    LOW:      { en: "relatively clean — no major flags", fr: "plutôt propre — pas de gros signal" },
    MODERATE: { en: "moderate risk — some signals", fr: "risque modéré — quelques signaux" },
    HIGH:     { en: "high risk", fr: "risque élevé" },
    CRITICAL: { en: "critical risk — do not interact", fr: "risque critique — n\u2019interagis pas" },
  };
  const vLine = verdictOpener[summary.verdict]?.[isFr ? "fr" : "en"] ?? summary.verdict;

  const historyBlock = history.length > 0
    ? "\nCONVERSATION SO FAR (last " + history.length + " messages):\n" +
      history.map(m => m.role.toUpperCase() + ": " + m.content).join("\n") + "\n"
    : "";

  return `You are ASK INTERLIGENS — a sharp, direct scan evidence reader for INTERLIGENS, a crypto anti-scam platform.
You explain one specific scan to retail users. You are not a financial advisor, not a market analyst, not a general assistant.

CURRENT SCAN:
${JSON.stringify(summary, null, 2)}

VERDICT: ${summary.verdict} (${vLine})
${kolContext ? "\nKOL INTELLIGENCE CONTEXT:\n" + kolContext + "\n" : ""}${historyBlock}
TONE — non-negotiable:
- Spoken language. Every answer must sound natural read aloud by a real person.
- Short. Simple questions = 1-2 sentences. Never pad. Never over-explain.
- Do NOT end every message with a question. Most of the time, just answer.
- Active voice. Numbers beat adjectives.
- Never corporate. Never report-style.

CONTENT RULES:
- Answer ONLY from the scan data above. No outside knowledge.
- Mirror verdict exactly. Never escalate or downgrade.
- Respond in ${lang} only.

RAW DATA RULE:
Never dump raw scan data directly. No wallet addresses. No backtick formatting.
Translate everything into plain human sentences.

VOCABULARY RULE:
- Never say "detective" or "detectif" — say "enquête" / "enquêteur" (FR) or "investigation" / "investigator" (EN).
- Translate ALL internal field labels into plain human language.`;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  const mobileToken = req.headers.get("X-Mobile-Api-Token");
  if (!mobileToken || mobileToken !== process.env.MOBILE_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized. A valid API token is required." }, { status: 401 });
  }

  // 2. Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRL(ip)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 3. Parse body
  let body: {
    question?: string;
    address?: string;
    scanContext?: { score?: number; tier?: string; riskLevel?: string };
    locale?: string;
    history?: Array<{ role: string; content: string }>;
  };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[mobile/ask] JSON parse error:", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  console.log("[mobile/ask] body received:", JSON.stringify(body).slice(0, 500));

  const question = body.question?.trim();
  const address = body.address?.trim();
  const ctx = body.scanContext;

  if (!question || !address || !ctx || ctx.score == null || !ctx.tier) {
    return NextResponse.json({ error: "missing_fields", expected: { question: "string", address: "string", scanContext: { score: "number", tier: "string", riskLevel: "string" } }, received: { question: !!body.question, address: !!body.address, scanContext: body.scanContext ?? null } }, { status: 400 });
  }

  const sanitized = sanitizeInput(question);
  if (!sanitized) {
    return NextResponse.json({ error: "empty_question" }, { status: 400 });
  }

  const locale = body.locale ?? "en";
  const verdict = TIER_TO_VERDICT[ctx.tier.toUpperCase()] ?? "MODERATE";

  // Build AnalysisSummary from mobile scan context
  const summary: AnalysisSummary = {
    address,
    chain: "unknown",
    tigerScore: ctx.score ?? 0,
    verdict,
    topReasons: [],
  };

  const cleanHistory = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 400) }));

  // KOL grounding (non-blocking)
  let kolContext: string | null = null;
  try {
    const wallet = await prisma.kolWallet.findFirst({
      where: { address },
      select: { kolHandle: true },
    });
    if (wallet) {
      const gCtx = await buildGroundingContext(wallet.kolHandle, locale as "en" | "fr");
      if (gCtx) {
        const bullets = generateWhyBullets(gCtx);
        kolContext = [
          `Handle: @${gCtx.handle}`,
          gCtx.clusterSummary ? `Cluster: ${gCtx.clusterSummary}` : null,
          gCtx.proceedsSummary ? `Proceeds: ${gCtx.proceedsSummary}` : null,
          gCtx.evidenceDepth ? `Evidence depth: ${gCtx.evidenceDepth}` : null,
          gCtx.walletAttributionStrength ? `Wallet attribution: ${gCtx.walletAttributionStrength}` : null,
          gCtx.hasLaundryTrail ? "Laundry trail detected" : null,
          gCtx.coordinationSignals.length > 0
            ? `Coordination signals: ${gCtx.coordinationSignals.map(s => s.labelEn).join(", ")}`
            : null,
          bullets.length > 0 ? `Key findings:\n${bullets.map(b => "- " + b).join("\n")}` : null,
          `Data coverage: ${gCtx.dataCoverageSummary}`,
        ].filter(Boolean).join("\n");
      }
    }
  } catch { /* non-blocking */ }

  try {
    const systemPrompt = buildSystemPrompt(summary, locale, cleanHistory, kolContext);

    const llmRes = await llmComplete({
      useCase: "ask_interligens",
      systemPrompt,
      maxTokens: 250,
      messages: [{ role: "user", content: sanitized }],
    });

    if (llmRes.fallbackUsed) {
      console.error("[mobile/ask] llm fallback", llmRes.error);
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    return NextResponse.json({ answer: stripMarkdown(llmRes.content) });
  } catch (err: unknown) {
    console.error("[mobile/ask] error:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
