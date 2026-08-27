// ─── INCIDENT 2026-08-27, moitié B — le cron rendait vert sur un échec total ─
//
// Doctrine C4 : ne jamais affirmer une propriété différente de celle mesurée.
//
// `GET /api/cron/intel-summarize` compte ses succès et ses échecs, écrit
// `lastSummaryError` en base… puis répond `{ok: true, succeeded: 0, failed: N}`.
// Une supervision branchée sur `ok` voit un cron vert. Le modèle épinglé était
// mort depuis le 15 juin ; plus aucun item n'a été résumé, et rien ne l'a dit.
//
// ─── Chemin gelé ──────────────────────────────────────────────────────────
// src/app/api/cron/intel-summarize/route.ts est couvert par le motif
// `^src/app/api/` de scripts/guard-offline.sh. Le correctif n'est PAS appliqué
// ici : il est livré en patch (docs/prep/patches/) avec le bloc d'exemption à
// valider. Les deux tests de comportement sont donc marqués `it.fails` — ils
// consignent le défaut ET se retournent en rouge le jour où le patch est
// appliqué, ce qui force leur conversion en `it` normal. Le patch contient
// cette conversion.

import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSpy = vi.fn(async () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    founderIntelItem: {
      findMany: vi.fn(async () => [
        { id: "i1", title: "T1", source: "S", excerpt: null },
        { id: "i2", title: "T2", source: "S", excerpt: null },
      ]),
      update: (...a: unknown[]) => updateSpy(...(a as [])),
    },
  },
}));
vi.mock("@/lib/ops/prodWriteGuard", () => ({ prodWriteGuardResponse: () => null }));

// Le service répond comme il le faisait pendant l'incident : modèle introuvable
// sur chaque item, aucun contenu.
vi.mock("@/lib/llm/llm.service", () => ({
  llmComplete: vi.fn(async () => ({
    content: "",
    provider: "anthropic",
    useCase: "entity_enrichment",
    latencyMs: 1,
    fallbackUsed: true,
    errorKind: "MODEL_NOT_FOUND",
    error: "NotFoundError:model: claude-sonnet-4-20250514",
  })),
}));

type MinimalReq = { headers: { get: (k: string) => string | null } };

function cronReq(secret: string): MinimalReq {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? `Bearer ${secret}` : null,
    },
  };
}

async function runCron() {
  const { GET } = await import("@/app/api/cron/intel-summarize/route");
  // La route ne lit que l'en-tête Authorization : un objet minimal suffit et
  // évite de fabriquer un NextRequest complet.
  const res = await GET(cronReq("cron-secret-de-test") as unknown as Parameters<typeof GET>[0]);
  return { status: res.status, body: await res.json() };
}

describe("cron intel-summarize — l'incident, mesuré", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret-de-test";
    updateSpy.mockClear();
  });

  it("le cron MESURE bien l'échec — deux items sur deux", async () => {
    // Ce test passe aujourd'hui : le comptage est correct. Le défaut n'est pas
    // dans la mesure, il est dans ce que la route en dit.
    const { body } = await runCron();
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(0);
    expect(body.failed).toBe(2);
  });

  it("l'échec est bien écrit en base, item par item", async () => {
    await runCron();
    expect(updateSpy).toHaveBeenCalledTimes(2);
    const written = JSON.stringify(updateSpy.mock.calls);
    expect(written).toContain("lastSummaryError");
    expect(written).toContain("summaryAttempts");
  });

  // ── Les deux assertions que le correctif doit rendre vraies ──────────────

  it.fails("PENDING PATCH — échec total → jamais ok:true", async () => {
    const { body } = await runCron();
    expect(body.ok).not.toBe(true);
  });

  it.fails("PENDING PATCH — la réponse remonte la CAUSE, pas qu'un compteur", async () => {
    const { body } = await runCron();
    expect(JSON.stringify(body)).toMatch(/MODEL_NOT_FOUND/);
  });
});
