// ─── INCIDENT 2026-08-27, moitié A — le service ne disait pas POURQUOI ─────
//
// `llm.service.ts` épinglait `claude-sonnet-4-20250514` (Claude Sonnet 4,
// retiré le 2026-06-15). Chaque appel revenait en `404 not_found_error`, et un
// unique `catch` aplatissait tout dans `fallbackUsed: true` + une chaîne
// tronquée à 200 caractères. Un identifiant mort et un timeout réseau
// produisaient exactement le même signal.
//
// C'est ce qui a rendu la panne muette : rien, dans la réponse du service, ne
// disait « change l'identifiant » plutôt que « réessaie plus tard ».
//
// Ce fichier fixe la distinction. Six causes, six noms.

import { describe, it, expect, vi, beforeEach } from "vitest";

const messagesCreate = vi.fn();

// On reproduit la FORME des classes d'erreur du SDK (name + status) plutôt que
// d'en dépendre : la classification doit tenir sur ce que le SDK expose
// publiquement, pas sur ses internes.
vi.mock("@anthropic-ai/sdk", () => {
  class ApiError extends Error {
    status: number;
    constructor(name: string, status: number, message: string) {
      super(message);
      this.name = name;
      this.status = status;
    }
  }
  // Doit être CONSTRUCTIBLE : le service fait `new Anthropic({ apiKey })`.
  class AnthropicMock {
    messages = { create: messagesCreate };
  }
  const Anthropic = AnthropicMock as unknown as Record<string, unknown>;
  Anthropic.NotFoundError = class extends ApiError {
    constructor(m = "model: claude-sonnet-4-20250514") { super("NotFoundError", 404, m); }
  };
  Anthropic.AuthenticationError = class extends ApiError {
    constructor(m = "invalid x-api-key") { super("AuthenticationError", 401, m); }
  };
  Anthropic.PermissionDeniedError = class extends ApiError {
    constructor(m = "forbidden") { super("PermissionDeniedError", 403, m); }
  };
  Anthropic.RateLimitError = class extends ApiError {
    constructor(m = "rate limited") { super("RateLimitError", 429, m); }
  };
  Anthropic.APITimeoutError = class extends ApiError {
    constructor(m = "timed out") { super("APITimeoutError", 0, m); }
  };
  Anthropic.APIConnectionError = class extends ApiError {
    constructor(m = "connection reset") { super("APIConnectionError", 0, m); }
  };
  Anthropic.BadRequestError = class extends ApiError {
    constructor(m = "temperature: unsupported value") { super("BadRequestError", 400, m); }
  };
  Anthropic.InternalServerError = class extends ApiError {
    constructor(m = "overloaded") { super("InternalServerError", 529, m); }
  };
  return { default: Anthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { llmComplete } from "@/lib/llm/llm.service";

const A = Anthropic as unknown as Record<string, new () => Error>;
const ask = () =>
  llmComplete({ useCase: "entity_enrichment", messages: [{ role: "user", content: "x" }] });

const CASES = [
  { label: "404 — modèle retiré", make: () => new A.NotFoundError(), kind: "MODEL_NOT_FOUND" },
  { label: "401 — clé invalide", make: () => new A.AuthenticationError(), kind: "AUTH" },
  { label: "403 — clé sans droit", make: () => new A.PermissionDeniedError(), kind: "AUTH" },
  { label: "429 — quota", make: () => new A.RateLimitError(), kind: "RATE_LIMIT" },
  { label: "timeout", make: () => new A.APITimeoutError(), kind: "TIMEOUT" },
  { label: "coupure réseau", make: () => new A.APIConnectionError(), kind: "TIMEOUT" },
  { label: "400 — paramètre refusé", make: () => new A.BadRequestError(), kind: "INVALID_REQUEST" },
  { label: "5xx — amont en panne", make: () => new A.InternalServerError(), kind: "UPSTREAM_ERROR" },
];

describe("service LLM — chaque échec porte sa cause", () => {
  beforeEach(() => {
    messagesCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key-not-a-real-secret";
  });

  it.each(CASES)("$label → errorKind = $kind", async ({ make, kind }) => {
    messagesCreate.mockRejectedValueOnce(make());
    const res = await ask();
    expect(res.fallbackUsed).toBe(true);
    expect(res.errorKind).toBe(kind);
  });

  it("un modèle retiré ne ressemble PAS à un timeout", async () => {
    // Le cœur de l'incident : sans cette distinction, la supervision ne peut
    // pas savoir qu'il faut changer un identifiant plutôt que réessayer.
    messagesCreate.mockRejectedValueOnce(new A.NotFoundError());
    const mort = await ask();
    messagesCreate.mockRejectedValueOnce(new A.APITimeoutError());
    const lent = await ask();
    expect(mort.errorKind).toBe("MODEL_NOT_FOUND");
    expect(lent.errorKind).toBe("TIMEOUT");
    expect(mort.errorKind).not.toBe(lent.errorKind);
  });

  it("une erreur inconnue reste nommée, jamais laissée vide", async () => {
    messagesCreate.mockRejectedValueOnce(new Error("quelque chose d'inattendu"));
    const res = await ask();
    expect(res.errorKind).toBe("UPSTREAM_ERROR");
  });

  it("clé absente → AUTH, pas un échec anonyme", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await ask();
    expect(res.errorKind).toBe("AUTH");
    process.env.ANTHROPIC_API_KEY = "test-key-not-a-real-secret";
  });

  it("un succès ne porte aucun errorKind", async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const res = await ask();
    expect(res.fallbackUsed).toBe(false);
    expect(res.errorKind).toBeUndefined();
  });

  it("le message d'origine est conservé à côté du nom", async () => {
    // Le nom sert à décider, le message sert à diagnostiquer. On garde les deux.
    messagesCreate.mockRejectedValueOnce(new A.NotFoundError());
    const res = await ask();
    expect(res.error).toContain("claude-sonnet-4-20250514");
  });

  it("l'identifiant épinglé n'est plus le modèle retiré", async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    await ask();
    const sent = messagesCreate.mock.calls[0][0];
    expect(sent.model).not.toBe("claude-sonnet-4-20250514");
  });
});
