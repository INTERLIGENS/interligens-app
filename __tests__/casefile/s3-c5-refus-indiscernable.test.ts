/**
 * __tests__/casefile/s3-c5-refus-indiscernable.test.ts
 *
 * BUILD 13 · S3 — LE TÉMOIN DE FAIL-CLOSED, ET SON INDISCERNABILITÉ
 *
 *   `/api/pdf/casefile` REFUSE DE PRODUIRE quand aucun `CaseFileRef` gouverné
 *   ne se résout en dossier persisté — ET LE REFUS EST LE MÊME, QUELLE QUE
 *   SOIT LA CAUSE.
 *
 * ─── ON REFUSE, ON NE DÉGRADE PAS ─────────────────────────────────────────
 *
 * ██  No governed dossier → no canonical CaseFile artifact.              ██
 *
 * Pas de « Reference — », pas de mint tronqué en substitut, pas de
 * `case_meta.case_id`, pas de CaseFile sans CaseFileRef. Et surtout : pas de
 * transformation implicite de cette route en « PDF de scan générique » pour
 * éviter le fail-closed. Ce serait changer son contrat produit. Si un PDF pour
 * n'importe quel mint est voulu un jour, ce sera une capacité DISTINCTE,
 * explicitement non-CaseFile.
 *
 * ─── L'INDISCERNABILITÉ — LA PROPRIÉTÉ QUI COMPTE LE PLUS ─────────────────
 *
 * ██  Ce qu'on protège, ce n'est pas le mint — il est public on-chain.   ██
 * ██  C'est L'EXISTENCE D'UN DOSSIER NON PUBLIÉ.                         ██
 *
 * C'est la règle des huit routes KOL, transposée : cinq d'entre elles ne sont
 * pas des oracles PARCE QUE « inconnu » et « non publié » produisent la même
 * réponse. Une réponse qui varie selon l'état d'un objet non publié est un
 * oracle d'existence — et l'écrire sur une route neuve, en le sachant, serait
 * pire que l'avoir hérité de `kol/[handle]/pedigree`.
 *
 * Quatre causes, une seule réponse :
 *
 *   A  aucun dossier n'existe pour ce mint
 *   B  un dossier existe, mais `canonicalRefForMint()` ne le résout pas
 *   C  un ref se résout, mais aucun dossier gouverné/publiable ne le porte
 *   D  le mint est syntaxiquement valide et inconnu
 *
 * L'égalité est mesurée sur le JSON **SÉRIALISÉ** — pas « équivalent ».
 * `resolveCaseFileRef` rend la constante `NOT_FOUND` ELLE-MÊME et non un objet
 * équivalent ; c'est la même exigence, à la frontière HTTP cette fois.
 *
 * Un `detail` humain est acceptable — `NOMINATIVE_ACCESS_REQUIRED` en porte un
 * (`src/lib/security/nominativeApiGate.ts:258`) — À CONDITION qu'il soit une
 * CHAÎNE STATIQUE. Un `detail` qui se personnalise est une fuite avec de bonnes
 * manières.
 *
 * ─── STATUT : 404, ET POURQUOI PAS 400 ────────────────────────────────────
 *
 * La requête est BIEN FORMÉE : un mint valide a été fourni. C'est la RESSOURCE
 * qui manque, pas la syntaxe. `casefile/pdf/route.ts:122` rend déjà 404 pour ce
 * fait sur la voie `?handle=` ; la ligne 110 rend 400 sur la voie `?mint=`, et
 * c'est elle la divergence — dette nommée, hors de ce lot.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { etat } = vi.hoisted(() => ({
  etat: {
    htmlRendu: [] as string[],
    pdfDemande: 0,
    /** Ce que le lecteur canonique rend, par cause. */
    dossierRendu: null as null | { ref: string },
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: async () => ({
      newPage: async () => ({
        setRequestInterception: async () => {},
        on: () => {},
        setContent: async (html: string) => {
          etat.htmlRendu.push(html);
        },
        pdf: async () => {
          etat.pdfDemande += 1;
          return Buffer.from("%PDF-1.4 stub");
        },
      }),
      close: async () => {},
    }),
  },
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: { executablePath: async () => "/dev/null", args: [] as string[] },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true as const, response: null }),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
  getClientIp: () => "127.0.0.1",
  detectLocale: () => "en",
  RATE_LIMIT_PRESETS: { pdf: { limit: 10, windowSeconds: 60 } },
}));

vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: async () => ({
    source: "test",
    primary_pool: null,
    dex: null,
    url: null,
    price: null,
    liquidity_usd: null,
    volume_24h_usd: null,
    fdv_usd: null,
    fetched_at: "2026-09-12T00:00:00.000Z",
    cache_hit: false,
  }),
}));

vi.mock("@/lib/storage/pdfStorage", () => ({
  isStorageEnabled: () => false,
  uploadPdf: async () => null,
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/casefile/canonicalReader", () => ({
  loadCanonicalCaseFile: vi.fn(async () => etat.dossierRendu),
  assertProvenanceSurvives: () => {},
}));

import { GET } from "@/app/api/pdf/casefile/route";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";

/** Un mint Solana syntaxiquement valide qu'aucune carte ne connaît. */
const MINT_INCONNU_1 = "So11111111111111111111111111111111111111112";
const MINT_INCONNU_2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface Reponse {
  statut: number;
  corps: string;
  typeContenu: string | null;
  cache: string | null;
  disposition: string | null;
}

async function demander(mint: string): Promise<Reponse> {
  etat.htmlRendu.length = 0;
  etat.pdfDemande = 0;
  const res = await GET(
    new Request(`https://app.interligens.com/api/pdf/casefile?mint=${mint}`) as never,
  );
  return {
    statut: res.status,
    corps: await res.text(),
    typeContenu: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
    disposition: res.headers.get("content-disposition"),
  };
}

/**
 * LA SONDE — la signature observable d'un refus.
 *
 * Elle sérialise ce qu'un appelant peut DISTINGUER : statut, corps octet pour
 * octet, et les en-têtes qui varient avec le contenu. Elle n'inclut ni `Date`
 * ni longueur calculée — ce qui varie sans porter d'information ne doit pas
 * faire échouer la comparaison, et ce qui porte de l'information doit y être.
 */
export function signatureDeRefus(r: Reponse): string {
  return JSON.stringify({
    statut: r.statut,
    corps: r.corps,
    typeContenu: r.typeContenu,
    cache: r.cache,
    disposition: r.disposition,
  });
}

beforeEach(() => {
  etat.dossierRendu = null;
  etat.htmlRendu.length = 0;
  etat.pdfDemande = 0;
});

describe("S3 · C5 — PRÉALABLE : la sonde observe bien ce que la route rend", () => {
  it("la route répond, et la sonde lit statut, corps et en-têtes", async () => {
    const r = await demander(MINT_INCONNU_1);
    expect(typeof r.statut).toBe("number");
    expect(typeof r.corps).toBe("string");
    expect(
      signatureDeRefus(r).length,
      "la sonde ne lit RIEN : elle est aveugle, pas satisfaite",
    ).toBeGreaterThan(20);
  });

  // ── APRÈS CORRECTION — les deux préalables deviennent l'ANTI-RÉGRESSION ──
  //
  // Ils assertaient l'état SERVI : un mint sans dossier obtenait un artefact
  // de 200, portant `—` à la place d'une identité (`pdfRenderer.ts:162`). Le
  // fail-closed l'a fermé ; les deux épinglent désormais sa fermeture.
  it("un mint SANS dossier gouverné n'obtient plus d'artefact", async () => {
    const r = await demander(MINT_INCONNU_1);
    expect(r.statut).not.toBe(200);
    expect(r.typeContenu).not.toBe("application/pdf");
    expect(etat.pdfDemande).toBe(0);
  });

  it("et AUCUN document n'est rendu — donc plus aucun substitut à porter", async () => {
    await demander(MINT_INCONNU_1);
    // Le moteur n'est pas lancé : il n'y a pas de document où un `—` pourrait
    // tenir lieu d'identité de citation.
    expect(etat.htmlRendu).toEqual([]);
  });
});

describe("S3 · C5 — CRITÈRE : aucun artefact canonique sans dossier gouverné", () => {
  it("le refus est un 404 nommé", async () => {
    const r = await demander(MINT_INCONNU_1);
    expect(r.statut).toBe(404);
    expect(JSON.parse(r.corps).error).toBe("no_governed_casefile");
  });

  it("AUCUN OCTET D'ARTEFACT — ni corps PDF, ni page dégradée, ni rendu entamé", async () => {
    const r = await demander(MINT_INCONNU_1);
    expect(r.typeContenu).toMatch(/application\/json/);
    expect(r.corps.startsWith("%PDF")).toBe(false);
    expect(r.disposition).toBeNull();
    // Le moteur n'est même pas lancé : on refuse AVANT de produire, pas après.
    expect(etat.htmlRendu).toEqual([]);
    expect(etat.pdfDemande).toBe(0);
  });

  it("AUCUNE SUBSTITUTION D'IDENTITÉ dans le chemin de refus", async () => {
    const r = await demander(MINT_INCONNU_1);
    // ██  Cette assertion doit d'abord EXISTER pour mordre.               ██
    // Sans elle, le test passe à vide : aujourd'hui le corps est un flux PDF
    // binaire, qui ne contient trivialement aucun des trois substituts. Une
    // garde satisfaite par l'absence de chemin de refus n'en est pas une.
    expect(r.statut, "il n'y a pas de chemin de refus à inspecter").toBe(404);
    expect(r.corps).not.toMatch(/CASE-\d{4}-/); // case_meta.case_id
    expect(r.corps).not.toContain("Reference"); // « Reference — »
    expect(r.corps).not.toContain(MINT_INCONNU_1.slice(0, 8)); // mint tronqué
    expect(r.corps).not.toContain(MINT_INCONNU_1); // mint entier
  });

  it("le `detail` est une CHAÎNE STATIQUE — il ne se personnalise pas", async () => {
    const a = JSON.parse((await demander(MINT_INCONNU_1)).corps);
    const b = JSON.parse((await demander(MINT_INCONNU_2)).corps);
    expect(typeof a.detail).toBe("string");
    expect(a.detail.length).toBeGreaterThan(20);
    expect(a.detail).toBe(b.detail);
  });
});

describe("S3 · C5 — CRITÈRE : le refus est INDISCERNABLE, quelle que soit la cause", () => {
  it("quatre causes distinctes, une seule signature, octet pour octet", async () => {
    // A — aucun dossier n'existe pour ce mint.
    etat.dossierRendu = null;
    const a = await demander(MINT_INCONNU_1);

    // B — un dossier EXISTE (le lecteur en rendrait un), mais la carte
    //     `canonicalRefForMint` ne le résout pas : le lecteur n'est jamais
    //     consulté, et l'appelant ne doit pas pouvoir le déduire.
    etat.dossierRendu = { ref: "IL-SHILL-SECRET-001" };
    const b = await demander(MINT_INCONNU_1);

    // C — un ref se résout (BOTIFY est dans la carte), mais aucun dossier
    //     gouverné/publiable ne le porte.
    etat.dossierRendu = null;
    const c = await demander(BOTIFY_MINT);

    // D — un autre mint valide et inconnu.
    const d = await demander(MINT_INCONNU_2);

    const signatures = [a, b, c, d].map(signatureDeRefus);
    expect(new Set(signatures).size, `signatures distinctes : ${signatures.join("\n")}`).toBe(1);
  });

  it("en particulier, la cause B ne fuit PAS l'existence du dossier non publié", async () => {
    etat.dossierRendu = { ref: "IL-SHILL-SECRET-001" };
    const r = await demander(MINT_INCONNU_1);
    // Même garde qu'au-dessus : un refus doit exister pour qu'on puisse dire
    // qu'il ne fuit rien.
    expect(r.statut, "il n'y a pas de chemin de refus à inspecter").toBe(404);
    expect(r.corps).not.toContain("IL-SHILL-SECRET-001");
    expect(r.corps).not.toContain("SECRET");
  });
});

describe("S3 · C5 — MUTANT : un champ qui varie avec la cause est une fuite", () => {
  const base: Reponse = {
    statut: 404,
    corps: '{"error":"no_governed_casefile","detail":"statique"}',
    typeContenu: "application/json",
    cache: "no-store",
    disposition: null,
  };

  it("ajouter une raison qui varie TUE la propriété d'indiscernabilité", () => {
    const inconnu: Reponse = {
      ...base,
      corps: '{"error":"no_governed_casefile","cause":"unknown_mint"}',
    };
    const nonPublie: Reponse = {
      ...base,
      corps: '{"error":"no_governed_casefile","cause":"not_publishable"}',
    };
    expect(signatureDeRefus(inconnu)).not.toBe(signatureDeRefus(nonPublie));
  });

  it("un `detail` personnalisé aussi — la politesse ne referme pas l'oracle", () => {
    const a: Reponse = { ...base, corps: '{"detail":"No case file for So1111…"}' };
    const b: Reponse = { ...base, corps: '{"detail":"No case file for EPjFW…"}' };
    expect(signatureDeRefus(a)).not.toBe(signatureDeRefus(b));
  });

  it("un statut qui varie aussi — 404 ici, 403 là, et l'oracle est rouvert", () => {
    expect(signatureDeRefus(base)).not.toBe(signatureDeRefus({ ...base, statut: 403 }));
  });

  it("CONTRÔLE NÉGATIF — deux refus réellement identiques ont UNE signature", () => {
    expect(signatureDeRefus(base)).toBe(signatureDeRefus({ ...base }));
  });

  it("la sonde ne compare pas des objets « équivalents » mais des octets", () => {
    // Même contenu logique, ordre de clés différent : DEUX signatures. C'est
    // voulu — `resolveCaseFileRef` rend la constante elle-même, pas un
    // équivalent, et la frontière HTTP applique la même exigence.
    const ordre1: Reponse = { ...base, corps: '{"error":"x","detail":"y"}' };
    const ordre2: Reponse = { ...base, corps: '{"detail":"y","error":"x"}' };
    expect(signatureDeRefus(ordre1)).not.toBe(signatureDeRefus(ordre2));
  });
});
