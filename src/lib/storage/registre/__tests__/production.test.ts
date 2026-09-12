// src/lib/storage/registre/__tests__/production.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// E-RC · LEASE A — LE COMPORTEMENT, PROUVÉ HORS FENÊTRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Le correctif n'est PAS appliqué : `src/app/api/pdf/casefile/route.ts` est un
// chemin GELÉ. Ce qui est prouvé ici, c'est la DÉCISION — et elle vit dans une
// primitive non gelée, précisément pour qu'elle soit prouvable avant la
// fenêtre plutôt que pendant.

const ENTREE = { buffer: Buffer.from("pdf"), subject: "So1111", batchId: "casefile" };

interface Classes {
  ErreurStockageGouverne: typeof import("../../pdfStorage").ErreurStockageGouverne;
  ErreurRegistre: typeof import("../registre").ErreurRegistre;
}

/**
 * `upload` est une FABRIQUE, pas une valeur : les classes d'erreur doivent
 * être celles que `production.ts` verra, et elles ne sont connues qu'APRÈS le
 * `resetModules`. Les construire avant, depuis un import de tête, donnerait
 * deux identités de classe pour un même nom — `instanceof` serait faux, la
 * primitive tomberait dans la branche « échec de génération » qui RELÈVE, et
 * le test rendrait vert une primitive qui laisse passer.
 */
async function chargerAvec(opts: {
  storageActive?: boolean;
  upload?: (c: Classes) => ReturnType<typeof vi.fn>;
}) {
  vi.resetModules();
  const reelPdfStorage = await import("../../pdfStorage");
  const reelRegistre = await import("../registre");
  const classes: Classes = {
    ErreurStockageGouverne: reelPdfStorage.ErreurStockageGouverne,
    ErreurRegistre: reelRegistre.ErreurRegistre,
  };

  vi.doMock("../../pdfStorage", () => ({
    isStorageEnabled: () => opts.storageActive ?? true,
    uploadPdf: opts.upload ? opts.upload(classes) : vi.fn(),
    // Les CLASSES réelles : `instanceof` est ce qui trie les échecs, et un
    // double de classe le ferait échouer en silence — donc tomber dans la
    // branche « échec de génération » qui RELÈVE. Le test rendrait alors vert
    // une primitive qui laisse passer.
    ErreurStockageGouverne: reelPdfStorage.ErreurStockageGouverne,
  }));
  vi.doMock("../registre", () => ({ ErreurRegistre: reelRegistre.ErreurRegistre }));

  return { mod: await import("../production"), ...classes };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../../pdfStorage");
  vi.doUnmock("../registre");
});

describe("produireArtefactGouverne — les quatre fail-closed", () => {
  it("stockage gouverné indisponible ⇒ REFUS, pas un contournement", async () => {
    // Le trou que la lease A referme : `PDF_STORAGE_ENABLED` absent en
    // production faisait servir le CaseFile en flux direct, hors registre.
    const { mod } = await chargerAvec({ storageActive: false });
    const r = await mod.produireArtefactGouverne(ENTREE);
    expect(r.produit).toBe(false);
    if (r.produit) return;
    expect(r.raison).toBe("STOCKAGE_GOUVERNE_INDISPONIBLE");
    expect(r.explication).toMatch(/elle ne décide pas si l'autorité existe/);
  });

  it("allocation impossible ⇒ REFUS, et AUCUN objet n'a été écrit", async () => {
    const { mod } = await chargerAvec({
      upload: (c) =>
        vi.fn().mockRejectedValue(
          new c.ErreurRegistre("TABLE_ABSENTE", "table governed_objects absente"),
        ),
    });
    const r = await mod.produireArtefactGouverne(ENTREE);
    expect(r.produit).toBe(false);
    if (r.produit) return;
    expect(r.raison).toBe("REGISTRE_INDISPONIBLE");
    expect(r.explication).toMatch(/aucun objet n'a été écrit/);
  });

  it("PUT impossible ⇒ REFUS, ligne INTENDED réconciliable", async () => {
    const { mod } = await chargerAvec({
      upload: (c) =>
        vi.fn().mockRejectedValue(
          new c.ErreurStockageGouverne("PUT_ECHOUE", "R2 down", "reports/production/2026/09/ff.pdf"),
        ),
    });
    const r = await mod.produireArtefactGouverne(ENTREE);
    expect(r.produit).toBe(false);
    if (r.produit) return;
    expect(r.raison).toBe("ECRITURE_OBJET_IMPOSSIBLE");
    expect(r.explication).toMatch(/réconciliable/);
  });

  it("confirmation impossible ⇒ REFUS, et l'objet EXISTE avec sa clé connue", async () => {
    // Le PUT à faux négatif, vu depuis la route : l'artefact est en R2, il
    // n'est pas publiable, et il n'est pas perdu.
    const { mod } = await chargerAvec({
      upload: (c) =>
        vi.fn().mockRejectedValue(
          new c.ErreurStockageGouverne(
            "CONFIRMATION_ECHOUEE", "coupure après le PUT", "reports/production/2026/09/ab.pdf",
          ),
        ),
    });
    const r = await mod.produireArtefactGouverne(ENTREE);
    expect(r.produit).toBe(false);
    if (r.produit) return;
    expect(r.raison).toBe("ENREGISTREMENT_IMPOSSIBLE");
    expect(r.explication).toContain("reports/production/2026/09/ab.pdf");
    expect(r.explication).toMatch(/n'est pas publiable/);
  });
});

describe("AUCUN chemin de sortie ne rend les octets sans les avoir enregistrés", () => {
  it("aucun refus ne porte d'URL, de clé, ni de corps", async () => {
    // La propriété entière de cette primitive : la variante « voici le PDF,
    // mais hors registre » N'EXISTE PAS. Un appelant ne peut pas se tromper
    // en la lisant mal.
    const registreDown = await chargerAvec({
      upload: (c) => vi.fn().mockRejectedValue(new c.ErreurRegistre("REGISTRE_INDISPONIBLE", "down")),
    });
    const stockageOff = await chargerAvec({ storageActive: false });
    const putRate = await chargerAvec({
      upload: (c) => vi.fn().mockRejectedValue(new c.ErreurStockageGouverne("PUT_ECHOUE", "x", null)),
    });
    const refus = [
      await registreDown.mod.produireArtefactGouverne(ENTREE),
      await stockageOff.mod.produireArtefactGouverne(ENTREE),
      await putRate.mod.produireArtefactGouverne(ENTREE),
    ];
    for (const r of refus) {
      expect(r.produit).toBe(false);
      expect(r).not.toHaveProperty("signedUrl");
      expect(r).not.toHaveProperty("key");
      expect(r).not.toHaveProperty("buffer");
      if (!r.produit) expect(r.statutHttp).toBe(503);
    }
  });

  it("503 et jamais 500 — le PDF a été rendu, c'est l'autorité qui manque", async () => {
    const { mod } = await chargerAvec({ storageActive: false });
    const r = await mod.produireArtefactGouverne(ENTREE);
    if (!r.produit) expect(r.statutHttp).toBe(503);
  });
});

describe("ce qui doit continuer de LEVER", () => {
  it("le garde de taille reste un échec de GÉNÉRATION, pas d'autorité", async () => {
    // Un PDF de 30 Mo n'est pas une indisponibilité de registre. Rendre 503
    // ici enverrait chercher au mauvais endroit.
    const { mod } = await chargerAvec({
      upload: () =>
        vi.fn().mockRejectedValue(new Error("[pdfStorage] PDF exceeds max size (30 > 20)")),
    });
    await expect(mod.produireArtefactGouverne(ENTREE)).rejects.toThrow(/exceeds max size/);
  });
});

describe("le chemin nominal", () => {
  it("rend l'identifiant de registre avec l'artefact", async () => {
    const { mod } = await chargerAvec({
      upload: () =>
        vi.fn().mockResolvedValue({
          key: "reports/production/2026/09/ff.pdf",
          signedUrl: "https://signed.example/x",
          sizeBytes: 169_014,
          sha256: "a".repeat(64),
          registreId: "f".repeat(32),
        }),
    });
    const r = await mod.produireArtefactGouverne(ENTREE);
    expect(r).toEqual({
      produit: true,
      key: "reports/production/2026/09/ff.pdf",
      signedUrl: "https://signed.example/x",
      sha256: "a".repeat(64),
      sizeBytes: 169_014,
      registreId: "f".repeat(32),
    });
  });
});
