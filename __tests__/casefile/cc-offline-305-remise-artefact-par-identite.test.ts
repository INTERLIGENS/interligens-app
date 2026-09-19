// ─── CC-OFFLINE-305 — LA REMISE D'UN ARTEFACT GOUVERNÉ, PAR IDENTITÉ ──────
//
// ██  LA ROUTE N'AJOUTE AUCUNE AUTORITÉ. ELLE EN CONSOMME DEUX.            ██
//
// `GET /admin/artefacts/<registreId>` enchaîne des briques EXISTANTES :
//
//   isAdminSessionFromCookies() → lireParIdentifiant → deriverEligibilite
//     → GetObject → comparaison au sceau → relais des octets
//
// Ces témoins ne re-testent pas ce que `eligibilite.test.ts` tient déjà. Ils
// tiennent les propriétés de LA REMISE — celles qu'aucun critère existant ne
// couvre, parce qu'aucun ne connaît de route ni de relais d'octets.
//
// ─── LES DEUX SEULS MOCKS, ET POURQUOI ────────────────────────────────────
//
// `lireParIdentifiant` est la FRONTIÈRE DE BASE ; `r2Client` est la FRONTIÈRE
// RÉSEAU. Elles seules sont simulées. Tout le reste s'exécute POUR DE VRAI :
//
//   · le gate lit un vrai cookie, dont le jeton est calculé par le vrai HMAC ;
//   · `deriverEligibilite` rend son vrai verdict sur les cinq faces ;
//   · l'empreinte est recalculée par le vrai `crypto`, sur les vrais octets.
//
// Simuler l'éligibilité testerait le simulacre — et c'est précisément la faute
// que ce lot avait pour consigne de ne pas commettre.
//
// ─── LES LIGNES SONT CELLES DE LA PRODUCTION, RELUES DU REGISTRE ──────────
//
// Les deux lignes ci-dessous ne sont pas inventées : ce sont les valeurs
// EXACTES de `governed_objects`, relues le 2026-09-19 avant l'écriture de ce
// fichier. `332f5291…` est la SEULE ligne invalidée du registre réel — le
// témoin positif de l'autorité d'invalidation n'est donc pas un mutant, c'est
// une ligne que quelqu'un a réellement jugée.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { LigneDeRegistre } from "@/lib/storage/registre/contrat";

// ═══ L'ENVIRONNEMENT DU GATE ════════════════════════════════════════════════

const ADMIN_TOKEN = "admin-token-for-tests-not-a-real-secret";
const ADMIN_BASIC_PASS = "admin-pass-for-tests-not-a-real-secret";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.ADMIN_BASIC_PASS = ADMIN_BASIC_PASS;
process.env.PDF_STORAGE_ENABLED = "true";
process.env.R2_ACCOUNT_ID = "compte-de-test";
process.env.R2_ACCESS_KEY_ID = "cle-de-test";
process.env.R2_SECRET_ACCESS_KEY = "secret-de-test";
process.env.R2_BUCKET_NAME = "interligens-reports";

const JETON_VALIDE = createHmac("sha256", ADMIN_TOKEN).update(ADMIN_BASIC_PASS).digest("hex");
const COOKIE = "admin_session";

const cookiesDuHandler = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => {
      const v = cookiesDuHandler.get(nom);
      return v === undefined ? undefined : { name: nom, value: v };
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    investigatorSession: { findFirst: vi.fn(), update: () => ({ catch: () => {} }) },
    investigatorAuditLog: { create: vi.fn() },
  },
}));

// ── LA FRONTIÈRE DE BASE ──────────────────────────────────────────────────
const lireParIdentifiantMock = vi.fn<(id: string) => Promise<LigneDeRegistre | null>>();
vi.mock("@/lib/storage/registre/registre", async (original) => {
  const reel = await original<typeof import("@/lib/storage/registre/registre")>();
  return { ...reel, lireParIdentifiant: (id: string) => lireParIdentifiantMock(id) };
});

// ── LA FRONTIÈRE RÉSEAU ───────────────────────────────────────────────────
// Toutes les commandes envoyées sont ENREGISTRÉES : c'est ce qui permet de
// prouver qu'aucune écriture n'a lieu, plutôt que de l'affirmer.
const commandesEnvoyees: string[] = [];
let octetsDuCompartiment: Buffer = Buffer.alloc(0);
let lectureEchoue = false;

vi.mock("@/lib/storage/r2Client", () => ({
  isStorageEnabled: () => true,
  r2Client: {
    send: async (commande: unknown) => {
      const nom = (commande as { constructor: { name: string } }).constructor.name;
      commandesEnvoyees.push(nom);
      if (nom !== "GetObjectCommand") throw new Error(`commande inattendue: ${nom}`);
      if (lectureEchoue) throw new Error("compartiment injoignable");
      const corps = octetsDuCompartiment;
      return {
        Body: (async function* () {
          yield new Uint8Array(corps);
        })(),
      };
    },
  },
}));

// Aucune URL signée ne doit être fabriquée. Le presigner est instrumenté pour
// que la propriété J soit PROUVÉE, et pas seulement inspectée dans la réponse.
const signatures: string[] = [];
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async () => {
    signatures.push("appel");
    return "https://exemple.invalid/signee?X-Amz-Signature=jamais";
  },
}));

// ═══ LES LIGNES RÉELLES ═════════════════════════════════════════════════════

const FACES_COMMUNES = {
  natureObjet: "CASEFILE_RENDER",
  provenance: "GOVERNED_PIPELINE",
  classeDeRetention: "EVIDENTIARY_INDEFINITE",
  sujet: "IL-SHILL-VINE-001",
  lot: "casefile-governed",
  typeContenu: "application/pdf",
  producteur: "pdfStorage.uploadPdf",
  alloueLe: new Date("2026-09-17T08:12:11.657Z"),
  enregistreLe: new Date("2026-09-17T08:12:12.913Z"),
  invalideLe: null,
  motifInvalidation: null,
} as const;

/** `c689890f…` — REGISTERED / NONE. Relue du registre le 2026-09-19. */
const VINE_DELIVRABLE: LigneDeRegistre = {
  ...FACES_COMMUNES,
  id: "c689890f3fd34d7eb06b441c60bc58b3",
  bucket: "interligens-reports",
  cle: "reports/production/2026/09/c689890f3fd34d7eb06b441c60bc58b3.pdf",
  etatDAutorite: "REGISTERED",
  etatDInvalidation: "NONE",
  sha256: "83a9b9d85445bd899884303466ecccb078f2a7f14fc52a82bcb9fc69abece279",
  tailleOctets: 106794,
} as LigneDeRegistre;

/**
 * Des octets qui se comportent comme l'artefact : un vrai en-tête PDF, et une
 * ligne de registre dont le sceau est celui de CES octets. On ne fait PAS
 * entrer 106 794 octets dans le dépôt pour prouver une égalité.
 */
const OCTETS = Buffer.concat([
  Buffer.from("%PDF-1.7\n"),
  Buffer.from("octets d'artefact gouverné, témoin CC-OFFLINE-305\n"),
  Buffer.from("%%EOF\n"),
]);
const SCEAU = createHash("sha256").update(OCTETS).digest("hex");

const LIGNE_COHERENTE: LigneDeRegistre = {
  ...VINE_DELIVRABLE,
  sha256: SCEAU,
  tailleOctets: OCTETS.byteLength,
};

/**
 * `332f5291…` — REGISTERED / SUPERSEDED. LA SEULE LIGNE INVALIDÉE DU REGISTRE
 * RÉEL, jugée le 2026-09-17 sous l'autorité RC-ARTIFACT-CLOSURE-0 F1.
 *
 * ⚠️ SON IDENTITÉ, SON ÉTAT ET SON JUGEMENT SONT CEUX DE LA PRODUCTION. Son
 * SCEAU, lui, est celui des octets témoins — et c'est délibéré. Avec le sceau
 * réel (`a84efcf5…`, 68 413 o), le refus serait rendu par la comparaison
 * d'intégrité, PAS par le jugement : le témoin passerait pour une mauvaise
 * raison, et un mutant qui désarme l'éligibilité ne le ferait pas rougir. Le
 * mutant 3 l'a montré en vif. Avec ce sceau-ci, l'invalidation est la SEULE
 * cause possible de refus, et c'est bien elle qu'on mesure.
 */
const BOTIFY_SUPERSEDE: LigneDeRegistre = {
  ...FACES_COMMUNES,
  sujet: "IL-SHILL-BOTIFY-001",
  id: "332f529105d8455ca0db500362db22d1",
  bucket: "interligens-reports",
  cle: "reports/production/2026/09/332f529105d8455ca0db500362db22d1.pdf",
  etatDAutorite: "REGISTERED",
  etatDInvalidation: "SUPERSEDED",
  sha256: SCEAU,
  tailleOctets: OCTETS.byteLength,
  invalideLe: new Date("2026-09-17T08:26:54.199Z"),
  motifInvalidation:
    "SUPERSEDED_BY_CORRECTED_CANONICAL_RENDERING replacement=e91bd0fde8f1423fb60af3ebe1cfc9ba",
} as LigneDeRegistre;

async function GET(registreId: string) {
  const mod = await import("@/app/admin/artefacts/[registreId]/route");
  return mod.GET(new Request(`http://localhost/admin/artefacts/${registreId}`), {
    params: Promise.resolve({ registreId }),
  });
}

beforeEach(() => {
  cookiesDuHandler.clear();
  cookiesDuHandler.set(COOKIE, JETON_VALIDE);
  lireParIdentifiantMock.mockReset();
  commandesEnvoyees.length = 0;
  signatures.length = 0;
  octetsDuCompartiment = OCTETS;
  lectureEchoue = false;
});

// ═══════════════════════════════════════════════════════════════════════════
// A · B · C — LES OCTETS EXACTS, LEUR EMPREINTE, LEUR TAILLE
// ═══════════════════════════════════════════════════════════════════════════

describe("A/B/C — un artefact nommé rend SES octets, et ils sont vérifiés", () => {
  it("A — l'artefact nommé par identité rend les octets de CET artefact", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);

    const r = await GET(LIGNE_COHERENTE.id);
    expect(r.status).toBe(200);

    const rendus = Buffer.from(await r.arrayBuffer());
    expect(rendus.equals(OCTETS)).toBe(true);

    // L'identité DEMANDÉE est celle qui a servi à lire — sans ambiguïté.
    expect(lireParIdentifiantMock).toHaveBeenCalledExactlyOnceWith(LIGNE_COHERENTE.id);
    expect(commandesEnvoyees).toEqual(["GetObjectCommand"]);
  });

  it("B — le sha256 des octets remis est celui du sceau enregistré", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);

    const r = await GET(LIGNE_COHERENTE.id);
    const rendus = Buffer.from(await r.arrayBuffer());

    expect(createHash("sha256").update(rendus).digest("hex")).toBe(LIGNE_COHERENTE.sha256);
    // Et la réponse le DIT, pour qu'un auditeur n'ait pas à nous croire.
    expect(r.headers.get("X-Governed-Sha256")).toBe(LIGNE_COHERENTE.sha256);
  });

  it("C — la taille des octets remis est celle enregistrée", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);

    const r = await GET(LIGNE_COHERENTE.id);
    const rendus = Buffer.from(await r.arrayBuffer());

    expect(rendus.byteLength).toBe(LIGNE_COHERENTE.tailleOctets);
    expect(r.headers.get("Content-Length")).toBe(String(LIGNE_COHERENTE.tailleOctets));
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("des octets qui divergent du sceau sont REFUSÉS, pas servis", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);
    octetsDuCompartiment = Buffer.from("%PDF-1.7\naltéré\n%%EOF\n");

    const r = await GET(LIGNE_COHERENTE.id);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Not found");
  });

  it("un objet illisible ne devient pas une réponse vide de 200", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);
    lectureEchoue = true;

    expect((await GET(LIGNE_COHERENTE.id)).status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D — LE TÉMOIN POSITIF DE L'AUTORITÉ D'INVALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe("D — la seule ligne invalidée du registre réel est REFUSÉE", () => {
  it("332f5291… (REGISTERED/SUPERSEDED) est refusé", async () => {
    lireParIdentifiantMock.mockResolvedValue(BOTIFY_SUPERSEDE);

    const r = await GET(BOTIFY_SUPERSEDE.id);
    expect(r.status).toBe(404);
  });

  it("le refus tombe AVANT toute lecture du compartiment", async () => {
    lireParIdentifiantMock.mockResolvedValue(BOTIFY_SUPERSEDE);

    await GET(BOTIFY_SUPERSEDE.id);

    // ██ Un artefact dont l'autorité est retirée ne sort même pas du seau. ██
    expect(commandesEnvoyees).toEqual([]);
  });

  it("la MÊME ligne, invalidation levée, serait délivrable — c'est bien le jugement qui refuse", async () => {
    // Le contrôle qui empêche ce témoin d'être vrai pour une mauvaise raison :
    // si la ligne était refusée à cause de son sujet, de sa taille ou de sa
    // clé, ce cas-ci échouerait aussi.
    lireParIdentifiantMock.mockResolvedValue({
      ...BOTIFY_SUPERSEDE,
      etatDInvalidation: "NONE",
      invalideLe: null,
      motifInvalidation: null,
    } as LigneDeRegistre);

    expect((await GET(BOTIFY_SUPERSEDE.id)).status).toBe(200);
  });

  it("un artefact NON ENREGISTRÉ est refusé lui aussi", async () => {
    lireParIdentifiantMock.mockResolvedValue({
      ...LIGNE_COHERENTE,
      etatDAutorite: "INTENDED",
    } as LigneDeRegistre);

    expect((await GET(LIGNE_COHERENTE.id)).status).toBe(404);
    expect(commandesEnvoyees).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E · F · G — LE REFUS N'EST PAS UN ORACLE
// ═══════════════════════════════════════════════════════════════════════════

describe("E/F/G — trois causes, une seule réponse", () => {
  async function corpsEtEntetes(r: Response) {
    return {
      status: r.status,
      corps: await r.text(),
      type: r.headers.get("Content-Type"),
      cache: r.headers.get("Cache-Control"),
      location: r.headers.get("Location"),
    };
  }

  it("E — un registreId inexistant est refusé, fail-closed", async () => {
    lireParIdentifiantMock.mockResolvedValue(null);

    const r = await GET("00000000000000000000000000000000");
    expect(r.status).toBe(404);
    expect(commandesEnvoyees).toEqual([]);
  });

  it("F — un appel anonyme est refusé par le gate, sans toucher au registre", async () => {
    cookiesDuHandler.clear();

    const r = await GET(LIGNE_COHERENTE.id);
    expect(r.status).toBe(404);
    expect(lireParIdentifiantMock).not.toHaveBeenCalled();
    expect(commandesEnvoyees).toEqual([]);
  });

  it("G — un appel authentifié sur un artefact éligible réussit", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);
    expect((await GET(LIGNE_COHERENTE.id)).status).toBe(200);
  });

  it("anonyme · inexistant · invalidé rendent la MÊME réponse, octet pour octet", async () => {
    cookiesDuHandler.clear();
    const anonyme = await corpsEtEntetes(await GET(LIGNE_COHERENTE.id));

    cookiesDuHandler.set(COOKIE, JETON_VALIDE);
    lireParIdentifiantMock.mockResolvedValue(null);
    const inexistant = await corpsEtEntetes(await GET("00000000000000000000000000000000"));

    lireParIdentifiantMock.mockResolvedValue(BOTIFY_SUPERSEDE);
    const invalide = await corpsEtEntetes(await GET(BOTIFY_SUPERSEDE.id));

    // ██ Distinguer « il n'existe pas » de « il a été retiré » nommerait les ██
    // ██ artefacts supersédés — exactement ceux qu'un jugement a retirés.   ██
    expect(inexistant).toEqual(anonyme);
    expect(invalide).toEqual(anonyme);
  });

  it("un jeton de session invalide ne passe pas", async () => {
    cookiesDuHandler.set(COOKIE, "0".repeat(64));

    expect((await GET(LIGNE_COHERENTE.id)).status).toBe(404);
    expect(lireParIdentifiantMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H · I · J — CE QUE LA ROUTE NE FAIT JAMAIS
// ═══════════════════════════════════════════════════════════════════════════

describe("H/I/J — aucune écriture, aucune capacité qui sorte", () => {
  it("H/I — aucune commande d'écriture n'est jamais envoyée au compartiment", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);
    await GET(LIGNE_COHERENTE.id);
    await GET(LIGNE_COHERENTE.id);

    expect(commandesEnvoyees).toEqual(["GetObjectCommand", "GetObjectCommand"]);
    expect(commandesEnvoyees).not.toContain("PutObjectCommand");
    expect(commandesEnvoyees).not.toContain("DeleteObjectCommand");
  });

  it("H — la route n'importe AUCUN écrivain de registre ni producteur d'artefact", () => {
    const source = readFileSync("src/app/admin/artefacts/[registreId]/route.ts", "utf8");

    for (const ecrivain of [
      "allouer",
      "confirmerEnregistrement",
      "superseder",
      "produireArtefactGouverne",
      "uploadPdf",
      "renderGovernedCaseFilePdf",
      "renderGovernedCaseFileHtml",
    ]) {
      expect(source, `${ecrivain} n'a rien à faire dans une remise`).not.toContain(ecrivain);
    }
  });

  it("J — aucune URL signée n'est fabriquée, ni exposée", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);

    const r = await GET(LIGNE_COHERENTE.id);

    // ██ Une URL signée est une CAPACITÉ. Elle n'est même pas créée.        ██
    expect(signatures).toEqual([]);
    expect(r.status).toBe(200);
    expect(r.headers.get("Location")).toBeNull();

    const entetes = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    for (const marqueur of ["X-Amz-Signature", "X-Amz-Credential", "x-amz-", "Signature="]) {
      expect(entetes.toLowerCase()).not.toContain(marqueur.toLowerCase());
    }

    const corps = Buffer.from(await r.arrayBuffer()).toString("latin1");
    expect(corps).not.toContain("X-Amz-Signature");
    expect(corps).not.toContain("r2.cloudflarestorage.com");
  });

  it("J — un refus n'expose pas davantage : pas de redirection, pas d'en-tête distinctif", async () => {
    lireParIdentifiantMock.mockResolvedValue(BOTIFY_SUPERSEDE);

    const r = await GET(BOTIFY_SUPERSEDE.id);
    expect(r.headers.get("Location")).toBeNull();
    expect(signatures).toEqual([]);
    expect([...r.headers.keys()].sort()).toEqual(["cache-control", "content-type"]);
  });

  it("le relais ne met pas la réponse en cache, et ne s'indexe pas", async () => {
    lireParIdentifiantMock.mockResolvedValue(LIGNE_COHERENTE);

    const r = await GET(LIGNE_COHERENTE.id);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L — CE QUE LE LOT N'A PAS TOUCHÉ
// ═══════════════════════════════════════════════════════════════════════════

describe("L — le renderer et le producteur sont intouchés", () => {
  it("governedCaseFileRenderer.ts porte l'empreinte RATIFIÉE du lot courant", () => {
    // ─── CC-OFFLINE-306 · CE TÉMOIN EST MIS À JOUR DÉLIBÉRÉMENT ───────────
    //
    // ⛔ IL N'A PAS ÉTÉ SUPPRIMÉ PARCE QU'IL GÊNAIT. Il a rougi, c'était
    //    CORRECT, et la nouvelle valeur est inscrite en connaissance de cause.
    //
    //   AVANT  8a3af79e6f1d5d21cb4050b9b239eaf2beb5f32ae188a3757c3e5d2fd74cc85f  (14 161 o)
    //   APRÈS  d84fa35377c88c23c4e1aed302be0a0cbf313c27481f988d1473fc4d0e313faf  (17 142 o)
    //
    // Ce que la modification change, et ce qu'elle ne change PAS :
    //
    //   · les artefacts historiques scellés restent IMMUABLES dans R2 ;
    //   · leurs empreintes enregistrées ne bougent pas d'un bit ;
    //   · ils restent remettables par identité (c'est tout l'objet du lot 305) ;
    //   · UN FUTUR ARTEFACT PRODUIT AVEC CE RENDERER AURA D'AUTRES OCTETS.
    //
    // ██  ON NE DEMANDE PAS AU RENDERER COURANT DE REPRODUIRE BIT POUR BIT  ██
    // ██  UN ANCIEN ARTEFACT SCELLÉ. L'AUTORITÉ HISTORIQUE EST PORTÉE PAR   ██
    // ██  L'OBJET PERSISTÉ, LE REGISTRE ET LE SCEAU — PAS PAR LA CAPACITÉ   ██
    // ██  DU RENDERER FUTUR À REPRODUIRE SES OCTETS.                        ██
    //
    // Le témoin garde donc exactement sa fonction : rendre toute modification
    // du renderer VISIBLE et DÉLIBÉRÉE. Il ne la rend pas impossible.
    const source = readFileSync("src/lib/casefile/governedCaseFileRenderer.ts");
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      "d84fa35377c88c23c4e1aed302be0a0cbf313c27481f988d1473fc4d0e313faf",
    );
    expect(source.byteLength).toBe(17142);
  });

  it("la primitive de remise ne REDÉRIVE aucune règle d'éligibilité", () => {
    const source = readFileSync("src/lib/storage/pdfStorage.ts", "utf8");
    const remise = source.slice(source.indexOf("export async function remettreOctetsGouvernes"));

    // Elle APPELLE l'autorité — une fois, et c'est tout ce qu'elle fait d'elle.
    expect(remise).toContain("deriverEligibilite(ligne)");

    // ██ Recopier une condition ferait une SECONDE autorité. Deux autorités ██
    // ██ divergent — c'est l'Invariant Propagation Failure.                 ██
    for (const condition of [
      'etatDInvalidation !== "NONE"',
      'etatDAutorite !== "REGISTERED"',
      "estEtatDInvalidation",
      "estEtatDAutorite",
    ]) {
      expect(remise, `${condition} est une règle d'éligibilité recopiée`).not.toContain(condition);
    }
  });

  it("la primitive de signature d'URL n'est pas modifiée par ce lot", () => {
    const source = readFileSync("src/lib/storage/pdfStorage.ts", "utf8");
    // `delivrerUrlSignee` garde ses 27 témoins ; ce lot ne la touche pas, et
    // ses propres tests le prouvent en restant verts.
    expect(source).toContain("export async function delivrerUrlSignee(cle: string): Promise<Delivrance>");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA SURFACE EST DÉCLARÉE
// ═══════════════════════════════════════════════════════════════════════════

describe("la surface est au registre des surfaces", () => {
  it("elle y est, avec son autorité honnêtement renseignée", async () => {
    const { CASEFILE_SURFACES } = await import("@/lib/casefile/surfaceRegistry");
    const entree = CASEFILE_SURFACES.find(
      (s) => s.file === "src/app/admin/artefacts/[registreId]/route.ts",
    );

    expect(entree, "surface non déclarée — la garde P3 doit la refuser").toBeDefined();
    expect(entree!.public).toBe(false);
    expect(entree!.route).toBe("/admin/artefacts/[registreId]");
  });

  it("elle ne nomme AUCUN sujet, AUCUN « dernier », AUCUN tri", () => {
    const source = readFileSync("src/app/admin/artefacts/[registreId]/route.ts", "utf8");
    const code = source
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");

    // ██ Choisir « le dernier » fabriquerait l'autorité canonical que ce    ██
    // ██ dépôt s'est refusé à inventer. L'appelant NOMME, ou n'obtient rien.██
    for (const interdit of [
      "listerLignes",
      "orderBy",
      "ORDER BY",
      "registered_at",
      "enregistreLe",
      "sujet",
      "subject",
      "latest",
      "sort(",
    ]) {
      expect(code, `${interdit} ouvrirait une sélection`).not.toContain(interdit);
    }
  });
});
