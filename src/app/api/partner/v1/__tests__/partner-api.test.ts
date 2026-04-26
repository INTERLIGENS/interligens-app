import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScoreWithIntel: vi.fn().mockResolvedValue({
    finalScore: 85,
    finalTier: "RED",
    score: 85,
    tier: "RED",
    drivers: [
      { id: "sig1", label: "Signal 1", severity: "high", delta: 35, why: "test" },
      { id: "sig2", label: "Signal 2", severity: "critical", delta: 50, why: "test" },
    ],
    confidence: "Medium",
    intelligence: null,
  }),
}));

vi.mock("@/lib/entities/knownBad", () => ({
  isKnownBadEvm: vi.fn().mockReturnValue(null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_KEY = "test-partner-key-abc123";
const SOL_ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const EVM_ADDR = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function makeReq(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: opts.headers ?? {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// ── partnerAuth helper ────────────────────────────────────────────────────────

describe("validatePartnerKey", () => {
  beforeEach(() => {
    process.env.PARTNER_API_KEY = VALID_KEY;
  });
  afterEach(() => {
    delete process.env.PARTNER_API_KEY;
  });

  it("returns true for a valid key", async () => {
    const { validatePartnerKey } = await import("@/lib/security/partnerAuth");
    const req = makeReq("http://localhost/api/partner/v1/score-lite", {
      headers: { "x-partner-key": VALID_KEY },
    });
    expect(await validatePartnerKey(req)).toBe(true);
  });

  it("returns false for an invalid key", async () => {
    const { validatePartnerKey } = await import("@/lib/security/partnerAuth");
    const req = makeReq("http://localhost/api/partner/v1/score-lite", {
      headers: { "x-partner-key": "wrong-key" },
    });
    expect(await validatePartnerKey(req)).toBe(false);
  });

  it("returns false when header is absent", async () => {
    const { validatePartnerKey } = await import("@/lib/security/partnerAuth");
    const req = makeReq("http://localhost/api/partner/v1/score-lite");
    expect(await validatePartnerKey(req)).toBe(false);
  });

  it("returns false when PARTNER_API_KEY env var is not set", async () => {
    delete process.env.PARTNER_API_KEY;
    const { validatePartnerKey } = await import("@/lib/security/partnerAuth");
    const req = makeReq("http://localhost/api/partner/v1/score-lite", {
      headers: { "x-partner-key": VALID_KEY },
    });
    expect(await validatePartnerKey(req)).toBe(false);
  });
});

// ── score-lite ────────────────────────────────────────────────────────────────

describe("GET /api/partner/v1/score-lite", () => {
  beforeEach(() => {
    process.env.PARTNER_API_KEY = VALID_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.PARTNER_API_KEY;
  });

  it("returns 401 with invalid partner key", async () => {
    const { GET } = await import("../score-lite/route");
    const req = makeReq(
      `http://localhost/api/partner/v1/score-lite?address=${EVM_ADDR}`,
      { headers: { "x-partner-key": "bad-key" } }
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_PARTNER_KEY");
  });

  it("returns 400 when address param is missing", async () => {
    const { GET } = await import("../score-lite/route");
    const req = makeReq("http://localhost/api/partner/v1/score-lite", {
      headers: { "x-partner-key": VALID_KEY },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid address format", async () => {
    const { GET } = await import("../score-lite/route");
    const req = makeReq(
      "http://localhost/api/partner/v1/score-lite?address=not-an-address",
      { headers: { "x-partner-key": VALID_KEY } }
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with valid EVM address and key", async () => {
    const { GET } = await import("../score-lite/route");
    const req = makeReq(
      `http://localhost/api/partner/v1/score-lite?address=${EVM_ADDR}`,
      { headers: { "x-partner-key": VALID_KEY } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(85);
    expect(body.verdict).toBe("AVOID");
    expect(body.tier).toBe("RED");
    expect(body.version).toBe("v1");
    expect(body.powered_by).toBe("INTERLIGENS");
  });

  it("returns 200 with valid Solana address and key", async () => {
    const { GET } = await import("../score-lite/route");
    const req = makeReq(
      `http://localhost/api/partner/v1/score-lite?address=${SOL_ADDR}`,
      { headers: { "x-partner-key": VALID_KEY } }
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe(SOL_ADDR);
  });
});

// ── transaction-check ─────────────────────────────────────────────────────────

describe("POST /api/partner/v1/transaction-check", () => {
  beforeEach(() => {
    process.env.PARTNER_API_KEY = VALID_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.PARTNER_API_KEY;
  });

  it("returns 401 with invalid partner key", async () => {
    const { POST } = await import("../transaction-check/route");
    const req = makeReq("http://localhost/api/partner/v1/transaction-check", {
      method: "POST",
      headers: { "x-partner-key": "bad-key", "content-type": "application/json" },
      body: { to: EVM_ADDR },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when 'to' is missing", async () => {
    const { POST } = await import("../transaction-check/route");
    const req = makeReq("http://localhost/api/partner/v1/transaction-check", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { from: EVM_ADDR },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/to/i);
  });

  it("returns 400 for unsupported chain", async () => {
    const { POST } = await import("../transaction-check/route");
    const req = makeReq("http://localhost/api/partner/v1/transaction-check", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { to: EVM_ADDR, chain: "xrp" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with valid body (to only)", async () => {
    const { POST } = await import("../transaction-check/route");
    const req = makeReq("http://localhost/api/partner/v1/transaction-check", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { to: EVM_ADDR },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recommendation).toBe("BLOCK"); // score 85 >= 70
    expect(body.score_to).toBe(85);
    expect(body.score_from).toBeNull();
    expect(body.chain).toBe("eth");
  });

  it("returns 200 with both from and to", async () => {
    const { POST } = await import("../transaction-check/route");
    const req = makeReq("http://localhost/api/partner/v1/transaction-check", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { to: EVM_ADDR, from: EVM_ADDR, chain: "eth" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score_from).toBe(85);
  });
});

// ── batch-score ───────────────────────────────────────────────────────────────

describe("POST /api/partner/v1/batch-score", () => {
  beforeEach(() => {
    process.env.PARTNER_API_KEY = VALID_KEY;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.PARTNER_API_KEY;
  });

  it("returns 401 with invalid partner key", async () => {
    const { POST } = await import("../batch-score/route");
    const req = makeReq("http://localhost/api/partner/v1/batch-score", {
      method: "POST",
      headers: { "x-partner-key": "bad-key", "content-type": "application/json" },
      body: { addresses: [EVM_ADDR] },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when 11 addresses are submitted", async () => {
    const { POST } = await import("../batch-score/route");
    const addresses = Array.from({ length: 11 }, (_, i) =>
      `0x${"a".repeat(39)}${i.toString(16)}`
    );
    const req = makeReq("http://localhost/api/partner/v1/batch-score", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { addresses },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/10/);
  });

  it("returns 200 with up to 10 valid addresses", async () => {
    const { POST } = await import("../batch-score/route");
    const addresses = [EVM_ADDR, SOL_ADDR];
    const req = makeReq("http://localhost/api/partner/v1/batch-score", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { addresses },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(2);
    expect(body.results).toHaveLength(2);
    expect(body.version).toBe("v1");
  });

  it("returns 400 for empty addresses array", async () => {
    const { POST } = await import("../batch-score/route");
    const req = makeReq("http://localhost/api/partner/v1/batch-score", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { addresses: [] },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("marks invalid addresses as errors without failing the batch", async () => {
    const { POST } = await import("../batch-score/route");
    const req = makeReq("http://localhost/api/partner/v1/batch-score", {
      method: "POST",
      headers: { "x-partner-key": VALID_KEY, "content-type": "application/json" },
      body: { addresses: [EVM_ADDR, "not-valid"] },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toBe(1);
    const errResult = body.results.find((r: { error?: string }) => r.error);
    expect(errResult?.error).toBe("invalid_address");
  });
});
