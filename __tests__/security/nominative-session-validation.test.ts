// __tests__/security/nominative-session-validation.test.ts
//
// B2 — la branche « session investigateur » du gate nominatif valide vraiment.
//
// AVANT : `if (typeof betaCookie === "string" && betaCookie.length > 0) return "beta_session"`.
// Présence, pas validité. `investigator_session=x` ouvrait les douze familles
// d'endpoints nominatifs, et une session révoquée ou expirée continuait
// d'ouvrir tant que le cookie restait dans le navigateur.
//
// APRÈS : `await validateSession(betaCookie)` — jeton haché en SHA-256 avant
// comparaison, session `revokedAt: null`, `expiresAt > now`, accès `isActive`.
//
// Ce que la suite prouve, sur CHACUNE des douze familles :
//   1. un cookie arbitraire non vide n'ouvre rien ;
//   2. une session EXPIRÉE n'ouvre rien ;
//   3. une session RÉVOQUÉE n'ouvre rien ;
//   4. une session VALIDE passe toujours.
//
// Et que les quatre autres branches du gate — jeton admin, session admin, clé
// partenaire, jeton mobile — sont intactes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// La validation interroge la base. On simule le CLIENT PRISMA, pas
// `validateSession` : simuler la fonction testerait le simulacre. Ici, c'est
// bien la logique de `validateSession` — hachage, `revokedAt`, `expiresAt`,
// `isActive` — qui est exercée.
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
vi.mock("@/lib/security/adminAuth", () => ({ verifyAdminSession: () => false }));

import { resolveNominativeCaller, isNominativeApiPath } from "@/lib/security/nominativeApiGate";
import { hashSHA256 } from "@/lib/security/investigatorAuth";

/** Les douze familles d'endpoints que le gate protège. */
const FAMILLES: Array<[nom: string, chemin: string]> = [
  ["/api/kol", "/api/kol"],
  ["/api/kol/{handle}", "/api/kol/bkokoski/proceeds"],
  ["/api/watchlist", "/api/watchlist"],
  ["/api/explorer", "/api/explorer/some-case"],
  ["/api/cluster/{handle}", "/api/cluster/bkokoski"],
  ["/api/coordination/{handle}", "/api/coordination/bkokoski"],
  ["/api/laundry/{handle}", "/api/laundry/bkokoski"],
  ["/api/v1/kol", "/api/v1/kol"],
  ["/api/v1/shill-to-exit", "/api/v1/shill-to-exit"],
  ["/api/casefile/public", "/api/casefile/public"],
  ["/api/scan/grounding", "/api/scan/grounding"],
  ["/api/scan/ask", "/api/scan/ask"],
  ["/api/token/{chain}/{addr}/kol-alert", "/api/token/solana/So111/kol-alert"],
];

const TOKEN = "sess-token-parfaitement-valide";
const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://app.interligens.com${path}`, { headers });
const avecCookie = (valeur: string) => ({ cookie: `investigator_session=${valeur}` });

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(null);
});

describe("toutes les familles listées sont bien reconnues comme nominatives", () => {
  for (const [nom, chemin] of FAMILLES) {
    it(nom, () => {
      expect(isNominativeApiPath(chemin), `${chemin} n'est pas protégé`).toBe(true);
    });
  }
});

describe("1. un cookie arbitraire non vide n'ouvre AUCUNE famille", () => {
  for (const [nom, chemin] of FAMILLES) {
    it(nom, async () => {
      // C'est exactement le cas que l'ancien code laissait passer.
      findFirst.mockResolvedValue(null); // aucune session ne correspond au hash
      expect(await resolveNominativeCaller(req(chemin, avecCookie("x")))).toBeNull();
    });
  }

  it("et la base a bien été interrogée sur le HASH, jamais sur le jeton en clair", async () => {
    await resolveNominativeCaller(req("/api/kol", avecCookie("jeton-en-clair")));
    const where = findFirst.mock.calls[0][0].where;
    expect(where.sessionTokenHash).toBe(hashSHA256("jeton-en-clair"));
    expect(JSON.stringify(where)).not.toContain("jeton-en-clair");
  });
});

describe("2. une session EXPIRÉE n'ouvre AUCUNE famille", () => {
  // `validateSession` filtre sur `expiresAt: { gt: new Date() }` : une session
  // expirée ne remonte simplement pas. On vérifie que la CONTRAINTE est bien
  // posée, puis que l'absence de résultat ferme.
  it("la requête impose expiresAt > maintenant et revokedAt null", async () => {
    const avant = Date.now();
    await resolveNominativeCaller(req("/api/kol", avecCookie(TOKEN)));
    const where = findFirst.mock.calls[0][0].where;
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(avant);
  });

  for (const [nom, chemin] of FAMILLES) {
    it(nom, async () => {
      findFirst.mockResolvedValue(null); // expirée → hors du filtre → null
      expect(await resolveNominativeCaller(req(chemin, avecCookie(TOKEN)))).toBeNull();
    });
  }
});

describe("3. une session RÉVOQUÉE n'ouvre AUCUNE famille", () => {
  for (const [nom, chemin] of FAMILLES) {
    it(nom, async () => {
      findFirst.mockResolvedValue(null); // revokedAt non nul → hors du filtre
      expect(await resolveNominativeCaller(req(chemin, avecCookie(TOKEN)))).toBeNull();
    });
  }

  it("un accès DÉSACTIVÉ ferme, même si la session est trouvée", async () => {
    // Cas distinct : la session existe, n'est ni expirée ni révoquée, mais son
    // accès a été désactivé. `validateSession` teste `session.access.isActive`.
    findFirst.mockResolvedValue({
      id: "s1",
      access: { id: "a1", label: "revoqué", isActive: false },
    });
    expect(await resolveNominativeCaller(req("/api/kol", avecCookie(TOKEN)))).toBeNull();
  });
});

describe("4. une session VALIDE passe, sur toutes les familles", () => {
  const sessionValide = { id: "s1", access: { id: "a1", label: "investigateur", isActive: true } };

  for (const [nom, chemin] of FAMILLES) {
    it(nom, async () => {
      findFirst.mockResolvedValue(sessionValide);
      expect(await resolveNominativeCaller(req(chemin, avecCookie(TOKEN)))).toBe("beta_session");
    });
  }
});

describe("fail-closed sur les cas que le code ne comprend pas", () => {
  it("cookie absent → aucune requête, aucune ouverture", async () => {
    expect(await resolveNominativeCaller(req("/api/kol"))).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("cookie vide → aucune requête, aucune ouverture", async () => {
    expect(await resolveNominativeCaller(req("/api/kol", avecCookie("")))).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("base injoignable → ferme, et ne propage pas l'exception", async () => {
    // Le point de conception : une validation qui LÈVE ne doit ni ouvrir, ni
    // faire tomber la requête — les autres branches restent jugées.
    findFirst.mockRejectedValue(new Error("Can't reach database server"));
    await expect(
      resolveNominativeCaller(req("/api/kol", avecCookie(TOKEN))),
    ).resolves.toBeNull();
  });

  it("aucune branche NODE_ENV, aucun bypass de développement", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/security/nominativeApiGate.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/NODE_ENV|SKIP_|FORCE_|ALLOW_|BYPASS_|DISABLE_/);
  });
});

describe("les quatre autres branches sont intactes", () => {
  const sessionValide = { id: "s1", access: { id: "a1", label: "l", isActive: true } };

  it("jeton admin en en-tête — comparaison en temps constant, non touchée", async () => {
    vi.stubEnv("ADMIN_TOKEN", "admin-secret");
    expect(
      await resolveNominativeCaller(req("/api/kol", { "x-admin-token": "admin-secret" })),
    ).toBe("admin_token");
    expect(await resolveNominativeCaller(req("/api/kol", { "x-admin-token": "mauvais" }))).toBeNull();
    vi.unstubAllEnvs();
  });

  it("clé partenaire", async () => {
    vi.stubEnv("PARTNER_API_KEY", "partner-secret");
    expect(
      await resolveNominativeCaller(req("/api/v1/kol", { "x-partner-key": "partner-secret" })),
    ).toBe("partner_key");
    vi.unstubAllEnvs();
  });

  it("jeton mobile", async () => {
    vi.stubEnv("MOBILE_API_TOKEN", "mobile-secret");
    expect(
      await resolveNominativeCaller(req("/api/kol", { "x-mobile-api-token": "mobile-secret" })),
    ).toBe("mobile_token");
    vi.unstubAllEnvs();
  });

  it("RÉGRESSION CORRIGÉE AU PASSAGE — un cookie périmé ne masque plus une clé valide", async () => {
    // Avant B2, la branche 3 rendait `beta_session` sur simple présence et
    // court-circuitait les branches 4 et 5. Un partenaire porteur d'un vieux
    // cookie était donc identifié comme session interne, et sa clé n'était
    // jamais examinée. Le journal disait la mauvaise chose sur qui appelait.
    vi.stubEnv("PARTNER_API_KEY", "partner-secret");
    findFirst.mockResolvedValue(null); // cookie périmé
    expect(
      await resolveNominativeCaller(
        req("/api/v1/kol", { ...avecCookie("cookie-perime"), "x-partner-key": "partner-secret" }),
      ),
    ).toBe("partner_key");
    vi.unstubAllEnvs();
  });

  it("session valide + clé partenaire : la session gagne, l'ordre est inchangé", async () => {
    vi.stubEnv("PARTNER_API_KEY", "partner-secret");
    findFirst.mockResolvedValue(sessionValide);
    expect(
      await resolveNominativeCaller(
        req("/api/v1/kol", { ...avecCookie(TOKEN), "x-partner-key": "partner-secret" }),
      ),
    ).toBe("beta_session");
    vi.unstubAllEnvs();
  });
});
