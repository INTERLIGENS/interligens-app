import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.MOBILE_API_TOKEN = "test-mobile-token";
process.env.ANTHROPIC_API_KEY = "test-key";

const mockCreate = vi.fn(async () => ({
  content: [{ type: "text", text: "This token has medium risk." }],
  stop_reason: "end_turn",
  usage: { input_tokens: 100, output_tokens: 20 },
}));

vi.mock("@anthropic-ai/sdk", () => {
  function AnthropicMock() {
    return { messages: { create: mockCreate } };
  }
  return { default: AnthropicMock };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    askLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/ask/groundingContext", () => ({
  buildGroundingContext: vi.fn(async () => ({ context: "mock grounding" })),
}));
vi.mock("@/lib/ask/whyBullets", () => ({
  generateWhyBullets: vi.fn(() => ["Bullet 1", "Bullet 2"]),
}));
vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  detectLocale: vi.fn(() => "en"),
  RATE_LIMIT_PRESETS: { osint: { maxRequests: 30, windowMs: 60000 } },
}));

const VALID_BODY = {
  question: "Is this token safe?",
  address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  scanContext: { score: 45, tier: "ORANGE", riskLevel: "medium" },
};

function makeRequest(body: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) headers["X-Mobile-Api-Token"] = token;
  return new NextRequest("http://localhost/api/mobile/v1/ask", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function callAsk(body: object, token?: string) {
  const { POST } = await import("./route");
  return POST(makeRequest(body, token));
}

describe("POST /api/mobile/v1/ask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth token", async () => {
    const res = await callAsk(VALID_BODY);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 with wrong auth token", async () => {
    const res = await callAsk(VALID_BODY, "bad-token");
    expect(res.status).toBe(401);
  });

  it("returns 400 when question is missing", async () => {
    const res = await callAsk({ ...VALID_BODY, question: "" }, "test-mobile-token");
    expect(res.status).toBe(400);
  });

  it("returns 400 when address is missing", async () => {
    const res = await callAsk({ ...VALID_BODY, address: undefined }, "test-mobile-token");
    expect(res.status).toBe(400);
  });

  it("returns 400 when scanContext is incomplete", async () => {
    const res = await callAsk({ ...VALID_BODY, scanContext: { score: 45 } }, "test-mobile-token");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/mobile/v1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Mobile-Api-Token": "test-mobile-token" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
