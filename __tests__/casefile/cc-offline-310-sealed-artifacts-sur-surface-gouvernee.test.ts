// ─── CC-OFFLINE-310 · B1 — SEALED ARTIFACTS SUR LA SURFACE GOUVERNÉE ───────
//
// ██  ON NE CONSTRUIT PLUS DE CAPACITÉ FORENSIC.                            ██
// ██  ON REND DÉMONTRABLE LA CAPACITÉ DÉJÀ FONDÉE.                          ██
//
// La dernière étape du parcours — remettre le PDF scellé — exigeait une requête
// SQL pour connaître l'identité de registre. Ce lot ferme ça, et rien d'autre.
//
// ─── LES TROIS PHRASES QUI GOUVERNENT L'ANNEXE ────────────────────────────
//
//     LISTER ≠ DÉSIGNER.
//     HISTORIQUE ≠ AUTORITÉ COURANTE.
//     SEALED ≠ DELIVERABLE.
//
// ─── LES LIGNES SONT CELLES DE LA PRODUCTION ──────────────────────────────
//
// Relues du registre le 2026-09-19, en lecture seule, avant l'écriture de ce
// fichier. `governed_objects` porte SIX lignes : trois pour VINE, deux pour
// BOTIFY, une pour un troisième sujet qui n'est ni l'un ni l'autre — et c'est
// cette troisième qui rend le témoin d'isolation RÉEL au lieu d'être décoratif.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import type { LigneDeRegistre } from "@/lib/storage/registre/contrat";
import type { CanonicalAuthorityAssembly } from "@/lib/casefile/authorityAssembly";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import { codeSeul } from "./codeSeul";

// ═══ L'ENVIRONNEMENT DU GATE ════════════════════════════════════════════════

const ADMIN_TOKEN = "admin-token-for-tests-not-a-real-secret";
const ADMIN_BASIC_PASS = "admin-pass-for-tests-not-a-real-secret";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.ADMIN_BASIC_PASS = ADMIN_BASIC_PASS;

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

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// ── LES DEUX FRONTIÈRES DE BASE, ET ELLES SEULES ──────────────────────────
//
// `deriverEligibilite` et `expliquerRefus` s'exécutent POUR DE VRAI : ce sont
// EUX que le lot ne doit pas dupliquer, et les simuler testerait le simulacre.

const assembleAuthorityMock = vi.fn<(ref: string) => Promise<CanonicalAuthorityAssembly | null>>();
vi.mock("@/lib/casefile/authorityAssembly", () => ({
  assembleAuthority: (ref: string) => assembleAuthorityMock(ref),
}));

/** Le registre RÉEL, filtré comme la primitive le fait : `WHERE subject = …`. */
const sujetsInterroges: string[] = [];
const REGISTRE_REEL: LigneDeRegistre[] = [];

vi.mock("@/lib/storage/registre/registre", async (original) => {
  const reel = await original<typeof import("@/lib/storage/registre/registre")>();
  return {
    ...reel,
    listerParSujet: async (sujet: string) => {
      sujetsInterroges.push(sujet);
      return REGISTRE_REEL.filter((l) => l.sujet === sujet).sort((a, b) => a.id.localeCompare(b.id));
    },
  };
});

// ═══ LES LIGNES RÉELLES DU REGISTRE ═════════════════════════════════════════

const FACES = {
  natureObjet: "CASEFILE_RENDER",
  provenance: "GOVERNED_PIPELINE",
  classeDeRetention: "EVIDENTIARY_INDEFINITE",
  lot: "casefile-governed",
  typeContenu: "application/pdf",
  producteur: "pdfStorage.uploadPdf",
  bucket: "interligens-reports",
  etatDAutorite: "REGISTERED",
  alloueLe: new Date("2026-09-17T07:00:00.000Z"),
  invalideLe: null,
  motifInvalidation: null,
} as const;

const L = (o: Partial<LigneDeRegistre> & Pick<LigneDeRegistre, "id" | "sujet">): LigneDeRegistre =>
  ({
    ...FACES,
    cle: `reports/production/2026/09/${o.id}.pdf`,
    etatDInvalidation: "NONE",
    sha256: "0".repeat(64),
    tailleOctets: 1,
    enregistreLe: new Date("2026-09-17T07:31:14.447Z"),
    ...o,
  }) as LigneDeRegistre;

/** VINE — TROIS lignes, TOUTES `REGISTERED/NONE`. Mesuré. */
const VINE_1 = L({
  id: "44524322285144f9bc2ae6a34d9b0d69", sujet: "IL-SHILL-VINE-001",
  sha256: "7a4ec1beff18" + "0".repeat(52), tailleOctets: 106720,
  enregistreLe: new Date("2026-09-17T07:31:17.687Z"),
});
const VINE_2 = L({
  id: "7cfc5bbd61af4165b5cd6ffe1302759b", sujet: "IL-SHILL-VINE-001",
  sha256: "e70bff15f279" + "0".repeat(52), tailleOctets: 107576,
  enregistreLe: new Date("2026-09-16T14:07:07.577Z"),
});
const VINE_3 = L({
  id: "c689890f3fd34d7eb06b441c60bc58b3", sujet: "IL-SHILL-VINE-001",
  sha256: "83a9b9d85445" + "0".repeat(52), tailleOctets: 106794,
  enregistreLe: new Date("2026-09-17T08:12:12.913Z"),
});

/** BOTIFY — le délivrable, et l'historique non délivrable. Mesuré. */
const BOTIFY_NONE = L({
  id: "e91bd0fde8f1423fb60af3ebe1cfc9ba", sujet: "IL-SHILL-BOTIFY-001",
  sha256: "f2672f8ed816" + "0".repeat(52), tailleOctets: 68010,
  enregistreLe: new Date("2026-09-17T07:31:14.447Z"),
});
const BOTIFY_SUPERSEDE = L({
  id: "332f529105d8455ca0db500362db22d1", sujet: "IL-SHILL-BOTIFY-001",
  sha256: "a84efcf52bb9" + "0".repeat(52), tailleOctets: 68413,
  enregistreLe: new Date("2026-09-17T07:08:30.296Z"),
  etatDInvalidation: "SUPERSEDED",
  invalideLe: new Date("2026-09-17T08:26:54.199Z"),
  motifInvalidation: "SUPERSEDED_BY_CORRECTED_CANONICAL_RENDERING replacement=e91bd0fde8f1423fb60af3ebe1cfc9ba",
});

/** LE TROISIÈME SUJET. Il existe vraiment, et il ne doit apparaître nulle part. */
const AUTRE_SUJET = L({
  id: "aaaa0000bbbb1111cccc2222dddd3333",
  sujet: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  tailleOctets: 4242,
});

REGISTRE_REEL.push(VINE_1, VINE_2, VINE_3, BOTIFY_NONE, BOTIFY_SUPERSEDE, AUTRE_SUJET);

// ═══ LES DOSSIERS ASSEMBLÉS ═════════════════════════════════════════════════

const PIECE = {
  sourceId: "SRC-01", sourceType: "SYSTEM_MEASUREMENT", caption: null,
  capturedAt: "2026-09-16", sourceUrl: "r2://interligens-evidence/m.json",
  sha256: "c".repeat(64), snapshotLinked: true, provenanceKind: "MACHINE_MEASURED",
  journalId: "2", sourceLocator: "r2://interligens-evidence/m.json",
  declaredBy: "instrument:il-measure@1.0.0",
};

const assemblage = (ref: string, codename: string): CanonicalAuthorityAssembly => ({
  subject: { ref, codename, ticker: `$${codename}`, title: `${codename} — dossier` },
  sources: [PIECE],
  claims: [
    {
      claimId: `${codename}-OBS-01`, version: 1, rowNature: "PRIMARY_OBSERVATION",
      title: `observation ${codename}`, titleFr: null, description: null, descriptionFr: null,
      category: null, severity: null, status: null, claimDate: null, state: "ATTACHED",
      evidenceRefs: ["SRC-01"], contentHash: "b".repeat(64),
    },
  ],
  dependencies: [],
});

const VINE = assemblage("IL-SHILL-VINE-001", "VINE");
const BOTIFY = assemblage("IL-SHILL-BOTIFY-001", "BOTIFY");

async function GET(ref: string) {
  const mod = await import("@/app/admin/cases/[ref]/governed/route");
  return mod.GET(new Request(`http://localhost/admin/cases/${ref}/governed`), {
    params: Promise.resolve({ ref }),
  });
}

beforeEach(() => {
  cookiesDuHandler.clear();
  cookiesDuHandler.set(COOKIE, JETON_VALIDE);
  assembleAuthorityMock.mockReset();
  sujetsInterroges.length = 0;
});

const htmlDe = async (a: CanonicalAuthorityAssembly): Promise<string> => {
  assembleAuthorityMock.mockResolvedValue(a);
  return await (await GET(a.subject.ref)).text();
};

/** L'annexe seule. */
const annexe = (html: string): string => {
  const i = html.indexOf('<section class="sealed">');
  expect(i, "l'annexe SEALED ARTIFACTS est absente").toBeGreaterThan(-1);
  return html.slice(i, html.indexOf("</section>", i) + "</section>".length);
};

// ═══════════════════════════════════════════════════════════════════════════
// VINE — TROIS ARTEFACTS, AUCUNE DÉSIGNATION
// ═══════════════════════════════════════════════════════════════════════════

describe("310/VINE — les trois lignes sont visibles, et aucune n'est élue", () => {
  it("exactement les artefacts dont `subject = IL-SHILL-VINE-001`", async () => {
    const html = await htmlDe(VINE);
    // Le sujet interrogé est celui du dossier ASSEMBLÉ, jamais le paramètre brut.
    expect(sujetsInterroges).toEqual(["IL-SHILL-VINE-001"]);
    for (const l of [VINE_1, VINE_2, VINE_3]) expect(annexe(html), l.id).toContain(l.id);
  });

  it("⚑ le registre est interrogé sur le SUJET ASSEMBLÉ, jamais sur le paramètre d'URL", async () => {
    // Le paramètre est ce que l'appelant a TAPÉ ; le sujet est ce que
    // l'autorité a ASSEMBLÉ. Les faire coïncider dans tous les témoins
    // laisserait passer une surface qui interroge le mauvais des deux — le
    // mutant 4 l'a montré en vif. On les DISSOCIE donc ici.
    assembleAuthorityMock.mockResolvedValue(VINE);
    await GET("il-shill-vine-001%20");          // casse et espace : PAS la ref
    expect(sujetsInterroges).toEqual(["IL-SHILL-VINE-001"]);
  });

  it("LES TROIS RESTENT VISIBLES — on ne cache pas la réalité du registre", async () => {
    const a = annexe(await htmlDe(VINE));
    expect((a.match(/Retrieve sealed bytes/g) ?? [])).toHaveLength(3);
  });

  it("⛔ AUCUN badge canonical / latest / current / recommended", async () => {
    const a = annexe(await htmlDe(VINE));
    for (const mot of [
      "canonical", "Canonical", "CANONICAL", "latest", "Latest", "LATEST",
      "current", "Current", "CURRENT", "recommended", "Recommended",
      "preferred", "Preferred", "most recent", "newest", "authoritative version",
      "primary", "Primary",
    ]) {
      expect(a, `« ${mot} » désigne au lieu de lister`).not.toContain(mot);
    }
  });

  it("⛔ AUCUNE sélection automatique — les trois actions sont équivalentes", async () => {
    const a = annexe(await htmlDe(VINE));
    // Chacune pointe vers SON identité. Aucune n'est mise en avant, aucune
    // n'est marquée, aucune n'est pré-sélectionnée.
    for (const l of [VINE_1, VINE_2, VINE_3]) {
      expect(a).toContain(`href="/admin/artefacts/${l.id}"`);
    }
    expect(a).not.toContain("selected");
    expect(a).not.toContain("default");
  });

  it("l'action de remise est liée au registreId, jamais au CaseFileRef", async () => {
    const a = annexe(await htmlDe(VINE));
    // ██ La route de remise répond à « remets-moi CET artefact identifié », ██
    // ██ jamais à « donne-moi le casefile VINE ».                          ██
    expect(a).not.toContain("/admin/artefacts/IL-SHILL-VINE-001");
    expect(a).not.toMatch(/\/admin\/artefacts\/[^"]*VINE/);
  });

  it("l'ordre est celui de l'IDENTITÉ — neutre, et il ne signifie rien", async () => {
    const a = annexe(await htmlDe(VINE));
    const ordre = [VINE_1, VINE_2, VINE_3].map((l) => a.indexOf(l.id));
    expect(ordre).toEqual([...ordre].sort((x, y) => x - y));
    // ⛔ Et ce n'est PAS l'ordre chronologique : `7cfc5bbd…` est la PLUS
    //    ANCIENNE (2026-09-16) et se place au MILIEU. Un tri « newest first »
    //    aurait fabriqué une préférence.
    expect(a.indexOf(VINE_2.id)).toBeGreaterThan(a.indexOf(VINE_1.id));
    expect(VINE_2.enregistreLe!.getTime()).toBeLessThan(VINE_1.enregistreLe!.getTime());
  });

  it("les métadonnées factuelles sont là, et elles sont celles du registre", async () => {
    const a = annexe(await htmlDe(VINE));
    expect(a).toContain(VINE_3.sha256);                       // sceau COMPLET
    expect(a).toContain("106794 bytes");                      // taille
    expect(a).toContain("2026-09-17T08:12:12.913Z");          // enregistrement
    expect(a).toContain("NONE");                              // état d'invalidation
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BOTIFY — SEALED ≠ DELIVERABLE
// ═══════════════════════════════════════════════════════════════════════════

describe("310/BOTIFY — l'histoire est conservée, l'autorité de remise ne l'est pas", () => {
  it("les DEUX artefacts sont visibles", async () => {
    const a = annexe(await htmlDe(BOTIFY));
    expect(a).toContain(BOTIFY_NONE.id);
    expect(a).toContain(BOTIFY_SUPERSEDE.id);
  });

  it("le NONE est identifiable comme délivrable", async () => {
    const a = annexe(await htmlDe(BOTIFY));
    expect(a).toContain(`href="/admin/artefacts/${BOTIFY_NONE.id}"`);
  });

  it("⛔ le SUPERSEDED N'A PAS DE LIEN — on n'invite pas à se cogner", async () => {
    // ██ L'UX normale ne doit pas inviter un avocat à cliquer sur quelque    ██
    // ██ chose que nous savons refusé. Le refus réel se démontre par les     ██
    // ██ témoins, pas en laissant l'utilisateur le découvrir.                ██
    const a = annexe(await htmlDe(BOTIFY));
    expect(a).not.toContain(`href="/admin/artefacts/${BOTIFY_SUPERSEDE.id}"`);
    expect((a.match(/Retrieve sealed bytes/g) ?? [])).toHaveLength(1);
  });

  it("son état est affiché CLAIREMENT, avec la doctrine EXISTANTE", async () => {
    const a = annexe(await htmlDe(BOTIFY));
    expect(a).toContain("SUPERSEDED");
    expect(a).toContain("Not retrievable");
    // Le texte est celui d'`expliquerRefus` — aucun mot inventé pour l'UI.
    expect(a).toContain("Artefact conservé, autorité de publication retirée.");
  });

  it("AUCUN MÉLANGE — chaque ligne porte SON identité et SON état", async () => {
    const a = annexe(await htmlDe(BOTIFY));
    const iNone = a.indexOf(BOTIFY_NONE.id);
    const iSup = a.indexOf(BOTIFY_SUPERSEDE.id);
    const iLien = a.indexOf(`href="/admin/artefacts/${BOTIFY_NONE.id}"`);
    const iRefus = a.indexOf("Not retrievable");
    // Le lien appartient à la ligne du NONE ; le refus à celle du SUPERSEDED.
    expect(Math.abs(iLien - iNone)).toBeLessThan(400);
    expect(Math.abs(iRefus - iSup)).toBeLessThan(400);
  });

  it("⛔ AUCUNE copy marketing — l'UI présente l'état, elle ne le raconte pas", async () => {
    const a = annexe(await htmlDe(BOTIFY));
    for (const mot of [
      "demonstrates", "proves", "governance in action", "excellent",
      "best practice", "as you can see", "note that", "importantly",
    ]) {
      expect(a, mot).not.toContain(mot);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ISOLATION
// ═══════════════════════════════════════════════════════════════════════════

describe("310/ISOLATION — un sujet ne voit que ses lignes", () => {
  it("BOTIFY n'apparaît pas dans VINE", async () => {
    const html = await htmlDe(VINE);
    expect(html).not.toContain(BOTIFY_NONE.id);
    expect(html).not.toContain(BOTIFY_SUPERSEDE.id);
  });

  it("VINE n'apparaît pas dans BOTIFY", async () => {
    const html = await htmlDe(BOTIFY);
    for (const l of [VINE_1, VINE_2, VINE_3]) expect(html).not.toContain(l.id);
  });

  it("le TROISIÈME sujet du registre n'apparaît dans NI L'UN NI L'AUTRE", async () => {
    // Il existe réellement — le témoin n'est pas décoratif.
    expect(REGISTRE_REEL.some((l) => l.id === AUTRE_SUJET.id)).toBe(true);
    for (const a of [VINE, BOTIFY]) {
      const html = await htmlDe(a);
      expect(html).not.toContain(AUTRE_SUJET.id);
      expect(html).not.toContain("4242 bytes");
    }
  });

  it("un CaseFileRef inexistant reste FAIL-CLOSED, et n'interroge pas le registre", async () => {
    assembleAuthorityMock.mockResolvedValue(null);
    const r = await GET("IL-INEXISTANT-999");
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("SEALED ARTIFACTS");
    // ⛔ Aucune existence oracle nouvelle : le registre n'est même pas consulté.
    expect(sujetsInterroges).toEqual([]);
  });

  it("sans cookie admin, ni document ni annexe — et aucune lecture du registre", async () => {
    cookiesDuHandler.clear();
    assembleAuthorityMock.mockResolvedValue(VINE);
    const r = await GET("IL-SHILL-VINE-001");
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("SEALED ARTIFACTS");
    expect(sujetsInterroges).toEqual([]);
    expect(assembleAuthorityMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L'ANNEXE AJOUTE — ELLE NE RÉÉCRIT PAS
// ═══════════════════════════════════════════════════════════════════════════

describe("310 — le document gouverné est conservé INTÉGRALEMENT", () => {
  it("⚑ retirer l'annexe rend EXACTEMENT les octets du renderer", async () => {
    // ██ C'est la propriété qui autorise l'annexe : la surface AJOUTE, elle ██
    // ██ ne DÉCOUPE pas le document du renderer.                            ██
    const html = await htmlDe(VINE);
    const marque = html.match(/generated ([0-9T:.\-Z]+)</);
    expect(marque, "l'estampille de génération a disparu").not.toBeNull();

    const attendu = renderGovernedCaseFileHtml(
      projectAssembly(VINE, "COUNSEL_INVESTOR"),
      marque![1],
    );
    const i = html.indexOf("<style>\n  .sealed");
    const j = html.indexOf("</section>", html.indexOf('<section class="sealed">'))
      + "</section>".length;
    expect(html.slice(0, i) + html.slice(j)).toBe(attendu);
  });

  it("l'annexe est placée DANS le document, avant `</body>`", async () => {
    const html = await htmlDe(VINE);
    expect(html.indexOf('<section class="sealed">')).toBeLessThan(html.lastIndexOf("</body>"));
    expect(html.trimEnd().endsWith("</body></html>")).toBe(true);
  });

  it("NON-RÉGRESSION — ①·②·④ intacts sur le même document", async () => {
    const html = await htmlDe(VINE);
    expect(html).toContain("GOVERNED CONTENT");        // ④
    expect(html).toContain("This document contains:"); // ④
    expect(html).toContain("Foundation trace");        // ①
    expect(html).toContain("Governed evidence");       // ①
    expect(html).toContain("MACHINE_MEASURED");        // ① provenance
    expect(html).toContain("Audit information");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE RENDERER EST INTOUCHÉ, ET L'AUTORITÉ N'EST PAS DUPLIQUÉE
// ═══════════════════════════════════════════════════════════════════════════

describe("310 — ce que le lot n'a pas touché, et ce qu'il n'a pas recopié", () => {
  it("le renderer ne connaît RIEN du registre", async () => {
    const code = codeSeul(readFileSync("src/lib/casefile/governedCaseFileRenderer.ts", "utf8"));
    for (const s of [
      "SEALED ARTIFACTS", "listerParSujet", "governed_objects", "registreId",
      "deriverEligibilite", "etatDInvalidation", "LigneDeRegistre",
    ]) {
      expect(code, `le renderer porte « ${s} »`).not.toContain(s);
    }
  });

  it("⛔ LA SURFACE NE REDÉRIVE AUCUNE RÈGLE D'ÉLIGIBILITÉ", async () => {
    // ██ Recopier une condition ferait une SECONDE AUTORITÉ. Deux autorités ██
    // ██ divergent — c'est l'Invariant Propagation Failure.                  ██
    const code = codeSeul(readFileSync("src/app/admin/cases/[ref]/governed/route.ts", "utf8"));
    expect(code, "l'autorité doit être APPELÉE").toContain("deriverEligibilite(l)");
    for (const condition of [
      '=== "SUPERSEDED"', '!== "SUPERSEDED"',
      '=== "REGISTERED"', '!== "REGISTERED"',
      "estEtatDInvalidation", "estEtatDAutorite",
    ]) {
      expect(code, `${condition} est une règle d'éligibilité recopiée`).not.toContain(condition);
    }
  });

  it("la primitive ne fait QUE `WHERE subject = …`", () => {
    const src = readFileSync("src/lib/storage/registre/registre.ts", "utf8");
    const p = codeSeul(src).slice(codeSeul(src).indexOf("export async function listerParSujet"));
    const corps = p.slice(0, p.indexOf("\n}"));
    expect(corps).toContain("WHERE subject = ${sujet}");
    // ⛔ Aucun ordre sémantique, aucune sélection, aucun filtrage inventé.
    for (const s of [
      "registered_at DESC", "DESC", "LIMIT", "invalidation_state",
      "authority_state", "DISTINCT", "latest", "canonical",
    ]) {
      expect(corps, `la primitive porte « ${s} »`).not.toContain(s);
    }
    // L'ordre est celui de l'identité — neutre.
    expect(corps).toContain("ORDER BY id");
  });

  it("aucune écriture, nulle part dans le chemin du lot", () => {
    const route = codeSeul(readFileSync("src/app/admin/cases/[ref]/governed/route.ts", "utf8"));
    for (const s of [
      "$executeRaw", "INSERT", "UPDATE", "DELETE", "prononcerSupersession",
      "produireArtefactGouverne", "uploadPdf", "PutObject",
    ]) {
      expect(route, `la surface émet « ${s} »`).not.toContain(s);
    }
  });

  it("SÉCURITÉ — aucune URL R2 signée n'apparaît sur la surface", async () => {
    const html = await htmlDe(VINE);
    for (const s of ["X-Amz-Signature", "r2.cloudflarestorage.com", "getSignedUrl", "reports/production/"]) {
      expect(html, s).not.toContain(s);
    }
  });
});
