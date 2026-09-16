// src/lib/storage/__tests__/pdfStorage.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { Readable } from "node:stream";
import crypto from "node:crypto";
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

// ─── LE DOUBLE DE COMPARTIMENT ───────────────────────────────────────────
//
// Un `send` qui rendrait `{}` à tout ne pourrait pas distinguer un magasin
// sain d'un magasin qui ment : il ne GARDE rien. Celui-ci garde les octets du
// PUT et les rend au GET — c'est le minimum pour que les mutants B et D aient
// un sens, parce qu'eux font DIVERGER ce qui est rendu de ce qui a été écrit.

interface CommandeS3 {
  readonly input: {
    Bucket?: string;
    Key?: string;
    Body?: Buffer;
    Metadata?: Record<string, string>;
  };
}

interface OptionsMagasin {
  /** Altère les octets RENDUS par le GET, sans toucher à ceux du PUT. */
  alterer?: (octets: Buffer) => Buffer;
  /** Le GET lève. */
  getEchoue?: boolean;
  /** Le GET rend une réponse sans corps. */
  corpsAbsent?: boolean;
  /** Le PUT rend 200 et ne garde rien — le faux positif d'écriture. */
  perdreApresPut?: boolean;
  trace?: string[];
}

function magasinR2(o: OptionsMagasin = {}) {
  const objets = new Map<string, Buffer>();
  const gets: CommandeS3["input"][] = [];
  const send = vi.fn(async (cmd: CommandeS3) => {
    const cle = cmd.input.Key ?? "";
    if (cmd.input.Body !== undefined) {
      o.trace?.push("put");
      if (!o.perdreApresPut) objets.set(cle, Buffer.from(cmd.input.Body));
      return {};
    }
    o.trace?.push("relecture");
    gets.push(cmd.input);
    if (o.getEchoue) throw new Error("R2 GET 500 InternalError");
    if (o.corpsAbsent) return {};
    const brut = objets.get(cle);
    if (brut === undefined) throw new Error(`NoSuchKey: ${cle}`);
    return { Body: Readable.from([o.alterer ? o.alterer(brut) : brut]) };
  });
  return { send, objets, gets };
}

const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

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

  const send = d.send ?? magasinR2().send;
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
  it("alloue AVANT d'écrire, relit APRÈS avoir écrit, confirme EN DERNIER", async () => {
    const ordre: string[] = [];
    const allouer = vi.fn(async (e: { cle: string; identifiant: string }) => {
      ordre.push("allocation");
      return ligne({ cle: e.cle, id: e.identifiant, etatDAutorite: "INTENDED" });
    });
    const { send } = magasinR2({ trace: ordre });
    const confirmer = vi.fn(async () => { ordre.push("confirmation"); });

    const { mod } = await chargerAvec({ allouer, send, confirmer });
    const r = await mod.uploadPdf({ buffer: Buffer.from("pdf"), subject: "abc" });

    // L'ORDRE NOMINAL. `relecture` est AVANT `confirmation` : c'est toute la
    // question — REGISTERED n'est plus atteignable sans avoir touché les
    // octets persistés.
    expect(ordre).toEqual(["allocation", "put", "relecture", "confirmation"]);
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

    // PUT puis relecture : la confirmation échoue APRÈS que l'intégrité a été
    // établie. C'est bien l'écriture DB #2 qui manque, rien d'autre.
    expect(send.mock.calls.map((c) => c[0].constructor.name))
      .toEqual(["PutObjectCommand", "GetObjectCommand"]);
    const clePut = send.mock.calls[0][0].input.Key;
    const cleAllouee = allouer.mock.calls[0][0].cle;
    expect(clePut).toBe(cleAllouee);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CC-OFFLINE-248 — LA RELECTURE DES OCTETS PERSISTÉS
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  UNE EMPREINTE CALCULÉE PAR L'ÉCRIVAIN N'EST PAS UNE VÉRIFICATION     ██
// ██  DE L'ÉCRIT.                                                          ██
//
// Avant ce lot, `REGISTERED` affirmait « on a voulu écrire ceci ». Les cinq
// mutants ci-dessous tiennent qu'il affirme désormais « ceci EST écrit ».

const OCTETS = Buffer.from("%PDF-1.4 des octets gouvernés");

describe("A · MUTANT — corps persisté CONFORME ⇒ confirmation AUTORISÉE", () => {
  it("relit l'objet, recalcule, concorde, et SEULEMENT ALORS confirme", async () => {
    const { send, gets, objets } = magasinR2();
    const { mod, confirmer, allouer } = await chargerAvec({ send });

    const r = await mod.uploadPdf({ buffer: OCTETS, subject: "abc" });

    expect(confirmer).toHaveBeenCalledOnce();
    expect(r.sha256).toBe(sha(OCTETS));
    expect(r.sizeBytes).toBe(OCTETS.byteLength);
    // Le GET a visé EXACTEMENT l'objet alloué — même compartiment, même clé.
    const cleAllouee = allouer.mock.calls[0][0].cle;
    expect(gets).toHaveLength(1);
    expect(gets[0]).toEqual({ Bucket: "test-bucket", Key: cleAllouee });
    // Et l'objet relu est bien celui que le PUT a écrit.
    expect(objets.get(cleAllouee)).toEqual(OCTETS);
  });
});

describe("B · MUTANT — corps persisté ALTÉRÉ ⇒ REFUSÉ", () => {
  it("empreinte divergente : pas de confirmation, et l'objet n'est PAS supprimé", async () => {
    const { send, objets } = magasinR2({
      alterer: (b) => Buffer.concat([b.subarray(0, b.length - 1), Buffer.from("X")]),
    });
    const { mod, confirmer } = await chargerAvec({ send });

    await expect(mod.uploadPdf({ buffer: OCTETS, subject: "abc" }))
      .rejects.toThrow(/empreinte des octets persistés divergente/);

    // FAIL CLOSED : REGISTERED n'est jamais atteint.
    expect(confirmer).not.toHaveBeenCalled();
    // ⛔ L'objet RESTE. Le supprimer masquerait l'écart : un état incomplet
    //    doit rester détectable par le lifecycle existant.
    expect(objets.size).toBe(1);
    const commandes = send.mock.calls.map((c) => c[0].constructor.name);
    expect(commandes).not.toContain("DeleteObjectCommand");
  });

  it("l'étape nommée est EMPREINTE_PERSISTEE, et la clé reste CONNUE", async () => {
    const { send } = magasinR2({ alterer: (b) => Buffer.concat([b, Buffer.from("!")]) });
    const { mod, allouer } = await chargerAvec({ send });
    const { ErreurStockageGouverne } = mod;

    const err = await mod.uploadPdf({ buffer: OCTETS, subject: "abc" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurStockageGouverne);
    if (!(err instanceof ErreurStockageGouverne)) return;
    expect(err.etape).toBe("EMPREINTE_PERSISTEE");
    // L'objet EXISTE et sa clé est celle qui a été allouée : réconciliable.
    expect(err.code).toBe("CONFIRMATION_ECHOUEE");
    expect(err.cle).toBe(allouer.mock.calls[0][0].cle);
  });

  it("une taille divergente est refusée AUSSI, et la divergence est chiffrée", async () => {
    const { send } = magasinR2({ alterer: (b) => b.subarray(0, 3) });
    const { mod } = await chargerAvec({ send });
    await expect(mod.uploadPdf({ buffer: OCTETS, subject: "abc" }))
      .rejects.toThrow(new RegExp(`${OCTETS.byteLength} o attendus, 3 o relus`));
  });
});

describe("C · MUTANT — le GET échoue ⇒ REFUSÉ", () => {
  it("relecture impossible : l'intégrité n'est pas établie, donc rien n'est confirmé", async () => {
    const { send } = magasinR2({ getEchoue: true });
    const { mod, confirmer } = await chargerAvec({ send });

    await expect(mod.uploadPdf({ buffer: OCTETS, subject: "abc" }))
      .rejects.toThrow(/relecture de l'objet persisté impossible/);
    expect(confirmer).not.toHaveBeenCalled();
  });

  it("un corps ABSENT n'est pas un corps vide : c'est un refus, pas un hash de rien", async () => {
    // Le piège : `Buffer.concat([])` vaut un buffer vide, dont le sha256 est
    // parfaitement calculable. Le comparer produirait une divergence — donc
    // le bon verdict, par le mauvais chemin. L'absence de corps est nommée.
    const { send } = magasinR2({ corpsAbsent: true });
    const { mod, confirmer } = await chargerAvec({ send });
    const { ErreurStockageGouverne } = mod;

    const err = await mod.uploadPdf({ buffer: OCTETS, subject: "abc" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurStockageGouverne);
    if (!(err instanceof ErreurStockageGouverne)) return;
    expect(err.etape).toBe("RELECTURE_PERSISTEE");
    expect(err.message).toMatch(/corps de réponse absent/);
    expect(confirmer).not.toHaveBeenCalled();
  });
});

// ═══ LE MUTANT ESSENTIEL ═══════════════════════════════════════════════════

describe("D · MUTANT ESSENTIEL — Metadata.sha256 CORRECTE mais corps ALTÉRÉ ⇒ REFUSÉ", () => {
  it("la métadonnée corrobore, elle ne fait PAS autorité sur le corps", async () => {
    // Le cas que l'ancienne chaîne ne pouvait pas voir : la métadonnée et la
    // ligne de registre portent la MÊME empreinte, juste — elles viennent du
    // même buffer — pendant que les octets persistés, eux, ont bougé.
    // Comparer ces deux déclarations du même écrivain aurait rendu CONFORME.
    const { send, objets } = magasinR2({
      alterer: () => Buffer.from("des octets qui ne sont PAS ceux qu'on a écrits"),
    });
    const { mod, confirmer } = await chargerAvec({ send });

    const erreur = await mod.uploadPdf({ buffer: OCTETS, subject: "abc" }).catch((e: unknown) => e);

    // 1. La métadonnée EST correcte — c'est la prémisse du mutant.
    const metadata = send.mock.calls[0][0].input.Metadata as Record<string, string>;
    expect(metadata.sha256).toBe(sha(OCTETS));
    // 2. Les octets réellement persistés le sont aussi — le magasin n'a pas
    //    menti au PUT, il ment à la RELECTURE : c'est le corps qui diverge.
    expect(erreur).toBeInstanceOf(Error);
    expect((erreur as Error).message).toMatch(/empreinte des octets persistés divergente/);
    // 3. Et rien n'est enregistré.
    expect(confirmer).not.toHaveBeenCalled();
    expect(objets.size).toBe(1);
  });
});

describe("E · MUTANT CAUSAL — retirer le GET réel rend ces témoins ROUGES", () => {
  it("le GET est envoyé au client R2, pas remplacé par un HeadObject", async () => {
    const { send } = magasinR2();
    const { mod } = await chargerAvec({ send });
    await mod.uploadPdf({ buffer: OCTETS, subject: "abc" });

    const commandes = send.mock.calls.map((c) => c[0].constructor.name);
    expect(commandes).toEqual(["PutObjectCommand", "GetObjectCommand"]);
    // Un HeadObject ne fait pas sortir un octet — donc il ne peut rien hasher.
    expect(commandes).not.toContain("HeadObjectCommand");
  });

  it("aucun repli d'identité : ni autre compartiment, ni clé reconstruite", async () => {
    const { send, gets } = magasinR2();
    const { mod, allouer } = await chargerAvec({ send });
    await mod.uploadPdf({ buffer: OCTETS, subject: "MINT-SECRET", batchId: "casefile" });

    const put = send.mock.calls[0][0].input;
    expect(gets[0]?.Bucket).toBe(put.Bucket);
    expect(gets[0]?.Key).toBe(put.Key);
    expect(gets[0]?.Key).toBe(allouer.mock.calls[0][0].cle);
  });

  it("un PUT à faux positif — R2 rend 200 sans rien garder — n'est PLUS confirmable", async () => {
    // LE CONTRE-FACTUEL DIRECT. Avant ce lot, ce cas produisait un artefact
    // « REGISTERED » et une URL signée vers un objet qui n'existe pas : le PUT
    // avait rendu 200, et rien n'allait vérifier. La relecture le voit.
    const { send, objets } = magasinR2({ perdreApresPut: true });
    const { mod, confirmer } = await chargerAvec({ send });

    await expect(mod.uploadPdf({ buffer: OCTETS, subject: "abc" }))
      .rejects.toThrow(/relecture de l'objet persisté impossible.*NoSuchKey/s);
    expect(confirmer).not.toHaveBeenCalled();
    expect(objets.size).toBe(0);
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
