/**
 * LLM Service — INTERLIGENS single entry point for all LLM calls.
 *
 * Server-side only. 100% generic — no INTERLIGENS business logic lives here.
 * TigerScore scoring is deterministic and MUST NOT route through this service.
 *
 * Default provider: Anthropic (claude-sonnet-4-20250514).
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

export interface LLMResponse {
  content: string
  provider: LLMProvider
  useCase: LLMUseCase
  tokensUsed?: number
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  fallbackUsed: boolean
  error?: string
}

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
const DEFAULT_MAX_TOKENS = 1024
const TIMEOUT_MS = 15_000

function logCall(res: LLMResponse) {
  console.log(
    `[llm] useCase=${res.useCase} provider=${res.provider} latencyMs=${res.latencyMs} tokens=${res.tokensUsed ?? 0} fallback=${res.fallbackUsed}${res.error ? ` error=${res.error}` : ""}`,
  )
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
