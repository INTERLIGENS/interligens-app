// __tests__/security/proceedsStatusBasicAuth.test.ts
//
// /api/admin/kol/[handle]/proceeds/status publie des données forensiques
// (Observed Proceeds, pricingQuality). Son Basic auth était construit sur
// `process.env.X ?? ""` : les deux variables absentes, le secret attendu
// valait `"Basic Og=="` — le base64 de `":"` — et un appelant qui envoyait
// exactement cet en-tête passait.
//
// Le test central est donc celui-ci : en l'absence des variables, l'en-tête
// `Basic Og==` ne doit PAS ouvrir la route.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const executed = { updates: 0 };

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = vi.fn(async () => [{ reviewStatus: "draft" }]);
    $executeRawUnsafe = vi.fn(async () => {
      executed.updates++;
      return 1;
    });
  },
}));

const ROUTE = "https://x.test/api/admin/kol/bkokoski/proceeds/status";
const params = Promise.resolve({ handle: "bkokoski" });

function req(authHeader?: string): NextRequest {
  return new NextRequest(ROUTE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify({ status: "reviewed" }),
  });
}

function basic(user: string, pass: string): string {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

const ORIGINAL = {
  user: process.env.ADMIN_BASIC_USER,
  pass: process.env.ADMIN_BASIC_PASS,
};

function restore(key: "ADMIN_BASIC_USER" | "ADMIN_BASIC_PASS", v: string | undefined) {
  if (v === undefined) delete process.env[key];
  else process.env[key] = v;
}

beforeEach(() => {
  executed.updates = 0;
  vi.clearAllMocks();
  restore("ADMIN_BASIC_USER", ORIGINAL.user);
  restore("ADMIN_BASIC_PASS", ORIGINAL.pass);
});

async function callPOST(authHeader?: string) {
  const { POST } = await import("@/app/api/admin/kol/[handle]/proceeds/status/route");
  return POST(req(authHeader), { params });
}

describe("proceeds/status — Basic auth fail-closed", () => {
  it("REFUSE 'Basic Og==' quand les deux variables sont absentes", async () => {
    // Le bug historique : base64(":") devenait un secret valide.
    delete process.env.ADMIN_BASIC_USER;
    delete process.env.ADMIN_BASIC_PASS;

    const res = await callPOST(basic("", ""));
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(500);
    expect(executed.updates).toBe(0);
  });

  it("REFUSE toute requête quand une seule des deux variables manque", async () => {
    process.env.ADMIN_BASIC_USER = "admin";
    delete process.env.ADMIN_BASIC_PASS;
    expect((await callPOST(basic("admin", ""))).status).toBe(500);

    delete process.env.ADMIN_BASIC_USER;
    process.env.ADMIN_BASIC_PASS = "secret";
    expect((await callPOST(basic("", "secret"))).status).toBe(500);

    expect(executed.updates).toBe(0);
  });

  it("REFUSE quand les variables sont posées à la chaîne vide", async () => {
    // Une variable vide ne doit pas devenir la moitié d'un secret valide.
    process.env.ADMIN_BASIC_USER = "";
    process.env.ADMIN_BASIC_PASS = "";
    expect((await callPOST(basic("", ""))).status).toBe(500);
    expect(executed.updates).toBe(0);
  });

  it("REFUSE un mauvais mot de passe par un 401", async () => {
    process.env.ADMIN_BASIC_USER = "admin";
    process.env.ADMIN_BASIC_PASS = "le-bon-secret";
    expect((await callPOST(basic("admin", "le-mauvais"))).status).toBe(401);
    expect(executed.updates).toBe(0);
  });

  it("REFUSE l'absence totale d'en-tête", async () => {
    process.env.ADMIN_BASIC_USER = "admin";
    process.env.ADMIN_BASIC_PASS = "le-bon-secret";
    expect((await callPOST(undefined)).status).toBe(401);
    expect(executed.updates).toBe(0);
  });

  it("AUTORISE les bons identifiants — et la route fait son travail", async () => {
    // Le sens inverse : sans ce cas, un garde qui refuse tout passerait aussi.
    process.env.ADMIN_BASIC_USER = "admin";
    process.env.ADMIN_BASIC_PASS = "le-bon-secret";
    const res = await callPOST(basic("admin", "le-bon-secret"));
    expect(res.status).toBe(200);
    expect(executed.updates).toBe(1);
  });
});
