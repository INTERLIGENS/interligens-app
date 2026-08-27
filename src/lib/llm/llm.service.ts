/**
 * LLM Service — INTERLIGENS single entry point for all LLM calls.
 *
 * Server-side only. 100% generic — no INTERLIGENS business logic lives here.
 * TigerScore scoring is deterministic and MUST NOT route through this service.
 *
 * Default provider: Anthropic (claude-sonnet-4-5).
 * Fallback architecture: OpenAI / Mistral interfaces are stubbed until needed.
 * Never throws — always returns an LLMResponse with fallbackUsed=true on error.
 */

import Anthropic from "@anthropic-ai/sdk"

export type LLMProvider = "anthropic" | "openai" | "mistral"

export type LLMUseCase =
  | "ask_interligens"
  | "case_assistant"
  | "dark_pattern_detector"
  | "shill_exit_analysis"
  | "entity_enrichment"
  | "report_generation"

export interface LLMMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  provider?: LLMProvider
  useCase: LLMUseCase
}

/**
 * Pourquoi un appel a échoué. Six causes, parce que le caller n'a que six
 * réactions possibles :
 *   MODEL_NOT_FOUND  l'identifiant de modèle est mort → changer le code
 *   AUTH             clé absente, invalide ou sans droit → changer la config
 *   RATE_LIMIT       quota atteint → réessayer plus tard
 *   TIMEOUT          réseau ou délai dépassé → réessayer
 *   INVALID_REQUEST  la requête est refusée telle quelle → changer les paramètres
 *   UPSTREAM_ERROR   panne côté fournisseur, ou cause inconnue → réessayer, surveiller
 *
 * L'incident du 2026-08-27 tient entièrement à l'absence de cette distinction :
 * un modèle retiré et un timeout produisaient le même signal, donc personne ne
 * pouvait savoir qu'il fallait changer un identifiant plutôt que réessayer.
 */
export type LLMErrorKind =
  | "MODEL_NOT_FOUND"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "UPSTREAM_ERROR"

export interface LLMResponse {
  content: string
  provider: LLMProvider
  useCase: LLMUseCase
  tokensUsed?: number
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  fallbackUsed: boolean
  /** Cause de l'échec. Absent sur un succès. */
  errorKind?: LLMErrorKind
  /** Message d'origine, tronqué. Le nom sert à décider, le message à diagnostiquer. */
  error?: string
}

// Incident 2026-08-27 : ce champ portait "claude-sonnet-4-20250514"
// (Claude Sonnet 4), retiré le 2026-06-15. Chaque appel revenait en
// 404 not_found_error et le cron de veille répondait quand même {ok:true} —
// deux mois sans résumé, sans alerte. Remplacé par claude-sonnet-4-5, ACTIF, et
// déjà l'identifiant utilisé par les trois autres appels Anthropic du dépôt
// (scan/ask, mobile/ask, osint/vision). Changement d'identifiant seul : aucune
// migration de paramètres, aucune centralisation.
// Exporté : la sonde watchdog « Veille LLM » teste CE modèle, pas une copie.
// Une constante dupliquée ailleurs dériverait au premier changement, et la
// sonde certifierait alors la disponibilité d'un modèle que la prod n'utilise
// plus — précisément le genre de mensonge que l'incident a coûté deux mois.
export const ANTHROPIC_MODEL = "claude-sonnet-4-5"
const DEFAULT_MAX_TOKENS = 1024
const TIMEOUT_MS = 15_000

function logCall(res: LLMResponse) {
  console.log(
    `[llm] useCase=${res.useCase} provider=${res.provider} latencyMs=${res.latencyMs} tokens=${res.tokensUsed ?? 0} fallback=${res.fallbackUsed}${res.errorKind ? ` errorKind=${res.errorKind}` : ""}${res.error ? ` error=${res.error}` : ""}`,
  )
}

/**
 * Le SDK expose ses classes d'erreur en statiques sur le client. On teste
 * l'appartenance quand la classe existe, puis on retombe sur le code HTTP —
 * de sorte qu'un renommage côté SDK dégrade la précision sans jamais faire
 * perdre la distinction.
 */
function isSdkError(err: unknown, className: string): boolean {
  const Ctor = (Anthropic as unknown as Record<string, unknown>)[className]
  return typeof Ctor === "function" && err instanceof (Ctor as new () => Error)
}

export function classifyLLMError(err: unknown): LLMErrorKind {
  if (isSdkError(err, "NotFoundError")) return "MODEL_NOT_FOUND"
  if (isSdkError(err, "AuthenticationError") || isSdkError(err, "PermissionDeniedError")) return "AUTH"
  if (isSdkError(err, "RateLimitError")) return "RATE_LIMIT"
  if (
    isSdkError(err, "APIConnectionTimeoutError") ||
    isSdkError(err, "APITimeoutError") ||
    isSdkError(err, "APIConnectionError")
  )
    return "TIMEOUT"
  if (isSdkError(err, "BadRequestError") || isSdkError(err, "UnprocessableEntityError"))
    return "INVALID_REQUEST"

  const e = err as { name?: unknown; status?: unknown } | null
  const status = typeof e?.status === "number" ? e.status : undefined
  // Sur /v1/messages, un 404 signifie un identifiant de modèle inconnu — c'est
  // le cas de l'incident. Il n'y a pas d'autre ressource à ne pas trouver.
  if (status === 404) return "MODEL_NOT_FOUND"
  if (status === 401 || status === 403) return "AUTH"
  if (status === 429) return "RATE_LIMIT"
  if (status === 408) return "TIMEOUT"
  if (status === 400 || status === 422) return "INVALID_REQUEST"

  const name = typeof e?.name === "string" ? e.name : ""
  if (/timeout|abort|connection/i.test(name)) return "TIMEOUT"

  // Jamais vide : une cause inconnue reste une cause nommée.
  return "UPSTREAM_ERROR"
}

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const startedAt = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    const res: LLMResponse = {
      content: "",
      provider: "anthropic",
      useCase: req.useCase,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      errorKind: "AUTH",
      error: "missing_api_key",
    }
    logCall(res)
    return res
  }

  const client = new Anthropic({ apiKey })
  const anthropicMessages = req.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

  try {
    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.systemPrompt ? { system: req.systemPrompt } : {}),
        messages: anthropicMessages,
      },
      { timeout: TIMEOUT_MS },
    )

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const inputTokens = response.usage?.input_tokens ?? 0
    const outputTokens = response.usage?.output_tokens ?? 0

    const res: LLMResponse = {
      content,
      provider: "anthropic",
      useCase: req.useCase,
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
    }
    logCall(res)
    return res
  } catch (err: unknown) {
    const message = err instanceof Error ? `${err.name}:${err.message}` : "unknown_error"
    const res: LLMResponse = {
      content: "",
      provider: "anthropic",
      useCase: req.useCase,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      errorKind: classifyLLMError(err),
      error: message.slice(0, 200),
    }
    logCall(res)
    return res
  }
}

async function callOpenAIStub(req: LLMRequest): Promise<LLMResponse> {
  const res: LLMResponse = {
    content: "",
    provider: "openai",
    useCase: req.useCase,
    latencyMs: 0,
    fallbackUsed: true,
    errorKind: "UPSTREAM_ERROR",
    error: "provider_not_implemented",
  }
  logCall(res)
  return res
}

async function callMistralStub(req: LLMRequest): Promise<LLMResponse> {
  const res: LLMResponse = {
    content: "",
    provider: "mistral",
    useCase: req.useCase,
    latencyMs: 0,
    fallbackUsed: true,
    errorKind: "UPSTREAM_ERROR",
    error: "provider_not_implemented",
  }
  logCall(res)
  return res
}

export async function llmComplete(request: LLMRequest): Promise<LLMResponse> {
  const provider = request.provider ?? "anthropic"
  switch (provider) {
    case "anthropic":
      return callAnthropic(request)
    case "openai":
      return callOpenAIStub(request)
    case "mistral":
      return callMistralStub(request)
  }
}
