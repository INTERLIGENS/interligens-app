// ─────────────────────────────────────────────────────────────────────────────
// P0-B — Invariants ADVERSARIAUX communs aux TROIS voies de promotion retail.
//
// Recensement (census §1 du rapport) : exactement trois routes peuvent porter
// une entité à displaySafety='RETAIL_SAFE'. Toutes les autres écritures du
// dépôt posent 'INTERNAL_ONLY' en dur ou laissent le défaut Prisma.
//
//   1. POST  /api/admin/intelligence/entities            (« porte #5 »)
//   2. POST  /api/intelligence/admin/entities/:id/review
//   3. PATCH /api/admin/intelligence/safety
//
// Ce fichier applique LES MÊMES assertions aux trois, par paramétrage : un
// invariant qui ne tiendrait que sur une voie serait un invariant fictif.
// Les trois doivent refuser AVANT toute écriture — fail-closed, jamais de
// repli permissif.
//
// La valeur par défaut des scénarios « identité de reviewer » est
// VOLONTAIREMENT non nominative (`svchcwi.cc`, calquée sur une entité
// réellement RETAIL_SAFE en production) : sans cela, le refus nominatif
// masquerait les refus d'identité et les tests passeraient pour la mauvaise
// raison.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/security/adminAuth", () => ({
  requireAdminApi: () => null,
  isAdminApi: () => true,
}));

// `$transaction` rejoue le callback sur le MÊME objet `prisma` : les espions
// voient les écritures que la route passe ou non par une transaction. Les
// tests ne présument donc d'aucune implémentation.
vi.mock("@/lib/prisma", () => {
  const prisma: Record<string, unknown> = {
    canonicalEntity: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    intelAuditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (p: unknown) => unknown)(prisma) : arg
  );
  return { prisma };
});

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as postEntities } from "@/app/api/admin/intelligence/entities/route";
import { POST as postReview } from "@/app/api/intelligence/admin/entities/[id]/review/route";
import { PATCH as patchSafety } from "@/app/api/admin/intelligence/safety/route";

const upsert = () => prisma.canonicalEntity.upsert as unknown as Mock;
const update = () => prisma.canonicalEntity.update as unknown as Mock;
const findUnique = () => prisma.canonicalEntity.findUnique as unknown as Mock;
const auditCreate = () => prisma.intelAuditLog.create as unknown as Mock;

/** Toute écriture d'entité, quelle que soit la voie. */
function entityWrites(): number {
  return upsert().mock.calls.length + update().mock.calls.length;
}

function req(url: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface Attempt {
  type?: string;
  value?: string;
  reviewedBy?: unknown;
  displaySafety?: string;
}

/** Cible ADMISSIBLE par défaut : un domaine, pas une personne. */
const NON_NOMINATIF = { type: "DOMAIN", value: "svchcwi.cc" };

/** Les trois voies, derrière une seule signature. */
const VOIES = [
  {
    nom: "POST /api/admin/intelligence/entities",
    async appeler(a: Attempt) {
      return postEntities(
        req("/api/admin/intelligence/entities", "POST", {
          type: a.type ?? NON_NOMINATIF.type,
          value: a.value ?? NON_NOMINATIF.value,
          displaySafety: a.displaySafety,
          ...(a.reviewedBy === undefined ? {} : { reviewedBy: a.reviewedBy }),
        })
      );
    },
  },
  {
    nom: "POST /api/intelligence/admin/entities/:id/review",
    async appeler(a: Attempt) {
      return postReview(
        req("/api/intelligence/admin/entities/ent_1/review", "POST", {
          displaySafety: a.displaySafety,
          ...(a.reviewedBy === undefined ? {} : { reviewedBy: a.reviewedBy }),
        }),
        { params: Promise.resolve({ id: "ent_1" }) }
      );
    },
  },
  {
    nom: "PATCH /api/admin/intelligence/safety",
    async appeler(a: Attempt) {
      return patchSafety(
        req("/api/admin/intelligence/safety", "PATCH", {
          entityId: "ent_1",
          displaySafety: a.displaySafety,
          ...(a.reviewedBy === undefined ? {} : { reviewedBy: a.reviewedBy }),
        })
      );
    },
  },
] as const;

/** L'entité que les routes 2 et 3 relisent avant d'écrire. */
function stubEntity(over: Record<string, unknown> = {}) {
  const row = {
    id: "ent_1",
    type: NON_NOMINATIF.type,
    value: NON_NOMINATIF.value,
    displaySafety: "INTERNAL_ONLY",
    reviewedBy: null,
    reviewedAt: null,
    ...over,
  };
  findUnique().mockResolvedValue(row);
  upsert().mockResolvedValue({ ...row, displaySafety: "RETAIL_SAFE" });
  update().mockResolvedValue({ ...row, displaySafety: "RETAIL_SAFE" });
  return row;
}

async function refus(voie: (typeof VOIES)[number], a: Attempt) {
  const res = await voie.appeler(a);
  expect(entityWrites()).toBe(0);
  expect(auditCreate()).not.toHaveBeenCalled();
  return res;
}

describe.each(VOIES)("P0-B — invariants de promotion retail · $nom", (voie) => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubEntity();
  });

  // ── Identité de reviewer, sur une cible admissible ────────────────────────

  it("REPRO FORTA (moitié 1) — RETAIL_SAFE sans reviewedBy → FAIL-CLOSED", async () => {
    const res = await refus(voie, { displaySafety: "RETAIL_SAFE" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("REVIEWER_REQUIRED");
  });

  it("reviewedBy générique « admin » → FAIL sur cette voie aussi", async () => {
    const res = await refus(voie, {
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "admin",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("REVIEWER_GENERIC");
  });

  it.each(["unknown", "system", "root", "test", "n/a", "null", "ok"])(
    "reviewedBy=%p → FAIL",
    async (who) => {
      const res = await refus(voie, {
        displaySafety: "RETAIL_SAFE",
        reviewedBy: who,
      });
      expect(res.status).toBe(400);
    }
  );

  it.each(["", "   ", "a", "ab", "-dood", "do od", "d".repeat(33)])(
    "reviewedBy mal formé (%p) → FAIL",
    async (who) => {
      const res = await refus(voie, {
        displaySafety: "RETAIL_SAFE",
        reviewedBy: who,
      });
      expect(res.status).toBe(400);
    }
  );

  it.each([null, 42, true, {}, ["dood"]])(
    "reviewedBy non-string (%p) → FAIL, pas de coercition",
    async (who) => {
      const res = await refus(voie, {
        displaySafety: "RETAIL_SAFE",
        reviewedBy: who as unknown,
      });
      expect(res.status).toBe(400);
    }
  );

  // ── Contenu nominatif — la régression Forta proprement dite ───────────────

  it("RÉGRESSION FORTA — @bkokoski typé DOMAIN + reviewer RÉEL → 403, rien écrit", async () => {
    stubEntity({ type: "DOMAIN", value: "@bkokoski" });
    const res = await refus(voie, {
      type: "DOMAIN",
      value: "@bkokoski",
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "dood",
    });

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOMINATIVE_CONTENT");
  });

  it.each(["@bkokoski", "@gordongekko", "@sxyz500", "@lynk0x"])(
    "les 4 pseudos de l'incident du 2026-04-08 (%s) sont refusés",
    async (pseudo) => {
      stubEntity({ type: "DOMAIN", value: pseudo });
      const res = await refus(voie, {
        type: "DOMAIN",
        value: pseudo,
        displaySafety: "RETAIL_SAFE",
        reviewedBy: "dood",
      });
      expect(res.status).toBe(403);
    }
  );

  it.each(["DOMAIN", "ADDRESS", "PROJECT", "CONTRACT", "TOKEN_CA"])(
    "le type déclaré (%s) ne rachète pas un pseudo — détection sur le CONTENU",
    async (type) => {
      stubEntity({ type, value: "@bkokoski" });
      const res = await refus(voie, {
        type,
        value: "@bkokoski",
        displaySafety: "RETAIL_SAFE",
        reviewedBy: "dood",
      });
      expect(res.status).toBe(403);
    }
  );

  it("aucun repli permissif : un pseudo reste refusé même sans reviewer", async () => {
    stubEntity({ type: "DOMAIN", value: "@lynk0x" });
    const res = await refus(voie, {
      type: "DOMAIN",
      value: "@lynk0x",
      displaySafety: "RETAIL_SAFE",
    });
    // Refusé pour la BONNE raison : le contenu, pas l'identité manquante.
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("NOMINATIVE_CONTENT");
  });

  it("PERSON reste refusé, même avec une valeur non nominative", async () => {
    stubEntity({ type: "PERSON", value: "svchcwi.cc" });
    const res = await refus(voie, {
      type: "PERSON",
      value: "svchcwi.cc",
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "dood",
    });
    expect(res.status).toBe(403);
  });

  // ── Ce qui doit rester possible ───────────────────────────────────────────

  it("promotion VALIDE — cible admissible + identité réelle → estampille ET audit", async () => {
    const res = await voie.appeler({
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "dood",
    });

    expect(res.status).toBeLessThan(400);
    expect(entityWrites()).toBe(1);

    const call = (upsert().mock.calls[0] ?? update().mock.calls[0])[0] as Record<
      string,
      Record<string, unknown>
    >;
    const written = call.data ?? call.update;
    expect(written.reviewedBy).toBe("dood");
    expect(written.reviewedAt).toBeInstanceOf(Date);

    expect(auditCreate()).toHaveBeenCalledOnce();
    const audit = auditCreate().mock.calls[0][0] as {
      data: { actor: string; targetType: string; detail: Record<string, unknown> };
    };
    expect(audit.data.actor).toBe("admin:dood");
    expect(audit.data.targetType).toBe("CanonicalEntity");
    expect(audit.data.detail.to).toBe("RETAIL_SAFE");
  });

  it("NON-RÉGRESSION — l'adresse Solana réellement RETAIL_SAFE reste publiable", async () => {
    const v = "35vypiSvQsxRiT3YZzGRGVaduUSx67ysZb";
    stubEntity({ type: "ADDRESS", value: v });
    const res = await voie.appeler({
      type: "ADDRESS",
      value: v,
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "dood",
    });
    expect(res.status).toBeLessThan(400);
    expect(entityWrites()).toBe(1);
  });

  it("le « @ » de tête est toléré côté REVIEWER : @Dood == dood", async () => {
    const res = await voie.appeler({
      displaySafety: "RETAIL_SAFE",
      reviewedBy: "@Dood",
    });
    expect(res.status).toBeLessThan(400);
    const audit = auditCreate().mock.calls[0][0] as { data: { actor: string } };
    expect(audit.data.actor).toBe("admin:dood");
  });

  it("NON-RÉGRESSION — une cible non-retail ne réclame ni reviewer ni refus", async () => {
    const res = await voie.appeler({ displaySafety: "INTERNAL_ONLY" });
    expect(res.status).toBeLessThan(400);
    expect(entityWrites()).toBe(1);
  });

  it("NON-RÉGRESSION — un pseudo peut toujours être classé INTERNAL_ONLY", async () => {
    stubEntity({ type: "DOMAIN", value: "@bkokoski" });
    const res = await voie.appeler({
      type: "DOMAIN",
      value: "@bkokoski",
      displaySafety: "INTERNAL_ONLY",
    });
    expect(res.status).toBeLessThan(400);
    expect(entityWrites()).toBe(1);
  });
});
