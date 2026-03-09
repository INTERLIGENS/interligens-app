import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkAuth, extractBearerToken, unauthorizedResponse } from "./auth";

const VALID_TOKEN = "test-secret-token-abc123";

// Helper : construit une Request avec les headers voulus
function makeReq(opts: {
  authHeader?: string;
  queryToken?: string;
  acceptLanguage?: string;
} = {}): Request {
  const url = new URL("https://api.interligens.io/api/report/pdf");
  if (opts.queryToken) url.searchParams.set("token", opts.queryToken);

  const headers: Record<string, string> = {};
  if (opts.authHeader)      headers["authorization"]    = opts.authHeader;
  if (opts.acceptLanguage)  headers["accept-language"]  = opts.acceptLanguage;

  return new Request(url.toString(), { headers });
}

// ── Setup env mock ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", VALID_TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── extractBearerToken ────────────────────────────────────────────────────────

describe("extractBearerToken", () => {
  it("extrait depuis Authorization: Bearer <token>", () => {
    const req = makeReq({ authHeader: `Bearer ${VALID_TOKEN}` });
    expect(extractBearerToken(req)).toBe(VALID_TOKEN);
  });

  it("insensible à la casse du préfixe bearer", () => {
    const req = makeReq({ authHeader: `BEARER ${VALID_TOKEN}` });
    expect(extractBearerToken(req)).toBe(VALID_TOKEN);
  });

  it("extrait depuis query ?token=", () => {
    const req = makeReq({ queryToken: VALID_TOKEN });
    expect(extractBearerToken(req)).toBe(VALID_TOKEN);
  });

  it("préfère Authorization header sur query param", () => {
    const req = makeReq({ authHeader: `Bearer header-token`, queryToken: "query-token" });
    expect(extractBearerToken(req)).toBe("header-token");
  });

  it("retourne null si aucun token", () => {
    const req = makeReq();
    expect(extractBearerToken(req)).toBeNull();
  });

  it("retourne null si Bearer vide", () => {
    const req = makeReq({ authHeader: "Bearer " });
    expect(extractBearerToken(req)).toBeNull();
  });
});

// ── checkAuth — sans token ────────────────────────────────────────────────────

describe("checkAuth — sans token", () => {
  it("retourne authorized: false", async () => {
    const result = await checkAuth(makeReq());
    expect(result.authorized).toBe(false);
  });

  it("fournit une Response 401", async () => {
    const result = await checkAuth(makeReq());
    expect(result.response?.status).toBe(401);
  });

  it("response contient WWW-Authenticate", async () => {
    const result = await checkAuth(makeReq());
    expect(result.response?.headers.get("WWW-Authenticate")).toMatch(/Bearer/);
  });
});

// ── checkAuth — mauvais token ─────────────────────────────────────────────────

describe("checkAuth — mauvais token", () => {
  it("retourne 401 avec un token invalide (header)", async () => {
    const result = await checkAuth(makeReq({ authHeader: "Bearer wrong-token" }));
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("retourne 401 avec un token invalide (query)", async () => {
    const result = await checkAuth(makeReq({ queryToken: "bad-token" }));
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("retourne 401 avec token quasi-identique (1 char différent)", async () => {
    const almostRight = VALID_TOKEN.slice(0, -1) + "X";
    const result = await checkAuth(makeReq({ authHeader: `Bearer ${almostRight}` }));
    expect(result.authorized).toBe(false);
  });

  it("retourne 401 avec token vide string", async () => {
    vi.stubEnv("ADMIN_TOKEN", VALID_TOKEN);
    const result = await checkAuth(makeReq({ authHeader: "Bearer " }));
    expect(result.authorized).toBe(false);
  });
});

// ── checkAuth — bon token ─────────────────────────────────────────────────────

describe("checkAuth — bon token", () => {
  it("autorise avec le bon token en header", async () => {
    const result = await checkAuth(makeReq({ authHeader: `Bearer ${VALID_TOKEN}` }));
    expect(result.authorized).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("autorise avec le bon token en query", async () => {
    const result = await checkAuth(makeReq({ queryToken: VALID_TOKEN }));
    expect(result.authorized).toBe(true);
  });
});

// ── checkAuth — env var absente ───────────────────────────────────────────────

// // @pr4:env-updated
describe("checkAuth — ADMIN_TOKEN absent", () => {
  it("bloque tout si la var d'env n'est pas configurée (fail-closed)", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    // Même avec le bon token — si l'env est vide, on refuse
    const result = await checkAuth(makeReq({ authHeader: `Bearer ${VALID_TOKEN}` }));
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });
});

// ── unauthorizedResponse — i18n ───────────────────────────────────────────────

describe("unauthorizedResponse — i18n", () => {
  it("message EN par défaut", async () => {
    const res  = unauthorizedResponse(makeReq({ acceptLanguage: "en-US" }));
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Unauthorized/i);
  });

  it("message FR si Accept-Language fr", async () => {
    const res  = unauthorizedResponse(makeReq({ acceptLanguage: "fr-FR,fr;q=0.9" }));
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Non autorisé/i);
  });

  it("status 401", () => {
    expect(unauthorizedResponse(makeReq()).status).toBe(401);
  });
});
