/**
 * POST /api/mobile/v1/ask
 *
 * Mobile-facing ASK INTERLIGENS endpoint.
 * Auth: X-Mobile-Api-Token header (MOBILE_API_TOKEN env var).
 * Body: { question, address, scanContext: { score, tier, riskLevel }, locale?, history? }
 * Response: { answer: string }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisSummary, Verdict } from "@/lib/explanation/types";
import { prisma } from "@/lib/prisma";
import { buildGroundingContext } from "@/lib/ask/groundingContext";
import { generateWhyBullets } from "@/lib/ask/whyBullets";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { timingSafeEqual } from "crypto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// SEC-006 — timing-safe compare on the mobile API token.
function mobileTokenMatches(provided: string | null): boolean {
  const expected = process.env.MOBILE_API_TOKEN;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // still consume timing to equalize
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
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
  // 1. Auth — timing-safe token compare (SEC-006).
  if (!mobileTokenMatches(req.headers.get("X-Mobile-Api-Token"))) {
    return NextResponse.json({ error: "Unauthorized. A valid API token is required." }, { status: 401 });
  }

  // 2. Rate limit — shared Upstash-backed helper (SEC-004).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, RATE_LIMIT_PRESETS.osint);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

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

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 250,
      system: systemPrompt,
      messages: [{ role: "user", content: sanitized }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return NextResponse.json({ answer: stripMarkdown(text) });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error("[mobile/ask] error:", isAbort ? "timeout" : err);
    return NextResponse.json(
      { error: isAbort ? "timeout" : "unavailable" },
      { status: 503 },
    );
  }
}
