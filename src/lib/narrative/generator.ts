// src/lib/narrative/generator.ts
// Narrative generator — MODE 1 template + MODE 2 Claude Haiku

import Anthropic from "@anthropic-ai/sdk";

export interface NarrativeInput {
  kolHandle?: string;
  tokenSymbol?: string;
  tokenMint?: string;
  totalProceedsUsd?: number;
  cashoutDestination?: string;
  intermediateWallets?: number;
  shillFollowers?: number;
  priceDropPct?: number;
  deltaHours?: number;
  chain?: string;
}

export interface NarrativeResult {
  narrative_en: string;
  narrative_fr: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  generated_at: Date;
  input_completeness: number;
}

// ── Completeness ─────────────────────────────────────────────────────────────

const FIELDS: Array<keyof NarrativeInput> = [
  "kolHandle", "tokenSymbol", "tokenMint", "totalProceedsUsd",
  "cashoutDestination", "intermediateWallets", "shillFollowers",
  "priceDropPct", "deltaHours", "chain",
];

export function computeInputCompleteness(input: NarrativeInput): number {
  const filled = FIELDS.filter((f) => input[f] !== undefined && input[f] !== null).length;
  return Math.round((filled / FIELDS.length) * 100);
}

function confidenceFromCompleteness(c: number): NarrativeResult["confidence"] {
  if (c >= 70) return "HIGH";
  if (c >= 40) return "MEDIUM";
  return "LOW";
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtUsdFr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M$`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} K$`;
  return `${Math.round(n)} $`;
}

function fmtDelta(h: number): string {
  if (h < 1)  return "under an hour";
  if (h < 24) return `${Math.round(h)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}

function fmtDeltaFr(h: number): string {
  if (h < 1)  return "moins d'une heure";
  if (h < 24) return `${Math.round(h)} heures`;
  return `${(h / 24).toFixed(1)} jours`;
}

// ── Template MODE ─────────────────────────────────────────────────────────────

export function buildTemplateNarrative(input: NarrativeInput): { en: string; fr: string } {
  const token     = input.tokenSymbol ? `$${input.tokenSymbol}` : "the token";
  const tokenFr   = input.tokenSymbol ? `$${input.tokenSymbol}` : "le token";
  const handle    = input.kolHandle ?? "The KOL";
  const handleFr  = input.kolHandle ? `@${input.kolHandle}` : "Le KOL";
  const proceeds  = input.totalProceedsUsd ? fmtUsd(input.totalProceedsUsd)  : "an undisclosed amount";
  const proceedsFr = input.totalProceedsUsd ? fmtUsdFr(input.totalProceedsUsd) : "un montant non divulgué";
  const dest      = input.cashoutDestination ?? "an exchange";
  const destFr    = input.cashoutDestination ?? "un exchange";
  const delta     = input.deltaHours !== undefined ? `within ${fmtDelta(input.deltaHours)}` : "within hours";
  const deltaFr   = input.deltaHours !== undefined ? `en moins de ${fmtDeltaFr(input.deltaHours)}` : "en quelques heures";
  const followers = input.shillFollowers ? ` to ${input.shillFollowers.toLocaleString("en-US")} followers` : "";
  const followersFr = input.shillFollowers ? ` à ${input.shillFollowers.toLocaleString("fr-FR")} abonnés` : "";

  // Sentence 1: shill + sell
  const s1en = `After promoting ${token}${followers}, @${handle} transferred ${proceeds} to ${dest} ${delta}.`;
  const s1fr = `Après avoir promu ${tokenFr}${followersFr}, ${handleFr} a transféré ${proceedsFr} vers ${destFr} ${deltaFr}.`;

  // Sentence 2: intermediate wallets
  const s2en = input.intermediateWallets && input.intermediateWallets > 0
    ? ` The funds passed through ${input.intermediateWallets} intermediate wallet${input.intermediateWallets > 1 ? "s" : ""} before reaching the exchange.`
    : "";
  const s2fr = input.intermediateWallets && input.intermediateWallets > 0
    ? ` Les fonds ont transité par ${input.intermediateWallets} wallet${input.intermediateWallets > 1 ? "s" : ""} intermédiaire${input.intermediateWallets > 1 ? "s" : ""} avant d'atteindre l'exchange.`
    : "";

  // Sentence 3: price drop
  const s3en = input.priceDropPct && input.priceDropPct > 0
    ? ` Retail buyers were left with a token that lost ${Math.round(input.priceDropPct)}% of its value.`
    : "";
  const s3fr = input.priceDropPct && input.priceDropPct > 0
    ? ` Les acheteurs retail se retrouvent avec un token qui a perdu ${Math.round(input.priceDropPct)}% de sa valeur.`
    : "";

  return {
    en: (s1en + s2en + s3en).trim(),
    fr: (s1fr + s2fr + s3fr).trim(),
  };
}

// ── Claude Haiku MODE ────────────────────────────────────────────────────────

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const NARRATIVE_SYSTEM = `You are a crypto fraud analyst writing for retail investors.
Write a factual 3-5 sentence summary in plain language — no jargon, no opinions, facts only.
Respond ONLY with a JSON object with two string keys: "en" and "fr".
Both values must be 3-5 sentences. Do not add markdown, do not add any other keys.`;

export async function buildClaudeNarrative(
  input: NarrativeInput,
): Promise<{ en: string; fr: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create(
      {
        model: HAIKU_MODEL,
        max_tokens: 300,
        system: NARRATIVE_SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      },
      { timeout: 8_000 },
    );

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // Strip potential markdown fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).en === "string" &&
      typeof (parsed as Record<string, unknown>).fr === "string"
    ) {
      return {
        en: ((parsed as Record<string, unknown>).en as string).trim(),
        fr: ((parsed as Record<string, unknown>).fr as string).trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function generateNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  const completeness = computeInputCompleteness(input);
  const confidence = confidenceFromCompleteness(completeness);
  const generated_at = new Date();

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const useApi = hasApiKey && completeness >= 40;

  let texts: { en: string; fr: string } | null = null;

  if (useApi) {
    texts = await buildClaudeNarrative(input);
  }

  // Fallback to template if API disabled, low completeness, or API call failed
  if (!texts || !texts.en || !texts.fr) {
    texts = buildTemplateNarrative(input);
  }

  return {
    narrative_en: texts.en,
    narrative_fr: texts.fr,
    confidence,
    generated_at,
    input_completeness: completeness,
  };
}
