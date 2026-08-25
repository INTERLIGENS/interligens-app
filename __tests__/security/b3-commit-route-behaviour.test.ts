/**
 * __tests__/security/b3-commit-route-behaviour.test.ts
 *
 * B3 — bloc 3, refait pour VISER LE CODE DE PRODUCTION.
 *
 * ── CE QU'ILS FAISAIENT ──────────────────────────────────────────────────
 * Les trois tests d'origine (`evidence-observability.test.ts`, bloc 3)
 * choisissaient leur source ainsi :
 *
 *     const src = tree.includes("orphanEvidenceItemIds")
 *       ? tree
 *       : fs.readFileSync(PATCH, "utf8");   // ← le fichier .patch
 *
 * `src/app/api/**` étant gelé par le guard, l'arbre ne porte PAS le correctif :
 * la branche retenue est toujours la seconde. Les tests affirmaient donc que le
 * patch contient ce que l'auteur du patch y a écrit. **Tautologie.** Mesuré par
 * la revue du 2026-08-22 : forcer `ok = true` dans la vraie route laissait
 * 15/15 verts.
 *
 * Le défaut est double, et le second survit même si le correctif entre dans
 * l'arbre : ces assertions sont **textuelles** (`expect(src).toMatch(/…/)`).
 * Un grep sur du source n'est pas un test de comportement. `const ok = true;`
 * suivi de `status: ok ? 200 : 207` satisfait le regex et casse la route.
 *
 * ── CE QU'ILS FONT MAINTENANT ────────────────────────────────────────────
 * On importe la VRAIE route, on lui envoie une requête, et on regarde la
 * RÉPONSE. Aucun fichier lu, aucun regex sur du source. Un `ok` faux ne peut
 * plus passer : il apparaît dans le corps de la réponse.
 *
 * ── DÉPENDANCE ASSUMÉE ───────────────────────────────────────────────────
 * Ces tests exigent que `docs/prep/patches/B3-src-app-api-admin-osint-commit-
 * route.ts.patch` soit appliqué à l'arbre. Sans lui ils sont ROUGES — et c'est
 * exactement ce qu'on veut : un test qui reste vert alors que le bug de
 * production est vivant est un test qui ment. Voir FIX_B3_TESTS_2026-08-25.md.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Doubles ───────────────────────────────────────────────────────────────
// Aucun accès base, aucune écriture. Le seul comportement qui varie d'un test
// à l'autre est le résultat du chaînage de preuve.
const chainOperatorEvidence = vi.fn();

vi.mock("@/lib/security/adminAuth", () => ({ requireAdminApi: () => null }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // preflightMigration : les 2 colonnes vision sont présentes.
    $queryRawUnsafe: vi.fn(async () => [
      { column_name: "extractionMethod" },
      { column_name: "extractionConfidence" },
    ]),
    // EvidenceSnapshot : 1 ligne insérée.
    $executeRawUnsafe: vi.fn(async () => 1),
    kolProfile: { upsert: vi.fn(async () => ({ handle: "kol_test" })) },
    kolTokenLink: { upsert: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/osint/vision/validateCA", () => ({ isPending: () => false }));

vi.mock("@/lib/osint/evidenceCommitBridge", () => ({
  validateCommitImages: () => ({ ok: true, mismatches: [], unknown: [] }),
  chainOperatorEvidence,
}));

/** Un plan minimal et VALIDE : une pièce, aucun lien. */
function planRequest() {
  const body = {
    plan: {
      kolProfileToCreate: { handle: "kol_test", platform: "x" },
      kolTokenLinksToCreate: [],
      evidences: [
        {
          sessionId: "sess-1",
          localFilePath: "/tmp/capture.png",
          sha256: "a".repeat(64),
          relationType: "kol",
          relationKey: "kol_test",
          snapshotType: "tweet",
          title: "capture",
          caption: "capture",
        },
      ],
    },
  };
  return {
    json: async () => body,
    headers: { get: () => null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.resetModules();
  chainOperatorEvidence.mockReset();
});

describe("B3 bloc 3 — la route de commit, par son COMPORTEMENT", () => {
  it("EFFET 3/4 — un chaînage en échec rend ok:false et 207, pas 200 ok:true", async () => {
    chainOperatorEvidence.mockResolvedValue({
      sha256: "a".repeat(64),
      mode: "failed",
      evidenceItemId: "ev-orphan-1",
      tsaPending: false,
      error: "R2 PUT failed",
    });

    const { POST } = await import("@/app/api/admin/osint/commit/route");
    const res = await POST(planRequest());
    const body = await res.json();

    // Le défaut d'origine, dit en une ligne : c'était 200 / ok:true.
    expect(body.ok).toBe(false);
    expect(res.status).toBe(207);
    // Le chaînage a bien échoué dans le rapport (sinon le test ne prouve rien).
    expect(body.evidenceChain).toHaveLength(1);
    expect(body.evidenceChain[0].mode).toBe("failed");
  });

  it("EFFET 4/4 — l'identifiant de l'orpheline remonte au PREMIER NIVEAU", async () => {
    chainOperatorEvidence.mockResolvedValue({
      sha256: "a".repeat(64),
      mode: "failed",
      evidenceItemId: "ev-orphan-1",
      tsaPending: false,
      error: "R2 PUT failed",
    });

    const { POST } = await import("@/app/api/admin/osint/commit/route");
    const body = await (await POST(planRequest())).json();

    // Sans cet identifiant, la ligne créée puis abandonnée n'est ni marquable,
    // ni réparable, ni retirable : c'est l'orpheline cmssyx6se… de 2026-08-14.
    expect(body.orphanEvidenceItemIds).toEqual(["ev-orphan-1"]);
  });

  it("un chaînage en échec SANS identifiant ne fabrique pas de faux id", async () => {
    chainOperatorEvidence.mockResolvedValue({
      sha256: "a".repeat(64),
      mode: "failed",
      evidenceItemId: null, // échec AVANT création de la pièce
      tsaPending: false,
      error: "boom",
    });

    const { POST } = await import("@/app/api/admin/osint/commit/route");
    const body = await (await POST(planRequest())).json();

    expect(body.ok).toBe(false); // l'échec compte quand même
    expect(body.orphanEvidenceItemIds).toEqual([]); // mais aucun id inventé
  });

  it("un chaînage RÉUSSI rend toujours 200 ok:true — la garde ne sur-déclenche pas", async () => {
    chainOperatorEvidence.mockResolvedValue({
      sha256: "a".repeat(64),
      mode: "bytes",
      evidenceItemId: "ev-ok-1",
      tsaPending: false,
      error: null,
    });

    const { POST } = await import("@/app/api/admin/osint/commit/route");
    const res = await POST(planRequest());
    const body = await res.json();

    // Le pendant indispensable : une garde qui refuse tout est inutilisable.
    expect(body.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(body.orphanEvidenceItemIds).toEqual([]);
  });
});
