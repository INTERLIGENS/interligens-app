// src/lib/storage/__tests__/pdfStorage.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import type { LigneDeRegistre } from "../registre/contrat";

// ═══════════════════════════════════════════════════════════════════════════
// E-RC — LES TÉMOINS
// ═══════════════════════════════════════════════════════════════════════════
//
// Un témoin qui montre le refus d'une chose DÉJÀ non servie ne prouve rien :
// l'exposition effective est 0 avant comme après. Ces témoins portent donc
// sur la DÉCISION prise par le code de production — même entrée, deux états
// de registre, deux décisions — et le point de décision est la VRAIE
// primitive, jamais un double.

const CLE_GOUVERNEE = `reports/production/2026/09/${"f".repeat(32)}.pdf`;

function ligne(p: Partial<LigneDeRegistre> = {}): LigneDeRegistre {
  return {
    id: "f".repeat(32),
    bucket: "test-bucket",
    cle: CLE_GOUVERNEE,
    natureObjet: "CASEFILE_RENDER",
    provenance: "GOVERNED_PIPELINE",
    etatDAutorite: "REGISTERED",
    etatDInvalidation: "NONE",
    classeDeRetention: "EVIDENTIARY_INDEFINITE",
    sujet: "So11111111111111111111111111111111111111112",
    lot: "casefile",
    sha256: "a".repeat(64),
    tailleOctets: 169_014,
    typeContenu: "application/pdf",
    producteur: "pdfStorage.uploadPdf",
    alloueLe: new Date("2026-09-12T12:00:00Z"),
    enregistreLe: new Date("2026-09-12T12:00:01Z"),
    invalideLe: null,
    motifInvalidation: null,
    ...p,
  };
}

interface Doubles {
  send?: ReturnType<typeof vi.fn>;
  allouer?: ReturnType<typeof vi.fn>;
  confirmer?: ReturnType<typeof vi.fn>;
  lire?: ReturnType<typeof vi.fn>;
}

async function chargerAvec(d: Doubles) {
  process.env.PDF_STORAGE_ENABLED = "true";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.VERCEL_ENV = "production";
  vi.resetModules();

  const send = d.send ?? vi.fn().mockResolvedValue({});
  const allouer = d.allouer ?? vi.fn(async (e: { cle: string; identifiant: string }) =>
    ligne({ cle: e.cle, id: e.identifiant, etatDAutorite: "INTENDED", enregistreLe: null }));
  const confirmer = d.confirmer ?? vi.fn().mockResolvedValue(undefined);
  const lire = d.lire ?? vi.fn().mockResolvedValue(null);

  vi.doMock("../r2Client", () => ({ r2Client: { send }, isStorageEnabled: () => true }));
  vi.doMock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/x"),
  }));
  const { ErreurRegistre } = await import("../registre/registre");
  vi.doMock("../registre/registre", () => ({
    allouer, confirmerEnregistrement: confirmer, lireParCle: lire, ErreurRegistre,
  }));

  const mod = await import("../pdfStorage");
  return { mod, send, allouer, confirmer, lire };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../registre/registre");
  vi.doUnmock("../r2Client");
  delete process.env.PDF_STORAGE_ENABLED;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.VERCEL_ENV;
  delete process.env.PDF_MAX_SIZE_BYTES;
});

// ─── L'ORDRE EST LE CONTRAT ──────────────────────────────────────────────

describe("uploadPdf — INTENDED → PUT → REGISTERED", () => {
  it("alloue AVANT d'écrire le moindre octet", async () => {
    const ordre: string[] = [];
    const allouer = vi.fn(async (e: { cle: string; identifiant: string }) => {
      ordre.push("allocation");
      return ligne({ cle: e.cle, id: e.identifiant, etatDAutorite: "INTENDED" });
    });
    const send = vi.fn(async () => { ordre.push("put"); return {}; });
    const confirmer = vi.fn(async () => { ordre.push("confirmation"); });

    const { mod } = await chargerAvec({ allouer, send, confirmer });
    const r = await mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" });

    expect(ordre).toEqual(["allocation", "put", "confirmation"]);
    expect(r.registreId).toHaveLength(32);
    expect(r.key).toMatch(/^reports\/production\/\d{4}\/\d{2}\/[0-9a-f]{32}\.pdf$/);
  });

  it("porte au registre le SUJET, et ne le met PAS dans la clé", async () => {
    const mint = "So11111111111111111111111111111111111111112";
    const { mod, allouer } = await chargerAvec({});
    const r = await mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: mint, batchId: "casefile" });

    expect(allouer.mock.calls[0][0]).toMatchObject({
      sujet: mint, lot: "casefile", provenance: "GOVERNED_PIPELINE",
      natureObjet: "CASEFILE_RENDER", classeDeRetention: "EVIDENTIARY_INDEFINITE",
      producteur: "pdfStorage.uploadPdf",
    });
    expect(r.key).not.toContain(mint);
  });

  it("ne pose en métadonnée R2 ni le sujet ni le lot", async () => {
    // Une métadonnée revient en en-tête sur chaque GET — donc à quiconque
    // détient l'URL signée, exactement comme la clé. Déplacer le mint de la
    // clé vers la métadonnée n'aurait rien déplacé du tout.
    const { mod, send } = await chargerAvec({});
    await mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "MINT-SECRET", batchId: "casefile" });
    const meta = send.mock.calls[0][0].input.Metadata;
    expect(Object.keys(meta).sort()).toEqual(["registryid", "sha256"]);
    expect(JSON.stringify(meta)).not.toContain("MINT-SECRET");
  });
});

describe("D5 — No registry authority → no governed artifact production", () => {
  it("allocation en échec ⇒ AUCUN PutObject", async () => {
    const allouer = vi.fn().mockRejectedValue(new Error("[registre] REGISTRE_INDISPONIBLE: down"));
    const { mod, send } = await chargerAvec({ allouer });
    await expect(mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" }))
      .rejects.toThrow(/REGISTRE_INDISPONIBLE/);
    expect(send).not.toHaveBeenCalled();
  });

  it("appelé stockage désactivé ⇒ lève, ne rend pas null", async () => {
    vi.resetModules();
    vi.doMock("../r2Client", () => ({ r2Client: null, isStorageEnabled: () => false }));
    const { uploadPdf } = await import("../pdfStorage");
    await expect(uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" }))
      .rejects.toThrow(/STOCKAGE_DESACTIVE/);
  });
});

describe("ce qui a disparu : `return null` sur échec de PUT", () => {
  it("PUT en échec ⇒ LÈVE (l'ancien chemin rendait null et la route servait en flux direct)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("R2 down"));
    const { mod, allouer } = await chargerAvec({ send });
    await expect(mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" }))
      .rejects.toThrow(/PUT_ECHOUE/);
    // La ligne INTENDED a bien été posée : l'échec est RÉCONCILIABLE.
    expect(allouer).toHaveBeenCalledOnce();
  });

  it("PUT à faux négatif — confirmation en échec : la clé reste CONNUE", async () => {
    // Le cas qui justifie tout l'ordre. Le PUT aboutit, la confirmation
    // échoue : la ligne reste INTENDED, l'objet existe, sa clé est celle qui
    // a été allouée. On ne retombe jamais dans « objet inconnu ».
    const confirmer = vi.fn().mockRejectedValue(
      new Error("[registre] REGISTRE_INDISPONIBLE: coupure après le PUT"));
    const { mod, send, allouer } = await chargerAvec({ confirmer });

    await expect(mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" }))
      .rejects.toThrow(/REGISTRE_INDISPONIBLE/);

    expect(send).toHaveBeenCalledOnce();
    const clePut = send.mock.calls[0][0].input.Key;
    const cleAllouee = allouer.mock.calls[0][0].cle;
    expect(clePut).toBe(cleAllouee);
  });
});

describe("uploadPdf — guard taille", () => {
  it("throw quand buffer > PDF_MAX_SIZE_BYTES, et n'alloue rien", async () => {
    process.env.PDF_MAX_SIZE_BYTES = "10";
    const { mod, allouer } = await chargerAvec({});
    await expect(mod.uploadPdf({ buffer: Buffer.alloc(100), subject: "test" }))
      .rejects.toThrow(/exceeds max size/);
    expect(allouer).not.toHaveBeenCalled();
  });
});

// ─── T3 — LE TÉMOIN DIFFÉRENTIEL DU GATE ─────────────────────────────────
//
// MÊME clé, MÊME primitive, quatre états de registre, quatre décisions.

describe("T3 — le gate de délivrance mord, et il mord nommément", () => {
  it("REGISTERED + NONE ⇒ délivrance autorisée", async () => {
    const { mod } = await chargerAvec({ lire: vi.fn().mockResolvedValue(ligne()) });
    const d = await mod.delivrerUrlSignee(CLE_GOUVERNEE);
    expect(d).toEqual({ autorisee: true, url: "https://signed.example/x" });
  });

  it("MÊME objet INVALIDÉ ⇒ refus, et le motif porte le caractère PROSPECTIF", async () => {
    const { mod } = await chargerAvec({
      lire: vi.fn().mockResolvedValue(ligne({ etatDInvalidation: "INVALID_AUTHORITY" })),
    });
    const d = await mod.delivrerUrlSignee(CLE_GOUVERNEE);
    expect(d.autorisee).toBe(false);
    if (d.autorisee) return;
    expect(d.raison).toBe("AUTORITE_INVALIDEE");
    expect(d.explication).toMatch(/does not revoke an already-issued signed URL/);
  });

  it("aucune ligne ⇒ refus (fail-closed), PAS un passage", async () => {
    const { mod } = await chargerAvec({ lire: vi.fn().mockResolvedValue(null) });
    const d = await mod.delivrerUrlSignee(CLE_GOUVERNEE);
    expect(d.autorisee).toBe(false);
    if (!d.autorisee) expect(d.raison).toBe("AUCUNE_LIGNE_DE_REGISTRE");
  });

  it("registre injoignable ⇒ refus — servir « en attendant » ferait de la panne une autorisation", async () => {
    const { mod } = await chargerAvec({
      lire: vi.fn().mockRejectedValue(new Error("[registre] TABLE_ABSENTE: pas de migration")),
    });
    const d = await mod.delivrerUrlSignee(CLE_GOUVERNEE);
    expect(d.autorisee).toBe(false);
    if (!d.autorisee) expect(d.raison).toBe("REGISTRE_INDISPONIBLE");
  });

  it("hors périmètre ⇒ PASSE, et COMPTE — la quatrième ligne du témoin", async () => {
    // C'est elle qui fait de ce témoin autre chose qu'une formalité : elle
    // mesure, à chaque exécution, la taille du trou qu'on a choisi de laisser
    // ouvert en phase 1.
    const lire = vi.fn();
    const { mod } = await chargerAvec({ lire });
    mod.reinitialiserCompteurPassages();

    const d = await mod.delivrerUrlSignee("pointers/GordonGekko/latest.pdf");
    expect(d.autorisee).toBe(true);
    expect(mod.compteurPassagesHorsPerimetre()).toBe(1);
    // Hors périmètre, le registre n'est même pas interrogé.
    expect(lire).not.toHaveBeenCalled();
  });
});

describe("getSignedDownloadUrl — la forme de compatibilité DÉLÈGUE", () => {
  it("un refus gouverné devient null chez l'appelant gelé", async () => {
    const { mod } = await chargerAvec({
      lire: vi.fn().mockResolvedValue(ligne({ etatDInvalidation: "WITHDRAWN_BY_DECISION" })),
    });
    expect(await mod.getSignedDownloadUrl(CLE_GOUVERNEE)).toBeNull();
  });

  it("le chemin `pointers/` de /api/pdf/[handle] continue d'être servi", async () => {
    const { mod } = await chargerAvec({});
    expect(await mod.getSignedDownloadUrl(mod.pointerLatestKey("GordonGekko")))
      .toBe("https://signed.example/x");
  });
});

describe("isStorageEnabled", () => {
  afterEach(() => { vi.resetModules(); delete process.env.PDF_STORAGE_ENABLED; });

  it("retourne false quand PDF_STORAGE_ENABLED est absent", async () => {
    delete process.env.PDF_STORAGE_ENABLED;
    vi.resetModules();
    const { isStorageEnabled } = await import("../r2Client");
    expect(isStorageEnabled()).toBe(false);
  });

  it("retourne false quand PDF_STORAGE_ENABLED=false", async () => {
    process.env.PDF_STORAGE_ENABLED = "false";
    vi.resetModules();
    const { isStorageEnabled } = await import("../r2Client");
    expect(isStorageEnabled()).toBe(false);
  });
});
