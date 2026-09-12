/**
 * __tests__/casefile/s3-c3-generate-nom-fichier.test.ts
 *
 * BUILD 13 · S3 — CRITÈRE 3
 *
 *   LE **NOM DE FICHIER** DE L'ARTEFACT PRODUIT PAR `/api/casefile/generate`
 *   DÉRIVE DU `CaseFileRef` GOUVERNÉ.
 *
 * ─── LE NOM DE FICHIER EST UNE IDENTITÉ DE CITATION ───────────────────────
 *
 * ██  Le nom survit au document. Il est ce qui reste quand le PDF a été   ██
 * ██  transmis, renommé nulle part, classé dans un dossier partagé.       ██
 *
 * `src/app/api/casefile/generate/route.ts:101` nomme l'artefact depuis
 * `input.case_meta.case_id` — c'est-à-dire depuis le PRESET (`presets.ts:55`,
 * `CASE-2024-BOTIFY-001`) — ALORS QUE la ligne 59 vient de charger le dossier
 * gouverné et que la ligne 70 en pose déjà le `ref` dans le document.
 *
 * La route DISPOSE donc de l'identité fondée au moment où elle nomme le
 * fichier, et elle nomme avec l'autre. Deux artefacts du même dossier, l'un
 * nommé par la frontière et l'autre par le vestige.
 *
 * ─── LE MUTANT DÉCISIF ────────────────────────────────────────────────────
 *
 * Écrire `filename="IL-SHILL-BOTIFY-001.pdf"` en dur satisferait le critère
 * sans rien dériver. La leçon RC-2 de S2 s'applique mot pour mot :
 *
 *     une COÏNCIDENCE DE LITTÉRAL n'est pas une DÉRIVATION.
 *
 * Le mutant fait donc varier le `ref` du dossier chargé et exige que le nom
 * SUIVE. Un nom en dur meurt dessus ; une dérivation passe.
 *
 * ─── PÉRIMÈTRE ────────────────────────────────────────────────────────────
 *
 * On ne renomme PAS le champ `case_meta.case_id` : y mettre un `CaseFileRef`
 * ferme la causalité d'identité de l'artefact, pas la sémantique du champ.
 * Dette P1 SERVED / SCHEMA SEMANTICS, lot séparé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { refDuDossier } = vi.hoisted(() => ({ refDuDossier: { valeur: "IL-SHILL-BOTIFY-001" } }));

vi.mock("@/lib/security/adminAuth", () => ({
  requireAdminApi: () => null, // habilité
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Le dossier gouverné, FONDÉ. Son `ref` est pilotable : c'est lui que le nom
// doit suivre.
vi.mock("@/lib/casefile/canonicalReader", () => ({
  loadCanonicalCaseFile: vi.fn(async () => ({
    ref: refDuDossier.valeur,
    codename: "BOTIFY",
    ticker: "$BOTIFY",
    title: "Dossier gouverné",
    claims: [],
    sources: [],
  })),
  assertProvenanceSurvives: () => {},
}));

// Le moteur ne tourne pas : le critère porte sur le NOM, pas sur le rendu.
// C4 mesure le rendu, et il le fait sur le vrai moteur.
vi.mock("@/lib/casefile/pdfGenerator", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/casefile/pdfGenerator")>();
  return {
    ...reel,
    generateCaseFilePdf: vi.fn(async () => ({
      success: true as const,
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // "%PDF"
    })),
  };
});

import { POST } from "@/app/api/casefile/generate/route";
import { BOTIFY_CASEFILE_REF } from "@/lib/casefile/publicProjection";
import { buildBotifyInput } from "@/lib/casefile/presets";

/**
 * LA SONDE — le nom de fichier annoncé dans `Content-Disposition`.
 *
 * Elle rend `null` quand l'en-tête n'en porte pas : une sonde qui rendrait ""
 * ferait passer une absence pour une valeur.
 */
export function nomDeFichier(contentDisposition: string | null): string | null {
  const m = /filename="([^"]+)"/.exec(contentDisposition ?? "");
  return m ? m[1] : null;
}

async function nommerArtefact(): Promise<{ nom: string | null; statut: number }> {
  const res = await POST(
    new Request("https://app.interligens.com/api/casefile/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "botify" }),
    }) as never,
  );
  return { nom: nomDeFichier(res.headers.get("content-disposition")), statut: res.status };
}

beforeEach(() => {
  refDuDossier.valeur = BOTIFY_CASEFILE_REF;
});

describe("S3 · C3 — PRÉALABLE : la sonde lit bien le nom annoncé", () => {
  it("la route produit un artefact nommé, et la sonde en extrait le nom", async () => {
    const { nom, statut } = await nommerArtefact();
    expect(statut).toBe(200);
    expect(nom, "la sonde ne lit AUCUN nom : elle est aveugle, pas satisfaite").not.toBeNull();
    expect(nom).toMatch(/\.pdf$/);
  });

  // ── APRÈS CORRECTION — l'ANTI-RÉGRESSION ────────────────────────────────
  //
  // Le préalable assertait le nom SERVI : `CASE-2024-BOTIFY-001.pdf`, celui du
  // PRESET, alors que la route venait de charger le dossier. Il épingle
  // désormais la valeur retirée, et prouve toujours que la sonde n'est pas
  // aveugle — c'est le préalable suivant qui porte cette preuve.
  it("le nom du PRESET est nommé, et il n'est plus celui de l'artefact", async () => {
    const { nom } = await nommerArtefact();
    expect(buildBotifyInput().case_meta.case_id).toBe("CASE-2024-BOTIFY-001");
    expect(nom).not.toBe("CASE-2024-BOTIFY-001.pdf");
    expect(nom).toBe(`${refDuDossier.valeur}.pdf`);
  });

  it("la sonde distingue une absence d'en-tête d'un nom vide", () => {
    expect(nomDeFichier(null)).toBeNull();
    expect(nomDeFichier("attachment")).toBeNull();
    expect(nomDeFichier('attachment; filename="x.pdf"')).toBe("x.pdf");
  });
});

describe("S3 · C3 — CRITÈRE : le nom dérive du ref gouverné", () => {
  it("l'artefact est nommé par le CaseFileRef du dossier chargé", async () => {
    const { nom } = await nommerArtefact();
    expect(nom).toBe(`${BOTIFY_CASEFILE_REF}.pdf`);
  });

  it("et il ne porte plus l'identité de l'espace de nommage historique", async () => {
    const { nom } = await nommerArtefact();
    expect(nom).not.toMatch(/CASE-\d{4}-/);
  });
});

describe("S3 · C3 — MUTANT DÉCISIF : le nom SUIT le ref, il ne coïncide pas avec lui", () => {
  it("un dossier dont le ref change fait changer le nom — un littéral en dur meurt ici", async () => {
    refDuDossier.valeur = "IL-SHILL-BOTIFY-002";
    const { nom } = await nommerArtefact();
    expect(nom).toBe("IL-SHILL-BOTIFY-002.pdf");
  });

  it("un ref d'une AUTRE famille aussi — la dérivation ne connaît pas le sujet", async () => {
    refDuDossier.valeur = "IL-SHILL-VINE-001";
    const { nom } = await nommerArtefact();
    expect(nom).toBe("IL-SHILL-VINE-001.pdf");
  });

  it("CONTRÔLE NÉGATIF — le ref nominal rend bien le nom nominal", async () => {
    refDuDossier.valeur = BOTIFY_CASEFILE_REF;
    const { nom } = await nommerArtefact();
    expect(nom).toBe("IL-SHILL-BOTIFY-001.pdf");
  });
});
