import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import fs from "fs";

// Deux crons comparaient l'en-tête à `Bearer ${process.env.CRON_SECRET}` sans
// jamais vérifier que le secret existe. CRON_SECRET absente → le secret attendu
// devient la chaîne CONSTANTE "Bearer undefined" ; posée à vide → "Bearer ".
// Dans les deux cas la route s'ouvre à qui envoie cet en-tête : la protection
// se retourne en porte d'entrée exactement quand la config manque.

const ROUTES = [
  { nom: "cron/corroboration", path: "src/app/api/cron/corroboration/route.ts" },
  { nom: "cron/intake-watch", path: "src/app/api/cron/intake-watch/route.ts" },
  // Route ajoutée au moment où le watcher-bridge a reçu son déclencheur : elle
  // naît avec le gate correct, et cette entrée empêche qu'il régresse.
  { nom: "cron/watcher-bridge", path: "src/app/api/cron/watcher-bridge/route.ts" },
];

describe("gates cron fail-closed (source)", () => {
  it.each(ROUTES)(
    "$nom — le gate interpolé sans garde a disparu du code",
    ({ path }) => {
      const src = fs.readFileSync(path, "utf8");
      // On ignore les lignes de commentaire, qui citent volontairement l'ancien
      // motif pour documenter ce qui a été corrigé.
      const code = src
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .join("\n");
      expect(code).not.toMatch(/auth\s*!==\s*`Bearer \$\{process\.env\.CRON_SECRET\}`/);
      expect(code).toContain("if (!secret) return false;");
      expect(code).toContain("timingSafeEqual");
    },
  );
});

// ── Comportement réel des deux handlers ───────────────────────────────────
// prisma et les libs métier sont mockés : on ne teste que la porte.

vi.mock("@/lib/prisma", () => ({
  prisma: { watchSource: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/intake/watcher", () => ({ checkSource: vi.fn(async () => ({})) }));
vi.mock("@/lib/intake/corroboration", () => ({
  computeCorroboration: vi.fn(async () => []),
  applyCorroborationToLabels: vi.fn(async () => 0),
}));

function req(authorization?: string): any {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? (authorization ?? null) : null,
    },
  };
}

describe.each(ROUTES)("$nom — porte au runtime", ({ path }) => {
  const mod = "@/" + path.replace(/^src\//, "").replace(/\.ts$/, "");
  const ORIGINAL = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
    vi.resetModules();
  });

  it("REFUSE 'Bearer undefined' quand CRON_SECRET est absente", async () => {
    // LA régression. Avant le correctif, cet en-tête EXACT ouvrait la route.
    delete process.env.CRON_SECRET;
    const { GET } = await import(mod);
    const res = await GET(req("Bearer undefined"));
    expect(res.status).toBe(401);
  });

  it("REFUSE 'Bearer ' quand CRON_SECRET est la chaîne vide", async () => {
    process.env.CRON_SECRET = "";
    const { GET } = await import(mod);
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
  });

  it("REFUSE toute requête quand CRON_SECRET est absente, même sans en-tête", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import(mod);
    expect((await GET(req())).status).toBe(401);
  });

  it("REFUSE un mauvais secret", async () => {
    process.env.CRON_SECRET = "le-vrai-secret";
    const { GET } = await import(mod);
    expect((await GET(req("Bearer mauvais"))).status).toBe(401);
  });

  it("ACCEPTE le bon secret (la route reste fonctionnelle)", async () => {
    process.env.CRON_SECRET = "le-vrai-secret";
    const { GET } = await import(mod);
    const res = await GET(req("Bearer le-vrai-secret"));
    expect(res.status).not.toBe(401);
  });
});
