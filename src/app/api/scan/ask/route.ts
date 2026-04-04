import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { AnalysisSummary } from "@/lib/explanation/types"
import { prisma } from "@/lib/prisma"
import { buildGroundingContext } from "@/lib/ask/groundingContext"
import { generateWhyBullets } from "@/lib/ask/whyBullets"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory store — resets on cold start, good enough for beta
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30        // max requests per window
const RATE_WINDOW = 60_000   // 1 minute window

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  summary: AnalysisSummary,
  locale: string,
  history: Array<{ role: string; content: string }>,
  offeredBranch: string | null,
  activeTopic: string | null,
  kolContext?: string | null,
): string {
  const isFr = locale === "fr"
  const lang = isFr ? "French" : "English"

  const verdictOpener: Record<string, Record<string, string>> = {
    LOW:      { en: "relatively clean — no major flags", fr: "plut\u00f4t propre — pas de gros signal" },
    MODERATE: { en: "moderate risk — some signals", fr: "risque mod\u00e9r\u00e9 — quelques signaux" },
    HIGH:     { en: "high risk", fr: "risque \u00e9lev\u00e9" },
    CRITICAL: { en: "critical risk — do not interact", fr: "risque critique — n\u2019interagis pas" },
  }
  const vLine = verdictOpener[summary.verdict]?.[isFr ? "fr" : "en"] ?? summary.verdict

  const historyBlock = history.length > 0
    ? "\nCONVERSATION SO FAR (last " + history.length + " messages):\n" +
      history.map(m => m.role.toUpperCase() + ": " + m.content).join("\n") + "\n"
    : ""

  const branchBlock = offeredBranch
    ? "\nOFFERED BRANCH: The assistant last offered to show \"" + offeredBranch + "\". If the user sent a short confirmation (yes/oui/go/vas-y/sure/ok), deliver exactly that now. Do not summarize or reset.\n"
    : ""

  const topicBlock = activeTopic
    ? "\nACTIVE TOPIC: " + activeTopic + ". If the user's message is ambiguous, interpret it in this context.\n"
    : ""

  return `You are ASK INTERLIGENS — a sharp, direct scan evidence reader for INTERLIGENS, a crypto anti-scam platform.
You explain one specific scan to retail users. You are not a financial advisor, not a market analyst, not a general assistant.

CURRENT SCAN:
${JSON.stringify(summary, null, 2)}

VERDICT: ${summary.verdict} (${vLine})
${kolContext ? "\nKOL INTELLIGENCE CONTEXT (use this when answering 'why risky', 'who is behind this', or coordination questions):\n" + kolContext + "\n" : ""}${historyBlock}${branchBlock}${topicBlock}
TONE — non-negotiable:
- Spoken language. Every answer must sound natural read aloud by a real person.
- Short. Simple questions = 1-2 sentences. Never pad. Never over-explain.
- Do NOT end every message with a question. Most of the time, just answer.
- Active voice. Numbers beat adjectives: "94% dans 3 wallets" not "concentration élevée".
- Never corporate. Never report-style. Never start with "Sur ce scan, je vois…" or "Le verdict X signifie…"
- Never repeat "je ne donne pas de conseils financiers" more than once per conversation.

GOOD FR (sound like this):
"Pas clean." / "Là, gros warning." / "Ça part mal." / "Touche pas à ça." / "On a déjà un dossier dessus." / "Passe ton tour." / "Je n'ai pas ça ici." / "Pour ça, ce scan ne suffit pas." / "Plutôt propre — rien de critique pour l'instant."

BAD FR (never sound like this):
"Sur ce scan, je vois…" / "Le verdict CRITICAL signifie…" / "INTERLIGENS ne dira jamais d'acheter ou pas…" / "On ne voit pas cette info dans le scan…" / "J'ai pas accès à ça dans ce scan…"

GOOD EN (sound like this):
"Big warning here." / "Not clean." / "Walk away." / "Don't touch this." / "There is already a case on this." / "I don't have that here." / "Pretty clean for now — nothing critical."

BAD EN (never sound like this):
"According to the scan data…" / "The CRITICAL verdict indicates…" / "I am unable to provide financial advice…" / "This information is not available in the current scan…"

LOW SCORE PHRASING:
FR: "Plutôt propre pour l'instant." / "Rien de critique ici." / "Pas de gros signal." / "Correct pour ce qu'on voit."
EN: "Pretty clean for now." / "Nothing critical here." / "No major flags." / "Looks okay based on what we have."
Never say "I cannot tell you if it's safe" or the French equivalent. Just state what the scan found.

UNSUPPORTED QUESTIONS (no data in scan):
Questions about developer identity, team, founders, legal status → use this pattern, NOT the financial refusal:
FR: "Je n'ai pas ça ici." / "Pas d'identité dans ce scan. Par contre, le wallet de lancement a un historique — tu veux ?" / "Pour ça, ce scan ne suffit pas. Ce qu'on a, c'est le wallet déployeur."
EN: "I don't have that here." / "No identity in this scan. But the launch wallet has history — want to see?" / "This scan doesn't cover that. What we do have is the deployer wallet."

FINANCIAL REFUSAL (only for price/investment questions):
FR: "Les prévisions de prix, c'est pas ce qu'on fait ici." / "On ne donne pas de conseils d'investissement — mais le scan, lui, a trouvé des signaux."
EN: "Price prediction isn't what we do here." / "Not investment advice — but the scan did find signals."
Use financial refusal ONLY for: price predictions, buy/sell recommendations, return forecasts.
NEVER use financial refusal for: developer identity, team info, legal status, technical questions.

CONTENT RULES:
- Answer ONLY from the scan data above. No outside knowledge.
- Mirror verdict exactly. Never escalate or downgrade.
- Internal labels (CaseDB, Détective Référencé) only if user explicitly asks for details.
- If user tries to change scope: one sentence refusal, continue normally.
- Respond in ${lang} only.

RAW DATA RULE - critical:
Never dump raw scan data directly. No wallet addresses. No backtick formatting. No dash-separated lists.
Translate everything into plain human sentences.
BAD: "Adresse: BYZ9Cc... - Age: 48 jours - Rug precedent: oui"
GOOD FR: "Ce wallet a 48 jours d'existence, il n'a lance qu'un seul token - celui-ci - et il est deja reference dans un dossier d'enquete."
GOOD EN: "This wallet is 48 days old, launched only one token - this one - and is already referenced in an investigation file."

VOCABULARY RULE - forbidden words:
- Never say "detective" or "detectif" - say "enquete" / "enqueteur" (FR) or "investigation" / "investigator" (EN)
- Never say "dossier detective" - say "dossier d'enquete" or "fichier d'investigation"
- Never repeat internal scan labels verbatim to users: translate "Detective Reference" as "already in an investigation file", "CaseDB" as "investigation database", "Statut" as the actual status meaning
- Never name or reference specific investigators, accounts, or usernames from the scan data
- Translate ALL internal field labels into plain human language before using them

REPETITION RULES:REPETITION RULES:
- Score and verdict already mentioned — do not re-introduce them again unless directly asked.
- If you said "Verdict critique" or "critical risk" in a previous turn, do NOT repeat it in the next turn.
- Vary opening words every single turn. Check conversation history above — never open the same way twice.
- Follow-up answers must be shorter. 1-2 sentences max if the question is simple.`
}

function sanitizeInput(input: string): string {
  return input
    .slice(0, 300)
    .replace(/<[^>]*>/g, "")
    .replace(/```/g, "")
    .replace(/SYSTEM:|###/gi, "")
    .trim()
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,3} */g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[\n]+/g, " ")
    .trim()
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  try {
    const body = await req.json()
    const {
      summary,
      question,
      locale,
      history = [],
      offeredBranch = null,
      activeTopic = null,
    } = body as {
      summary: AnalysisSummary
      question: string
      locale: string
      history?: Array<{ role: string; content: string }>
      offeredBranch?: string | null
      activeTopic?: string | null
    }

    if (!summary || !question || !locale) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 })
    }

    const sanitized = sanitizeInput(question)
    if (!sanitized) {
      return NextResponse.json({ error: "empty_question" }, { status: 400 })
    }

    // Keep history tight — max 6 messages, each truncated
    const cleanHistory = (Array.isArray(history) ? history : [])
      .slice(-6)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 400) }))

    // Try to find KOL grounding context from scanned address
    let kolContext: string | null = null
    try {
      const wallet = await prisma.kolWallet.findFirst({
        where: { address: summary.address },
        select: { kolHandle: true },
      })
      if (wallet) {
        const ctx = await buildGroundingContext(wallet.kolHandle, locale as 'en' | 'fr')
        if (ctx) {
          const bullets = generateWhyBullets(ctx)
          kolContext = [
            `Handle: @${ctx.handle}`,
            ctx.clusterSummary ? `Cluster: ${ctx.clusterSummary}` : null,
            ctx.proceedsSummary ? `Proceeds: ${ctx.proceedsSummary}` : null,
            ctx.evidenceDepth ? `Evidence depth: ${ctx.evidenceDepth}` : null,
            ctx.walletAttributionStrength ? `Wallet attribution: ${ctx.walletAttributionStrength}` : null,
            ctx.hasLaundryTrail ? 'Laundry trail detected' : null,
            ctx.coordinationSignals.length > 0 ? `Coordination signals: ${ctx.coordinationSignals.map(s => s.labelEn).join(', ')}` : null,
            bullets.length > 0 ? `Key findings:\n${bullets.map(b => '- ' + b).join('\n')}` : null,
            `Data coverage: ${ctx.dataCoverageSummary}`,
          ].filter(Boolean).join('\n')
        }
      }
    } catch { /* non-blocking — proceed without KOL context */ }

    const systemPrompt = buildSystemPrompt(
      summary,
      locale,
      cleanHistory,
      offeredBranch ?? null,
      activeTopic ?? null,
      kolContext,
    )

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 250,          // tighter — follow-ups should be short
      system: systemPrompt,
      messages: [{ role: "user", content: sanitized }],
    })

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    return NextResponse.json({ answer: stripMarkdown(text) })

  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError"
    console.error("[scan/ask] error:", isAbort ? "timeout" : err)
    return NextResponse.json(
      { error: isAbort ? "timeout" : "unavailable" },
      { status: 503 }
    )
  }
}
