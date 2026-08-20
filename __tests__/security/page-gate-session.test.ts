// __tests__/security/page-gate-session.test.ts
//
// P0-GUARD — les gates de PAGE valident la session, ils ne constatent plus le
// cookie. Registre : P0-GUARD / DEFENSE-IN-DEPTH — no active disclosure measured.
//
// Mesuré le 2026-08-20 (MESURE_PAGE_2026-08-20.md) : sur l'origine *.vercel.app
// qui contourne Cloudflare, un cookie forgé rendait 200 sur les pages —
// `proxy.ts:156` et `:196` testaient `!!req.cookies.get(BETA_COOKIE)?.value`,
// la PRÉSENCE, pas la validité. Aucune fuite de nominatif protégé (coquilles
// seules, les APIs sont fermées par B2), mais la faiblesse d'architecture est
// réelle. Ce correctif réutilise `validateSession` — la fonction câblée par B2.
//
// ── CE QUI EST SIMULÉ, ET POURQUOI ────────────────────────────────────────
// On simule le CLIENT PRISMA, pas `validateSession` : simuler la fonction
// testerait le simulacre. Ici c'est bien sa logique — hash SHA-256, `revokedAt`,
// `expiresAt`, `isActive` — qui décide. Aucune base, aucun réseau.
//
// C2 (le cœur) : un cookie arbitraire non vide n'ouvre AUCUNE page.
// C3           : une session valide passe.
// Et on assert le COMPORTEMENT (307 vers /access, 401 pour l'API investigateur,
// pass-through), pas seulement « pas 200 » — pour qu'une mutation du garde
// rougisse.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// validateSession interroge prisma.investigatorSession. On le simule.
const findFirst = vi.fn();
const update = vi.fn().mockReturnValue({ catch: () => {} });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    investigatorSession: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
    },
    investigatorAuditLog: { create: vi.fn() },
  },
}));
// Pas d'admin dans ces cas : on isole le gate de session de page.
vi.mock("@/lib/security/adminAuth", () => ({
  verifyAdminSession: () => false,
  isAdminApi: () => false,
  checkBasicAuth: () => false,
  basicAuthFail: () =>
    new (require("next/server").NextResponse)(null, { status: 401 }),
}));

import { proxy } from "@/proxy";
import { hashSHA256 } from "@/lib/security/investigatorAuth";

const TOKEN = "session-token-parfaitement-valide";
const FORGE = "investigator_session=ceci-nest-pas-une-session";

function req(path: string, cookie?: string): NextRequest {
  return new NextRequest(`https://app.interligens.com${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

// Une session valide, telle que validateSession l'accepte.
function sessionValide() {
  return {
    id: "sess_1",
    sessionTokenHash: hashSHA256(TOKEN),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    access: { id: "acc_1", label: "x", isActive: true },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(null); // par défaut : aucune session ne matche
});

// Les pages gardées par les deux gates.
const PAGE_INVESTIGATEUR = "/en/investigator"; // gate 156
const PAGES_BETA = ["/fr/kol/ravedao", "/en/kol/bkokoski", "/en/explorer", "/investigators/box/network"]; // gate 196
const API_INVESTIGATEUR = "/api/investigator/metrics"; // gate 156, branche API

// ── C2 — LE COOKIE FORGÉ NE PASSE PLUS ────────────────────────────────────

describe("C2 — un cookie forgé est refusé sur les pages", () => {
  it("gate 156 (page investigateur) : cookie forgé → 307 vers /access", async () => {
    const res = await proxy(req(PAGE_INVESTIGATEUR, FORGE));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/access");
  });

  it("gate 156 (API investigateur) : cookie forgé → 401", async () => {
    const res = await proxy(req(API_INVESTIGATEUR, FORGE));
    expect(res.status).toBe(401);
  });

  it.each(PAGES_BETA)("gate 196 (%s) : cookie forgé → 307 vers /access", async (path) => {
    const res = await proxy(req(path, FORGE));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/access");
  });

  it("la base a été interrogée sur le HASH du cookie, jamais sur le jeton en clair", async () => {
    await proxy(req(PAGE_INVESTIGATEUR, FORGE));
    expect(findFirst).toHaveBeenCalled();
    const where = findFirst.mock.calls[0][0].where;
    expect(where.sessionTokenHash).toBe(hashSHA256("ceci-nest-pas-une-session"));
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

// ── C2 bis — l'ANONYME reste fermé (non-régression du comportement voulu) ──

describe("C2 bis — l'anonyme reste fermé", () => {
  it("page investigateur sans cookie → 307 vers /access", async () => {
    const res = await proxy(req(PAGE_INVESTIGATEUR));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/access");
  });

  it("cookie VIDE (présent mais longueur 0) → fermé, et la base n'est PAS interrogée", async () => {
    const res = await proxy(req(PAGE_INVESTIGATEUR, "investigator_session="));
    expect(res.status).toBe(307);
    expect(findFirst).not.toHaveBeenCalled(); // court-circuit avant validateSession
  });
});

// ── C3 — LA SESSION VALIDE PASSE ──────────────────────────────────────────

describe("C3 — une session valide passe (unitaire ; vérif vive hors CC)", () => {
  it("gate 156 : session valide → PAS de redirection (pass-through)", async () => {
    findFirst.mockResolvedValue(sessionValide());
    const res = await proxy(req(PAGE_INVESTIGATEUR, `investigator_session=${TOKEN}`));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });

  it.each(PAGES_BETA)("gate 196 (%s) : session valide → pass-through", async (path) => {
    findFirst.mockResolvedValue(sessionValide());
    const res = await proxy(req(path, `investigator_session=${TOKEN}`));
    expect(res.status).not.toBe(307);
  });

  it("session EXPIRÉE (hors du filtre) → refusée comme un cookie forgé", async () => {
    // findFirst rend null parce que expiresAt <= now sort du WHERE.
    findFirst.mockResolvedValue(null);
    const res = await proxy(req(PAGE_INVESTIGATEUR, `investigator_session=${TOKEN}`));
    expect(res.status).toBe(307);
  });

  it("accès DÉSACTIVÉ (isActive false) → refusé même si la session est trouvée", async () => {
    findFirst.mockResolvedValue({ ...sessionValide(), access: { id: "a", label: "x", isActive: false } });
    const res = await proxy(req(PAGE_INVESTIGATEUR, `investigator_session=${TOKEN}`));
    expect(res.status).toBe(307);
  });
});

// ── C4 — FAIL-CLOSED : la base injoignable ne doit PAS ouvrir ──────────────

describe("C4 — fail-closed quand la validation lève", () => {
  it("si validateSession lève (base injoignable), la page reste fermée", async () => {
    findFirst.mockRejectedValue(new Error("base injoignable (double de test)"));
    const res = await proxy(req(PAGE_INVESTIGATEUR, `investigator_session=${TOKEN}`));
    expect(res.status).toBe(307);
  });
});

// ── STRUCTUREL — plus aucune constatation de présence ─────────────────────

describe("le proxy ne teste plus la présence du cookie sur les pages", () => {
  it("`!!req.cookies.get(BETA_COOKIE)` a disparu du fichier", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(process.cwd() + "/src/proxy.ts", "utf8");
    expect(src).not.toContain("!!req.cookies.get(BETA_COOKIE)");
    // La validation réutilise bien la fonction B2, sans la réécrire.
    expect(src).toContain("await hasValidBetaSession(req)");
    expect(src).toContain("validateSession(cookie)");
  });
});
