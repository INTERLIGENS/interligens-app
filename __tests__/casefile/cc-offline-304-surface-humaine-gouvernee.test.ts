// ─── CC-OFFLINE-304 · RC PRODUCT SPINE ① — LA SURFACE HUMAINE GOUVERNÉE ────
//
// ██  LA SURFACE N'AJOUTE AUCUNE AUTORITÉ. ELLE EN EXPOSE UNE.             ██
//
// `GET /admin/cases/<ref>/governed` enchaîne quatre briques EXISTANTES :
//
//   isAdminSessionFromCookies() → assembleAuthority → projectAssembly →
//   renderGovernedCaseFileHtml
//
// Aucune n'est modifiée par ce lot. Ces témoins ne re-testent donc pas ce que
// leurs propres critères tiennent déjà (240/242/244/250/260/266) : ils tiennent
// les CINQ PROPRIÉTÉS DE LA SURFACE, celles qu'aucun de ces critères ne couvre
// parce qu'aucun d'eux ne connaît de route.
//
// ─── LE SEUL MOCK, ET POURQUOI IL EST LÀ ──────────────────────────────────
//
// `assembleAuthority` est la FRONTIÈRE DE BASE, et elle seule est simulée. Le
// gate, la projection et le rendu s'exécutent POUR DE VRAI :
//
//   · le gate lit un vrai cookie, dont le jeton est calculé par le vrai HMAC ;
//   · `projectAssembly` applique le vrai contrat de fondement ;
//   · `renderGovernedCaseFileHtml` produit les vrais octets.
//
// Simuler la projection ou le rendu testerait le simulacre.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import type {
  AssembledClaim,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "@/lib/casefile/authorityAssembly";
import { codeSeul } from "./codeSeul";

// ═══ L'ENVIRONNEMENT DU GATE ════════════════════════════════════════════════
// Deux variables, et le jeton qui en découle. Elles sont présentes en
// Production ; ici elles sont fabriquées, et le cookie VALIDE est calculé par
// la même formule que le code de production — pas recopié d'une constante.

const ADMIN_TOKEN = "admin-token-for-tests-not-a-real-secret";
const ADMIN_BASIC_PASS = "admin-pass-for-tests-not-a-real-secret";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.ADMIN_BASIC_PASS = ADMIN_BASIC_PASS;

const JETON_VALIDE = createHmac("sha256", ADMIN_TOKEN).update(ADMIN_BASIC_PASS).digest("hex");
const COOKIE = "admin_session";

/** Le magasin de cookies que `next/headers` sert au handler. */
const cookiesDuHandler = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => {
      const v = cookiesDuHandler.get(nom);
      return v === undefined ? undefined : { name: nom, value: v };
    },
  }),
}));

// Le proxy importe Prisma par ses gates voisins ; aucun de ses chemins n'est
// exercé ici — /admin est exempt du gate beta — mais le module doit se charger.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    investigatorSession: { findFirst: vi.fn(), update: () => ({ catch: () => {} }) },
    investigatorAuditLog: { create: vi.fn() },
  },
}));

// LA FRONTIÈRE DE BASE, et rien d'autre.
const assembleAuthorityMock = vi.fn<(ref: string) => Promise<CanonicalAuthorityAssembly | null>>();
vi.mock("@/lib/casefile/authorityAssembly", () => ({
  assembleAuthority: (ref: string) => assembleAuthorityMock(ref),
}));

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
});

// ═══ LES FIXTURES — PRÉDITES DEPUIS LE CORPUS GOUVERNÉ ══════════════════════
//
// Elles reproduisent la FORME des deux dossiers en production : les mêmes
// identifiants de claim, les mêmes pièces citées, les mêmes qualifications de
// provenance, la même arête causale. Les TEXTES sont neutres et fabriqués —
// un témoin n'a pas à recopier la prose gouvernée pour tenir sa propriété, et
// la recopier ferait entrer dans le dépôt du contenu qui n'y a pas sa place.

const SHA = (c: string) => c.repeat(64);

const piece = (o: Partial<AssembledSource> = {}): AssembledSource => ({
  sourceId: "SRC-000", sourceType: "osint_x_search", caption: null,
  capturedAt: "2026-09-12", sourceUrl: "https://example.invalid/p/1", sha256: SHA("a"),
  snapshotLinked: true, provenanceKind: "OPERATOR_DECLARED", journalId: "1",
  sourceLocator: "https://example.invalid/p/1", declaredBy: "David Douville", ...o,
});

const claim = (o: Partial<AssembledClaim> = {}): AssembledClaim => ({
  claimId: "C-000", version: 1, rowNature: "PRIMARY_OBSERVATION",
  title: "Assertion gouvernée", titleFr: null, description: "Contenu gouverné.",
  descriptionFr: null, category: null, severity: null, status: null, claimDate: null,
  state: "ATTACHED", evidenceRefs: ["SRC-000"], contentHash: SHA("b"), ...o,
});

const MESURE_VINE = piece({
  sourceId: "SRC-MEASURE-01", sourceType: "measurement",
  provenanceKind: "MACHINE_MEASURED",
  declaredBy: "instrument:il-measure-vine-wallet-attribution@1.0.0",
  sourceLocator: "r2://interligens-reports/vine-wallet-attribution.json",
  sourceUrl: "r2://interligens-reports/vine-wallet-attribution.json", sha256: SHA("c"),
});

/** VINE — 5 observations + 1 conclusion, telles que le corpus les porte. */
const VINE: CanonicalAuthorityAssembly = {
  subject: { ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE", title: "VINE — dossier canonique" },
  sources: [
    piece({ sourceId: "SRC-0xS-09" }),
    piece({ sourceId: "SRC-0xS-18" }),
    piece({ sourceId: "SRC-CKF-01" }),
    piece({ sourceId: "SRC-FKK-01" }),
    piece({ sourceId: "SRC-SLD-01" }),
    MESURE_VINE,
  ],
  claims: [
    claim({ claimId: "VINE-0xS-01", version: 2, evidenceRefs: ["SRC-0xS-09"] }),
    claim({ claimId: "VINE-0xS-02", version: 2, evidenceRefs: ["SRC-0xS-09"] }),
    claim({ claimId: "VINE-0xS-03", version: 2, evidenceRefs: ["SRC-0xS-18"] }),
    claim({
      claimId: "VINE-MEASURE-01", version: 1, evidenceRefs: ["SRC-MEASURE-01"],
      title: "Mesure bornée d'attribution",
      description: "Périmètre mesuré, et ce qui n'y a pas été trouvé.",
    }),
    // ⚠️ `description` ET `descriptionFr` sont NULL en base : le renderer
    //    conditionne le `<p>`, donc cette claim rend SON TITRE SEUL.
    claim({
      claimId: "VINE-MULTI-01", version: 1,
      title: "TITRE-SANS-PARAGRAPHE-304",
      description: null, descriptionFr: null,
      evidenceRefs: ["SRC-0xS-09", "SRC-CKF-01", "SRC-FKK-01", "SRC-SLD-01"],
    }),
    claim({
      claimId: "VINE-CONCLUSION-01", version: 1, rowNature: "INFERENCE",
      title: "Conclusion gouvernée", evidenceRefs: [], contentHash: SHA("d"),
    }),
  ],
  dependencies: [
    {
      dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1,
      sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM",
    },
  ],
};

/** BOTIFY — UNE observation, et AUCUNE inférence. */
const BOTIFY: CanonicalAuthorityAssembly = {
  subject: { ref: "IL-SHILL-BOTIFY-001", codename: "BOTIFY", ticker: "$BOTIFY", title: "BOTIFY — dossier canonique" },
  sources: [
    piece({
      sourceId: "SRC-EVENTS-01", sourceType: "measurement",
      provenanceKind: "MACHINE_MEASURED",
      declaredBy: "instrument:il-measure-botify-proceeds-events@1.0.0",
      sourceLocator: "r2://interligens-reports/botify-proceeds-events.json",
      sourceUrl: "r2://interligens-reports/botify-proceeds-events.json", sha256: SHA("e"),
    }),
  ],
  claims: [
    claim({
      claimId: "BOTIFY-EVENTS-01", version: 1, evidenceRefs: ["SRC-EVENTS-01"],
      title: "Événements de produits mesurés",
      description: "Ce que la mesure établit, dans son périmètre.",
    }),
  ],
  dependencies: [],
};

const texte = async (r: Response) => await r.text();

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 1 — INACCESSIBLE SANS COOKIE ADMIN
// ═══════════════════════════════════════════════════════════════════════════
//
// ⛔ `expect(source).toContain("isAdminSessionFromCookies")` vérifie une
//    INTENTION, pas un comportement : la ligne peut être présente et morte, et
//    le matcher du proxy peut ne jamais router la requête vers le gate — un
//    gate que le framework n'exécute pas dit « refuse » sans rien refuser.
//
// Les deux moitiés sont donc tenues par EXÉCUTION : le matcher est RECOMPILÉ
// avec le path-to-regexp embarqué dans Next, et le handler est APPELÉ.

type PathToRegexp = (pattern: string) => RegExp;
const requireCjs = createRequire(import.meta.url);

function loadPathToRegexp(): PathToRegexp {
  const mod = requireCjs("next/dist/compiled/path-to-regexp") as {
    pathToRegexp?: PathToRegexp;
    default?: { pathToRegexp?: PathToRegexp };
  };
  const fn = mod.pathToRegexp ?? mod.default?.pathToRegexp;
  if (!fn) throw new Error("path-to-regexp introuvable dans le bundle Next");
  return fn;
}

const CHEMIN = "/admin/cases/IL-SHILL-VINE-001/governed";

describe("304 · ① la surface est inaccessible sans cookie admin", () => {
  it("le `config.matcher` du proxy ROUTE ce chemin — recompilé, pas lu", async () => {
    const pathToRegexp = loadPathToRegexp();
    const { config } = await import("@/proxy");
    const hit = (config.matcher as string[]).some((m) => pathToRegexp(m).test(CHEMIN));
    expect(hit, `aucun matcher ne couvre ${CHEMIN} — le gate ne s'exécuterait jamais`).toBe(true);
  });

  it("et le proxy, EXÉCUTÉ sans cookie, redirige vers /admin/login", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest(`http://localhost${CHEMIN}`));
    expect(res.status).toBe(307);
    const dest = new URL(res.headers.get("location") ?? "http://localhost/");
    expect(dest.pathname).toBe("/admin/login");
    expect(dest.searchParams.get("redirect")).toBe(CHEMIN);
  });

  it("CONTRÔLE POSITIF — avec le cookie valide, le proxy laisse passer", async () => {
    // Sans ce témoin, le précédent serait vert même si le proxy refusait TOUT.
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(`http://localhost${CHEMIN}`, { headers: { cookie: `${COOKIE}=${JETON_VALIDE}` } }),
    );
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("le SECOND gate mord aussi — sans cookie, le handler refuse et n'assemble RIEN", async () => {
    cookiesDuHandler.clear();
    assembleAuthorityMock.mockResolvedValue(VINE);
    const res = await GET("IL-SHILL-VINE-001");
    expect(res.status).toBe(404);
    // ⛔ L'autorité n'est même pas consultée : le refus précède la lecture.
    expect(assembleAuthorityMock).not.toHaveBeenCalled();
    const body = await texte(res);
    expect(body).not.toContain("<!doctype html");
    expect(body).not.toContain("VINE");
  });

  it("un cookie PRÉSENT mais faux ne vaut pas un cookie absent — il refuse pareil", async () => {
    cookiesDuHandler.set(COOKIE, "f".repeat(JETON_VALIDE.length));
    assembleAuthorityMock.mockResolvedValue(VINE);
    expect((await GET("IL-SHILL-VINE-001")).status).toBe(404);
    expect(assembleAuthorityMock).not.toHaveBeenCalled();
  });

  it("LE REFUS N'EST PAS UN ORACLE — les trois causes rendent la MÊME réponse", async () => {
    // `assembleAuthority` rend `null` pour « le dossier n'existe pas » ET pour
    // « il n'a pas de corpus gouverné ». Les distinguer dirait à un visiteur
    // non authentifié quelles références existent.
    const empreinte = async (r: Response) =>
      `${r.status}|${r.headers.get("content-type")}|${await r.text()}`;

    cookiesDuHandler.clear();
    const sansCookie = await empreinte(await GET("IL-SHILL-VINE-001"));

    cookiesDuHandler.set(COOKIE, JETON_VALIDE);
    assembleAuthorityMock.mockResolvedValue(null);
    const inexistant = await empreinte(await GET("IL-INEXISTANT-999"));
    const sansCorpus = await empreinte(await GET("IL-SHILL-VINE-001"));

    expect(inexistant).toBe(sansCorpus);
    expect(sansCookie).toBe(inexistant);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 2 — AUCUN CLAIM `rowNature = NULL` NE SORT
// ═══════════════════════════════════════════════════════════════════════════

describe("304 · ② une claim non classée ne franchit pas la surface", () => {
  const SENTINELLE = "SENTINELLE-NON-CLASSEE-304";

  const avecNonClassee: CanonicalAuthorityAssembly = {
    ...VINE,
    claims: [
      ...VINE.claims,
      claim({
        claimId: "VINE-NON-CLASSEE-99", version: 1, rowNature: null,
        title: SENTINELLE, description: SENTINELLE,
        evidenceRefs: ["SRC-0xS-09"], contentHash: SHA("f"),
      }),
    ],
  };

  it("elle est absente de la projection, donc absente du HTML servi", async () => {
    assembleAuthorityMock.mockResolvedValue(avecNonClassee);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    expect(html).not.toContain(SENTINELLE);
    expect(html).not.toContain("VINE-NON-CLASSEE-99");
  });

  it("CONTRÔLE — les claims CLASSÉES du même assemblage, elles, sortent", async () => {
    // Sinon le témoin ci-dessus serait vert pour la mauvaise raison : une page
    // vide ne contient aucune sentinelle non plus.
    assembleAuthorityMock.mockResolvedValue(avecNonClassee);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    for (const id of ["VINE-0xS-01", "VINE-0xS-02", "VINE-0xS-03", "VINE-MEASURE-01", "VINE-MULTI-01", "VINE-CONCLUSION-01"]) {
      expect(html, id).toContain(id);
    }
  });

  it("aucune `rowNature` vide ni littéral `null` ne se rend dans une trace", async () => {
    assembleAuthorityMock.mockResolvedValue(avecNonClassee);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    expect(html).not.toMatch(/·\s*null\s*·/);
    expect(html).not.toContain("UNCLASSIFIED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 3 — AUCUN CLAIM `state !== PUBLIC` PRÉSENTÉ COMME PUBLIÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// L'audience de cette surface est COUNSEL_INVESTOR : elle voit des assertions
// ATTACHED, et c'est correct. Ce qui serait faux, c'est de les présenter comme
// PUBLIÉES. La propriété n'est donc pas « rien d'ATTACHED ne sort », c'est
// « ce qui sort porte SON état, et aucun vocabulaire de publication ».

describe("304 · ③ l'état gouverné est rendu tel quel, jamais promu", () => {
  it("chaque claim rend SON état — et il est bien ATTACHED, pas PUBLIC", async () => {
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    const projection = projectAssembly(VINE, "COUNSEL_INVESTOR");
    expect(projection.claims.length).toBeGreaterThan(0);
    for (const c of projection.claims) {
      expect(c.state, `${c.claimId} n'est pas ATTACHED dans la fixture`).not.toBe("PUBLIC");
      expect(html, `${c.claimId} ne rend pas son état`).toContain(
        `<code>${c.claimId}</code> v${c.version} ·`,
      );
    }
    expect(html).toContain("ATTACHED");
  });

  it("MUTANT — aucun vocabulaire de publication n'apparaît", async () => {
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    for (const mot of ["published", "Published", "PUBLISHED", "publication", "Publication"]) {
      expect(html, mot).not.toContain(mot);
    }
    // `PUBLIC` ne doit apparaître NULLE PART : ni comme état, ni comme audience
    // (celle-ci est COUNSEL_INVESTOR), ni dans un libellé.
    expect(html).not.toMatch(/\bPUBLIC\b/);
    expect(html).toContain("COUNSEL_INVESTOR");
  });

  it("CONTRÔLE — la surface n'est PAS la projection publique", async () => {
    // La projection PUBLIC de ce même assemblage est VIDE : si la surface
    // servait cette audience-là, elle ne rendrait aucune claim. Elle en rend six.
    expect(projectAssembly(VINE, "PUBLIC").claims).toHaveLength(0);
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    expect(html).not.toContain("No governed claim");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 4 — LA PHRASE DE CARDINALITÉ SUR PROJECTION VIDE
// ═══════════════════════════════════════════════════════════════════════════

describe("304 · ④ une projection vide rend une CARDINALITÉ, pas un verdict", () => {
  // Un dossier qui EXISTE — donc pas de refus — mais dont aucune claim ne
  // satisfait le contrat de fondement : la pièce citée n'est pas au registre.
  const VIDE: CanonicalAuthorityAssembly = {
    subject: { ref: "IL-SHILL-VIDE-001", codename: "VIDE", ticker: "$VIDE", title: "Dossier sans claim admissible" },
    sources: [],
    claims: [claim({ claimId: "C-ORPHELINE", evidenceRefs: ["SRC-ABSENTE"] })],
    dependencies: [],
  };

  it("le dossier est SERVI — 200 — et il le dit comme une cardinalité", async () => {
    assembleAuthorityMock.mockResolvedValue(VIDE);
    const res = await GET("IL-SHILL-VIDE-001");
    expect(res.status).toBe(200);
    const html = await texte(res);
    expect(html).toContain("No governed claim");
    expect(html).toContain("contains no claim");
    expect(html).toContain("No synthetic assessment is produced in its place.");
    expect(html).toContain("COUNSEL_INVESTOR");
  });

  it("⛔ ET AUCUNE SECTION VIDE — l'absence se lit dans l'absence", async () => {
    assembleAuthorityMock.mockResolvedValue(VIDE);
    const html = await texte(await GET("IL-SHILL-VIDE-001"));
    expect(html).not.toContain("Governed observations");
    expect(html).not.toContain("Governed conclusions");
    // La claim orpheline n'est pas « montrée comme retenue » : elle est ABSENTE.
    expect(html).not.toContain("C-ORPHELINE");
  });

  it("MUTANT — aucun mot de synthèse ne comble le vide", async () => {
    assembleAuthorityMock.mockResolvedValue(VIDE);
    const html = await texte(await GET("IL-SHILL-VIDE-001"));
    for (const mot of ["UNDETERMINED", "AVOID", "SAFE", "WARNING", "SCAM", "no evidence of", "clean"]) {
      expect(html, mot).not.toContain(mot);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPRIÉTÉ 5 — LES 16 ASSERTIONS INTERDITES NE REVIENNENT PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// BOTIFY C1–C8 et VINE C9–C17 ont été RETIRÉES du matériel servi. Elles ne
// sont pas « masquées » : aucune autorité gouvernée ne les porte, et aucune
// des quatre briques de la chaîne ne peut les fabriquer.
//
// Le témoin interdit LES IDENTIFIANTS ET LES FORMULATIONS, sur les DEUX bouts :
//   · ce que la surface REND, pour les deux sujets réels ;
//   · ce que le CODE de la chaîne peut émettre — commentaires dépouillés, car
//     une note qui explique le retrait n'est pas une émission.

const INTERDITS: readonly string[] = [
  "sybil", "Sybil", "SYBIL",
  "Telegram", "telegram",
  "insider", "Insider", "insiders",
  "Coordinated Shill Campaign",
  "Liquidity Withdrawal",
  "Whale Concentration",
  "Mint & Freeze",
  "62 %", "62%",
  "280 861", "280861",
  "@PeterGirr", "PeterGirr",
  "@aixbt_agent", "aixbt_agent",
  "Rylan Gade",
  "QTeam",
  "Coinbase",
];

/** Les identifiants des 16 assertions retirées, sous leur forme de claim. */
const IDS_RETIRES: readonly string[] = [
  ...Array.from({ length: 8 }, (_, i) => `BOTIFY-C${i + 1}`),
  "VINE-C9", "VINE-C10", "VINE-C11", "VINE-C12",
  "VINE-C14", "VINE-C15", "VINE-C16", "VINE-C17",
];

const MODULES_DE_LA_CHAINE = [
  "src/app/admin/cases/[ref]/governed/route.ts",
  "src/lib/casefile/authorityAssembly.ts",
  "src/lib/casefile/audienceProjection.ts",
  "src/lib/casefile/governedCaseFileRenderer.ts",
];

describe("304 · ⑤ les 16 assertions retirées ne reviennent par aucun bout", () => {
  it("TÉMOIN DE NON-VACUITÉ — la liste est bien exercée contre du contenu", () => {
    // Une garde qui balaie une chaîne vide rend le même vert qu'un dépôt sain.
    expect(INTERDITS.length).toBeGreaterThan(20);
    expect(IDS_RETIRES).toHaveLength(16);
    const faux = renderGovernedCaseFileHtml(
      projectAssembly(
        {
          ...BOTIFY,
          claims: [claim({ claimId: "BOTIFY-C1", evidenceRefs: ["SRC-EVENTS-01"], title: "sybil", description: "Coinbase" })],
        },
        "COUNSEL_INVESTOR",
      ),
      "2026-09-19T00:00:00.000Z",
    );
    // Le balayage MORD quand le contenu est là : c'est ce qui rend son vert
    // significatif quand il n'y est pas.
    expect(INTERDITS.some((m) => faux.includes(m))).toBe(true);
  });

  it("VINE — aucune formulation interdite dans le HTML servi", async () => {
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    for (const m of INTERDITS) expect(html, m).not.toContain(m);
    for (const id of IDS_RETIRES) expect(html, id).not.toContain(id);
  });

  it("BOTIFY — aucune formulation interdite dans le HTML servi", async () => {
    assembleAuthorityMock.mockResolvedValue(BOTIFY);
    const html = await texte(await GET("IL-SHILL-BOTIFY-001"));
    for (const m of INTERDITS) expect(html, m).not.toContain(m);
    for (const id of IDS_RETIRES) expect(html, id).not.toContain(id);
  });

  it("et AUCUN module de la chaîne ne peut en émettre une", () => {
    for (const f of MODULES_DE_LA_CHAINE) {
      const code = codeSeul(readFileSync(f, "utf8"));
      for (const m of INTERDITS) expect(code, `${f} — « ${m} »`).not.toContain(m);
      for (const id of IDS_RETIRES) expect(code, `${f} — ${id}`).not.toContain(id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LA PAGE REND — PRÉDIT DEPUIS LES DONNÉES, PUIS VÉRIFIÉ
// ═══════════════════════════════════════════════════════════════════════════

describe("304 · la forme servie, telle que le corpus la détermine", () => {
  it("VINE — 5 observations et 1 conclusion, les deux sections présentes", async () => {
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    const projection = projectAssembly(VINE, "COUNSEL_INVESTOR");
    expect(projection.claims.filter((c) => c.rowNature !== "INFERENCE")).toHaveLength(5);
    expect(projection.claims.filter((c) => c.rowNature === "INFERENCE")).toHaveLength(1);
    expect(html).toContain("Governed observations");
    expect(html).toContain("Governed conclusions");
    // L'arête causale de la conclusion, épinglée en version.
    expect(html).toContain("DERIVED_FROM");
    expect(html).toContain("<code>VINE-MEASURE-01</code> v1");
    // L'identité de l'instrument de la mesure.
    expect(html).toContain("instrument:il-measure-vine-wallet-attribution@1.0.0");
  });

  it("VINE-MULTI-01 rend SON TITRE SEUL — `description` NULL, donc aucun `<p>`", async () => {
    assembleAuthorityMock.mockResolvedValue(VINE);
    const html = await texte(await GET("IL-SHILL-VINE-001"));
    expect(html).toContain("<h3>TITRE-SANS-PARAGRAPHE-304</h3>");
    // Le renderer conditionne le paragraphe : rien ne comble le champ vide.
    expect(html).not.toMatch(/<h3>TITRE-SANS-PARAGRAPHE-304<\/h3>\s*<p>/);
    // Et ses quatre pièces sont bien rendues, elles.
    for (const s of ["SRC-0xS-09", "SRC-CKF-01", "SRC-FKK-01", "SRC-SLD-01"]) {
      expect(html, s).toContain(s);
    }
  });

  it("⛔ BOTIFY — la section « Governed conclusions » est TOTALEMENT ABSENTE", async () => {
    assembleAuthorityMock.mockResolvedValue(BOTIFY);
    const html = await texte(await GET("IL-SHILL-BOTIFY-001"));
    const projection = projectAssembly(BOTIFY, "COUNSEL_INVESTOR");
    expect(projection.claims).toHaveLength(1);
    expect(projection.claims.filter((c) => c.rowNature === "INFERENCE")).toHaveLength(0);
    // Ni titre, ni bloc vide, ni « non établi ». L'ABSENCE SE LIT DANS L'ABSENCE.
    expect(html).not.toContain("Governed conclusions");
    expect(html).not.toContain("not established");
    expect(html).not.toContain("<h2></h2>");
    // Et l'observation, elle, est bien là.
    expect(html).toContain("Governed observations");
    expect(html).toContain("BOTIFY-EVENTS-01");
    expect(html).toContain("instrument:il-measure-botify-proceeds-events@1.0.0");
  });

  it("les octets servis sont EXACTEMENT ceux du renderer — aucune réécriture", async () => {
    // La surface n'est pas un second rendu : elle sert ce que la fonction pure
    // produit. `generatedAt` est la seule variation, et elle vient de l'horloge.
    assembleAuthorityMock.mockResolvedValue(BOTIFY);
    const res = await GET("IL-SHILL-BOTIFY-001");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await texte(res);

    const marque = html.match(/generated ([0-9T:.\-Z]+)</);
    expect(marque, "l'estampille de génération est absente du rendu").not.toBeNull();
    const attendu = renderGovernedCaseFileHtml(
      projectAssembly(BOTIFY, "COUNSEL_INVESTOR"),
      marque![1],
    );
    expect(html).toBe(attendu);
  });
});
