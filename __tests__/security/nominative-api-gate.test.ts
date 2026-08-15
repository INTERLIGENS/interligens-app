// P0-1 — Gate des lectures NOMINATIVES de l'API.
//
// Le chantier ferme une asymétrie constatée EN PRODUCTION le 2026-08-15 :
// /api/watchlist, /api/cluster/[handle], /api/kol*, /api/explorer, /api/v1/kol*
// répondaient 200 en anonyme avec handle / displayName / tier / rôle, alors que
// les pages qui les consomment sont derrière le cookie beta.
//
// Ces tests verrouillent les DEUX moitiés du gate :
//   1. le refus anonyme sur chaque famille de chemin nominatif ;
//   2. le passage de CHAQUE appelant légitime inventorié ;
// et l'alignement entre la liste des chemins et le `config.matcher` du proxy —
// un chemin gaté que le matcher n'atteint pas est un gate qui ne s'exécute pas.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createRequire } from "node:module";
import { isNominativeApiPath } from "@/lib/security/nominativeApiGate";

const ADMIN_TOKEN = "admin-token-for-tests-not-a-real-secret";
const PARTNER_KEY = "partner-key-for-tests-not-a-real-secret";
const MOBILE_TOKEN = "mobile-token-for-tests-not-a-real-secret";

async function loadProxy() {
  vi.resetModules();
  const mod = await import("@/proxy");
  return mod;
}

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

/** Toutes les familles de chemins nominatifs, une par surface réelle. */
const NOMINATIVE_PATHS = [
  "/api/kol",
  "/api/kol/leaderboard",
  "/api/kol/bkokoski",
  "/api/kol/bkokoski/proceeds",
  "/api/kol/bkokoski/class-action",
  "/api/kol/bkokoski/wallet-history",
  "/api/cluster/bkokoski",
  "/api/coordination/bkokoski",
  "/api/laundry/bkokoski",
  "/api/watchlist",
  "/api/watchlist/signals",
  "/api/watchlist/signals/abc123",
  "/api/explorer",
  "/api/casefile/public",
  "/api/v1/kol",
  "/api/v1/kol/bkokoski",
  "/api/v1/shill-to-exit",
  "/api/token/solana/BYZ9CcZ/kol-alert",
  "/api/scan/grounding",
];

/** Surfaces publiques NON nominatives : elles doivent rester intactes. */
const NON_NOMINATIVE_PATHS = [
  "/api/health",
  "/api/market",
  "/api/market/tickers",
  "/api/scan/resolve",     // ne renvoie qu'un agrégat kolCount, aucun nom
  "/api/scan/solana",
  "/api/scan/eth",
  "/api/scan/timeline/abc",
  "/api/scan/grounding/extra",  // seul le chemin EXACT est gaté
  "/api/v1/score",
  "/api/beta/auth/login",
  "/api/labels",
];

beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", ADMIN_TOKEN);
  vi.stubEnv("PARTNER_API_KEY_V2", PARTNER_KEY);
  vi.stubEnv("MOBILE_API_TOKEN", MOBILE_TOKEN);
});
afterEach(() => vi.unstubAllEnvs());

describe("isNominativeApiPath — classification", () => {
  it.each(NOMINATIVE_PATHS)("classe %s comme nominatif", (path) => {
    expect(isNominativeApiPath(path)).toBe(true);
  });

  it.each(NON_NOMINATIVE_PATHS)("laisse %s hors du périmètre", (path) => {
    expect(isNominativeApiPath(path)).toBe(false);
  });
});

describe("proxy — refus anonyme sur les chemins nominatifs", () => {
  it.each(NOMINATIVE_PATHS)("401 sans credential sur %s", async (path) => {
    const { proxy } = await loadProxy();
    const res = proxy(req(path));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("NOMINATIVE_ACCESS_REQUIRED");
  });

  it("le 401 n'est pas cachable par un cache partagé", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/watchlist"));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Vary")).toContain("Cookie");
  });

  it("laisse passer les surfaces non nominatives sans y toucher", async () => {
    const { proxy } = await loadProxy();
    for (const path of NON_NOMINATIVE_PATHS) {
      const res = proxy(req(path));
      expect(res.status, path).not.toBe(401);
    }
  });
});

describe("proxy — chaque appelant légitime passe", () => {
  it("front interne : cookie beta investigator_session", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/watchlist", { cookie: "investigator_session=sess-abc" }));
    expect(res.status).not.toBe(401);
  });

  it("admin : en-tête x-admin-token", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/kol", { "x-admin-token": ADMIN_TOKEN }));
    expect(res.status).not.toBe(401);
  });

  it("admin : cookie admin_token", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/kol", { cookie: `admin_token=${ADMIN_TOKEN}` }));
    expect(res.status).not.toBe(401);
  });

  it("admin : cookie admin_session HMAC", async () => {
    vi.stubEnv("ADMIN_BASIC_PASS", "basic-pass-for-tests");
    const { proxy } = await loadProxy();
    const { computeAdminSessionToken } = await import("@/lib/security/adminAuth");
    const token = computeAdminSessionToken();
    expect(token).not.toBeNull();
    const res = proxy(req("/api/kol", { cookie: `admin_session=${token}` }));
    expect(res.status).not.toBe(401);
  });

  it("intégration partenaire : en-tête x-partner-key", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/v1/kol", { "x-partner-key": PARTNER_KEY }));
    expect(res.status).not.toBe(401);
  });

  it("app iOS : en-tête x-mobile-api-token", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/v1/kol", { "x-mobile-api-token": MOBILE_TOKEN }));
    expect(res.status).not.toBe(401);
  });

  it("une réponse autorisée n'est jamais mise en cache partagé", async () => {
    const { proxy } = await loadProxy();
    const res = proxy(req("/api/watchlist", { cookie: "investigator_session=sess-abc" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Vary")).toContain("Cookie");
  });
});

describe("proxy — credentials invalides", () => {
  it("refuse un mauvais token admin", async () => {
    const { proxy } = await loadProxy();
    expect(proxy(req("/api/kol", { "x-admin-token": "wrong" })).status).toBe(401);
  });

  it("refuse une mauvaise clé partenaire", async () => {
    const { proxy } = await loadProxy();
    expect(proxy(req("/api/v1/kol", { "x-partner-key": "wrong" })).status).toBe(401);
  });

  it("refuse un cookie beta VIDE (présence ≠ chaîne vide)", async () => {
    const { proxy } = await loadProxy();
    expect(proxy(req("/api/watchlist", { cookie: "investigator_session=" })).status).toBe(401);
  });

  // ?? vs || — cinquième famille de ce bug dans ce repo. Une variable
  // d'environnement définie mais VIDE ne doit pas devenir un sésame : "" ===
  // "" en temps constant vaut true, donc un en-tête vide passerait.
  it("un secret d'env VIDE n'autorise pas un en-tête vide", async () => {
    vi.stubEnv("PARTNER_API_KEY_V2", "");
    vi.stubEnv("PARTNER_API_KEY", "");
    vi.stubEnv("MOBILE_API_TOKEN", "");
    vi.stubEnv("ADMIN_TOKEN", "");
    const { proxy } = await loadProxy();
    expect(proxy(req("/api/v1/kol", { "x-partner-key": "" })).status).toBe(401);
    expect(proxy(req("/api/v1/kol", { "x-mobile-api-token": "" })).status).toBe(401);
    expect(proxy(req("/api/kol", { "x-admin-token": "" })).status).toBe(401);
  });

  it("un secret d'env ABSENT n'autorise rien", async () => {
    vi.stubEnv("PARTNER_API_KEY_V2", undefined as unknown as string);
    vi.stubEnv("PARTNER_API_KEY", undefined as unknown as string);
    const { proxy } = await loadProxy();
    expect(proxy(req("/api/v1/kol", { "x-partner-key": PARTNER_KEY })).status).toBe(401);
  });
});

// ── Alignement gate ↔ matcher ───────────────────────────────────────────────
// Un chemin déclaré nominatif que `config.matcher` n'atteint pas produit un
// gate silencieusement inerte : la fonction dit « refuse » mais Next ne
// l'exécute jamais. On recompile donc les motifs avec le path-to-regexp
// EMBARQUÉ DANS NEXT — pas une traduction maison, qui aurait ses propres
// divergences et rendrait le test vert pour la mauvaise raison.
type PathToRegexp = (pattern: string) => RegExp;

// `next/dist/compiled/path-to-regexp` est un bundle CommonJS SANS déclaration
// de types : un `import()` statique déclenche TS7016, et un `require()` nu est
// interdit par @typescript-eslint/no-require-imports. `createRequire` est la
// voie standard et typée pour charger un module CJS non typé depuis un module
// ESM — pas de .d.ts fantôme à maintenir pour un chemin interne de Next.
const requireCjs = createRequire(import.meta.url);

function loadPathToRegexp(): PathToRegexp {
  const mod = requireCjs("next/dist/compiled/path-to-regexp") as {
    pathToRegexp?: PathToRegexp;
    default?: { pathToRegexp?: PathToRegexp };
  };
  const fn = mod.pathToRegexp ?? mod.default?.pathToRegexp;
  if (!fn) throw new Error("path-to-regexp introuvable dans le bundle Next");
  return fn;
}

describe("alignement gate ↔ config.matcher du proxy", () => {
  it.each(NOMINATIVE_PATHS)("le matcher route bien %s vers le proxy", async (path) => {
    const pathToRegexp = loadPathToRegexp();
    const { config } = await loadProxy();
    const matchers = (config.matcher as string[]).filter((m) => m.startsWith("/api/"));
    const hit = matchers.some((m) => pathToRegexp(m).test(path));
    expect(hit, `aucun matcher ne couvre ${path}`).toBe(true);
  });

  it("le matcher ne recouvre PAS les surfaces non nominatives", async () => {
    const pathToRegexp = loadPathToRegexp();
    const { config } = await loadProxy();
    const nominative = (config.matcher as string[]).filter(
      (m) => m.startsWith("/api/") && !m.startsWith("/api/admin") && !m.startsWith("/api/investigator"),
    );
    for (const path of NON_NOMINATIVE_PATHS) {
      const hit = nominative.some((m) => pathToRegexp(m).test(path));
      expect(hit, `${path} ne devrait pas être routé vers le gate nominatif`).toBe(false);
    }
  });
});
