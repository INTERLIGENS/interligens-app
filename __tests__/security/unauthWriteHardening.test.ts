// __tests__/security/unauthWriteHardening.test.ts
//
// Durcissement des surfaces d'écriture publiques. Chaque garde est prouvé dans
// LES DEUX SENS : refusé au-delà du seuil, autorisé en dessous. Un test qui ne
// montre que le refus passerait aussi avec une route cassée.
//
// Le limiteur réel est utilisé, pas un mock : sans UPSTASH_* dans
// l'environnement de test, checkRateLimit retombe sur le store mémoire, qui est
// déterministe et partagé dans le processus de test. C'est le comportement
// qu'on veut éprouver — un mock qui renvoie toujours `allowed: true` ne
// prouverait rien.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { __resetStoreForTest } from "@/lib/security/rateLimit";
import {
  clampText,
  exceedsLimit,
  TEXT_LIMITS,
  LIST_LIMITS,
  INVESTIGATOR_APPLY_RATE_LIMIT,
  TRANSPARENCY_SUBMIT_RATE_LIMIT,
} from "@/lib/ops/submissionRateLimits";

// ── Mocks de persistance ───────────────────────────────────────────────────
const created = { apply: 0, audit: 0, transparency: 0 };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    investigatorApplication: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => {
        created.apply++;
        return { id: "app_1" };
      }),
    },
    investigatorProgramAuditLog: {
      create: vi.fn(async () => {
        created.audit++;
        return { id: "log_1" };
      }),
    },
    transparencySubmission: {
      create: vi.fn(async () => {
        created.transparency++;
        return { id: "sub_1" };
      }),
    },
  },
}));

function post(url: string, body: unknown, ip: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validApply = {
  handle: "enqueteur",
  email: "a@b.co",
  country: "FR",
  languages: ["fr"],
  specialties: ["onchain"],
  background: "x".repeat(50),
  motivation: "y".repeat(50),
};

const validTransparency = {
  handle: "projet",
  wallets: [{ chain: "SOL", address: "1".repeat(32) }],
};

beforeEach(() => {
  __resetStoreForTest();
  created.apply = 0;
  created.audit = 0;
  created.transparency = 0;
  vi.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────

describe("clampText / exceedsLimit", () => {
  it("borne, puis trim", () => {
    expect(clampText("  abc  ", 10)).toBe("abc");
    expect(clampText("x".repeat(500), 10)).toBe("x".repeat(10));
  });

  it("tout ce qui n'est pas une chaîne devient une chaîne vide", () => {
    // Un nombre ou un objet envoyé à la place d'un texte ne doit pas traverser
    // la validation en se faisant passer pour du contenu.
    for (const v of [42, null, undefined, {}, [], true]) {
      expect(clampText(v, 10)).toBe("");
    }
  });

  it("exceedsLimit ne se déclenche que sur une chaîne trop longue", () => {
    expect(exceedsLimit("x".repeat(11), 10)).toBe(true);
    expect(exceedsLimit("x".repeat(10), 10)).toBe(false);
    expect(exceedsLimit(42, 10)).toBe(false);
    expect(exceedsLimit(undefined, 10)).toBe(false);
  });
});

describe("politiques de limitation", () => {
  it("les deux surfaces publiques sont FAIL-CLOSED", () => {
    // Elles créent du persistant ET du travail humain de tri : une panne du
    // limiteur doit refuser, pas laisser passer.
    expect(INVESTIGATOR_APPLY_RATE_LIMIT.failClosed).toBe(true);
    expect(TRANSPARENCY_SUBMIT_RATE_LIMIT.failClosed).toBe(true);
  });

  it("la fenêtre transparency reprend l'ancien plafond à l'identique", () => {
    // Portage vers un store partagé, pas un resserrage déguisé.
    expect(TRANSPARENCY_SUBMIT_RATE_LIMIT.max).toBe(3);
    expect(TRANSPARENCY_SUBMIT_RATE_LIMIT.windowMs).toBe(86_400_000);
  });

  it("les deux surfaces ont des préfixes de clé distincts", () => {
    // Un préfixe partagé ferait consommer le quota de l'une par l'autre.
    expect(INVESTIGATOR_APPLY_RATE_LIMIT.keyPrefix).not.toBe(
      TRANSPARENCY_SUBMIT_RATE_LIMIT.keyPrefix,
    );
  });
});

// ── /api/investigators/apply ───────────────────────────────────────────────

describe("/api/investigators/apply", () => {
  async function call(body: unknown, ip = "10.0.0.1") {
    const { POST } = await import("@/app/api/investigators/apply/route");
    return POST(post("https://x.test/api/investigators/apply", body, ip));
  }

  it("AUTORISE sous le seuil, et écrit", async () => {
    const res = await call(validApply, "10.0.0.10");
    expect(res.status).toBe(200);
    expect(created.apply).toBe(1);
    expect(created.audit).toBe(1);
  });

  it("BLOQUE au-delà du seuil, et n'écrit plus", async () => {
    const ip = "10.0.0.11";
    const max = INVESTIGATOR_APPLY_RATE_LIMIT.max;
    for (let i = 0; i < max; i++) {
      expect((await call(validApply, ip)).status).toBe(200);
    }
    expect(created.apply).toBe(max);

    const blocked = await call(validApply, ip);
    expect(blocked.status).toBe(429);
    // Le point qui compte : rien de plus n'a été créé.
    expect(created.apply).toBe(max);
    expect(created.audit).toBe(max);
  });

  it("le quota est par IP — une autre IP n'est pas punie", async () => {
    const ip = "10.0.0.12";
    for (let i = 0; i < INVESTIGATOR_APPLY_RATE_LIMIT.max; i++) await call(validApply, ip);
    expect((await call(validApply, ip)).status).toBe(429);
    expect((await call(validApply, "10.0.0.13")).status).toBe(200);
  });

  it("REFUSE un handle hors borne au lieu de le tronquer", async () => {
    // Tronquer enregistrerait une candidature au nom de quelqu'un d'autre.
    const res = await call(
      { ...validApply, handle: "x".repeat(TEXT_LIMITS.handle + 1) },
      "10.0.0.14",
    );
    expect(res.status).toBe(400);
    expect(created.apply).toBe(0);
  });

  it("ACCEPTE un handle exactement à la borne", async () => {
    const res = await call(
      { ...validApply, handle: "x".repeat(TEXT_LIMITS.handle) },
      "10.0.0.15",
    );
    expect(res.status).toBe(200);
  });

  it("REFUSE email, pays et nom d'affichage hors borne", async () => {
    const cases: [string, number][] = [
      ["email", TEXT_LIMITS.email],
      ["country", TEXT_LIMITS.country],
      ["displayName", TEXT_LIMITS.displayName],
    ];
    let ip = 20;
    for (const [field, max] of cases) {
      const res = await call(
        { ...validApply, [field]: "x".repeat(max + 1) },
        `10.0.0.${ip++}`,
      );
      expect(res.status, `${field} devrait être refusé`).toBe(400);
    }
    expect(created.apply).toBe(0);
  });

  it("borne publicLinks AVANT le découpage", async () => {
    const res = await call(
      { ...validApply, publicLinks: Array(5000).fill("https://a.co").join("\n") },
      "10.0.0.30",
    );
    expect(res.status).toBe(200);
    expect(created.apply).toBe(1);
  });
});

// ── /api/transparency/submit ───────────────────────────────────────────────

describe("/api/transparency/submit", () => {
  async function call(body: unknown, ip = "10.1.0.1") {
    const { POST } = await import("@/app/api/transparency/submit/route");
    return POST(post("https://x.test/api/transparency/submit", body, ip));
  }

  it("AUTORISE sous le seuil, et écrit", async () => {
    const res = await call(validTransparency, "10.1.0.10");
    expect(res.status).toBe(200);
    expect(created.transparency).toBe(1);
  });

  it("BLOQUE au-delà du seuil — le plafond s'applique vraiment", async () => {
    // C'est tout l'objet du chantier : l'ancien compteur `new Map()` ne
    // partageait rien entre invocations et ce test échouerait avec lui.
    const ip = "10.1.0.11";
    const max = TRANSPARENCY_SUBMIT_RATE_LIMIT.max;
    for (let i = 0; i < max; i++) {
      expect((await call(validTransparency, ip)).status).toBe(200);
    }
    const blocked = await call(validTransparency, ip);
    expect(blocked.status).toBe(429);
    expect(created.transparency).toBe(max);
  });

  it("REFUSE un corps JSON malformé par un 400, pas un 500", async () => {
    const res = await call("{ ceci n'est pas du json", "10.1.0.12");
    expect(res.status).toBe(400);
    expect(created.transparency).toBe(0);
  });

  it("REFUSE des notes hors borne", async () => {
    const res = await call(
      { ...validTransparency, notes: "x".repeat(TEXT_LIMITS.notes + 1) },
      "10.1.0.13",
    );
    expect(res.status).toBe(400);
    expect(created.transparency).toBe(0);
  });

  it("ACCEPTE des notes exactement à la borne", async () => {
    const res = await call(
      { ...validTransparency, notes: "x".repeat(TEXT_LIMITS.notes) },
      "10.1.0.14",
    );
    expect(res.status).toBe(200);
  });

  it("REFUSE une adresse de portefeuille hors borne", async () => {
    const res = await call(
      { ...validTransparency, wallets: [{ chain: "SOL", address: "1".repeat(TEXT_LIMITS.address + 1) }] },
      "10.1.0.15",
    );
    expect(res.status).toBe(400);
    expect(created.transparency).toBe(0);
  });

  it("REFUSE au-delà du nombre maximum de portefeuilles", async () => {
    const wallets = Array(LIST_LIMITS.wallets + 1).fill({ chain: "SOL", address: "1".repeat(32) });
    expect((await call({ ...validTransparency, wallets }, "10.1.0.16")).status).toBe(400);
    expect(created.transparency).toBe(0);
  });

  it("ACCEPTE exactement le nombre maximum de portefeuilles", async () => {
    const wallets = Array(LIST_LIMITS.wallets).fill({ chain: "SOL", address: "1".repeat(32) });
    expect((await call({ ...validTransparency, wallets }, "10.1.0.17")).status).toBe(200);
  });

  it("REFUSE une chaîne inconnue", async () => {
    const res = await call(
      { ...validTransparency, wallets: [{ chain: "DOGE", address: "1".repeat(32) }] },
      "10.1.0.18",
    );
    expect(res.status).toBe(400);
  });
});
