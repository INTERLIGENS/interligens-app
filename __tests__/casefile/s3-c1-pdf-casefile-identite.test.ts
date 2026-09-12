/**
 * __tests__/casefile/s3-c1-pdf-casefile-identite.test.ts
 *
 * BUILD 13 · S3 — CRITÈRE 1
 *
 *   L'IDENTITÉ IMPRIMÉE PAR `/api/pdf/casefile` DÉRIVE DU `CaseFileRef` GOUVERNÉ.
 *
 * ─── LA PROPRIÉTÉ DE LA FENÊTRE ───────────────────────────────────────────
 *
 *   Any portable CaseFile artifact that carries a CaseFile citation identity
 *   must derive that identity from the governed persisted CaseFileRef.
 *
 * ─── CE QUI EST MESURÉ, ET COMMENT ────────────────────────────────────────
 *
 * La sonde ne lit PAS le code de la route : elle lit le HTML QUI DEVIENT LE
 * PDF. `page.setContent(html)` est le dernier point où l'artefact existe encore
 * sous une forme lisible — après, c'est un flux binaire. Le moteur d'impression
 * (`src/components/pdf/pdfRenderer.ts`) tourne POUR DE VRAI : il est PASSIF,
 * hors fenêtre, et on ne le remplace pas par une doublure qui dirait ce qu'on
 * veut entendre.
 *
 * Ce que la route imprime aujourd'hui pour le mint canonique BOTIFY :
 *
 *     data/cases/botify.json   case_meta.case_id = CASE-2024-BOTIFY-001
 *     canonicalRefForMint()                      = IL-SHILL-BOTIFY-001
 *
 * Deux identités de citation pour UN sujet, et c'est la première qui sort sur
 * l'artefact — alors que `src/lib/caseDb.ts` déclare en tête, depuis BUILD 9,
 * que ce module n'a PAS le droit d'alimenter « le PDF ou l'export CaseFile ».
 *
 * ─── POURQUOI UN PRÉALABLE ────────────────────────────────────────────────
 *
 * ██  Un rouge et une sonde aveugle rendent le même rouge.               ██
 *
 * Le PRÉALABLE est VERT aujourd'hui et prouve que la sonde atteint bien
 * l'emplacement de citation de l'artefact réel. Sans lui, le rouge du critère
 * pourrait n'être que le silence d'une sonde qui ne lit rien.
 *
 * ─── LE MUTANT NE TOUCHE PAS LE DÉPÔT ─────────────────────────────────────
 *
 * `identitesCitees` est une fonction PURE d'une chaîne. Le mutant lui donne un
 * HTML SYNTHÉTIQUE. Démontrer qu'une garde mord ne doit jamais exiger
 * d'introduire la violation dans le dépôt.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { htmlCapture } = vi.hoisted(() => ({ htmlCapture: [] as string[] }));

// ── Le moteur d'impression tourne pour de vrai ; seul le navigateur est doublé.
vi.mock("puppeteer-core", () => ({
  default: {
    launch: async () => ({
      newPage: async () => ({
        setRequestInterception: async () => {},
        on: () => {},
        setContent: async (html: string) => {
          htmlCapture.push(html);
        },
        pdf: async () => Buffer.from("%PDF-1.4 stub"),
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

// Aucune connexion : la base n'est jamais atteinte depuis un test.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Le dossier gouverné, FONDÉ — c'est de LUI que l'identité doit dériver.
vi.mock("@/lib/casefile/canonicalReader", () => ({
  loadCanonicalCaseFile: vi.fn(async (ref: string) => ({
    ref,
    codename: "BOTIFY",
    ticker: "$BOTIFY",
    title: "Dossier gouverné",
    claims: [],
    sources: [],
  })),
  assertProvenanceSurvives: () => {},
}));

import { GET } from "@/app/api/pdf/casefile/route";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";
import { BOTIFY_CASEFILE_REF } from "@/lib/casefile/publicProjection";

/** L'identité de citation de l'espace de nommage HISTORIQUE. */
const HISTORIQUE = /CASE-\d{4}-[A-Z0-9]+-\d+/g;

/** L'identité de citation de l'espace de nommage GOUVERNÉ. */
const GOUVERNE = /IL-[A-Z0-9]+-[A-Z0-9]+-\d+/g;

/**
 * LA SONDE — toutes les identités de citation présentes dans un artefact.
 *
 * Elle rend les DEUX listes, jamais un booléen. Une garde qui ne chercherait
 * que la présence du fondé rendrait VERT un artefact qui porte les deux — et un
 * artefact qui porte deux identités de citation pour un sujet est exactement le
 * défaut qu'on ferme.
 */
export function identitesCitees(html: string): {
  historiques: string[];
  gouvernees: string[];
} {
  return {
    historiques: [...html.matchAll(HISTORIQUE)].map((m) => m[0]),
    gouvernees: [...html.matchAll(GOUVERNE)].map((m) => m[0]),
  };
}

async function artefactPour(mint: string): Promise<string> {
  htmlCapture.length = 0;
  const res = await GET(
    new Request(`https://app.interligens.com/api/pdf/casefile?mint=${mint}`) as never,
  );
  // On ne suppose pas le succès : s'il n'y a pas d'artefact, on le dit ici.
  expect(htmlCapture.length, `aucun HTML rendu (statut ${res.status})`).toBe(1);
  return htmlCapture[0];
}

beforeEach(() => {
  htmlCapture.length = 0;
});

describe("S3 · C1 — PRÉALABLE : la sonde lit bien l'emplacement de citation", () => {
  it("l'artefact réel est atteint, et la sonde y trouve une identité de citation", async () => {
    const html = await artefactPour(BOTIFY_MINT);

    // Le moteur passif a bien tourné : c'est un document, pas une chaîne vide.
    expect(html).toContain("<html");
    expect(html.length).toBeGreaterThan(500);

    // ET la sonde voit une identité. Si cette assertion tombe, le rouge du
    // critère ne vaudrait rien : il dirait « rien trouvé », pas « mauvaise ».
    const vues = identitesCitees(html);
    expect(
      vues.historiques.length + vues.gouvernees.length,
      "la sonde ne lit AUCUNE identité : elle est aveugle, pas satisfaite",
    ).toBeGreaterThan(0);
  });

  // ── APRÈS CORRECTION — le préalable devient l'ANTI-RÉGRESSION ───────────
  //
  // Il assertait l'état SERVI avant la fenêtre : `CASE-2024-BOTIFY-001`. Son
  // rôle était de prouver que la sonde n'était pas aveugle. Ce rôle survit,
  // mais il ne peut plus s'exercer en exigeant le défaut — il s'exerce en
  // épinglant la valeur exacte que la fenêtre a retirée.
  it("l'identité HISTORIQUE de ce sujet est nommée, et elle a disparu de l'artefact", async () => {
    const html = await artefactPour(BOTIFY_MINT);
    // La sonde VERRAIT cette valeur si elle était là : preuve de non-cécité,
    // sans exiger qu'elle y soit.
    expect(identitesCitees(`<p>CASE-2024-BOTIFY-001</p>`).historiques).toEqual([
      "CASE-2024-BOTIFY-001",
    ]);
    // Et sur l'artefact réel, elle n'y est plus.
    expect(html).not.toContain("CASE-2024-BOTIFY-001");
  });
});

describe("S3 · C1 — CRITÈRE : l'identité imprimée dérive du ref gouverné", () => {
  it("l'artefact porte le CaseFileRef gouverné", async () => {
    const vues = identitesCitees(await artefactPour(BOTIFY_MINT));
    expect(vues.gouvernees).toContain(BOTIFY_CASEFILE_REF);
  });

  it("et il ne porte AUCUNE identité de l'espace de nommage historique", async () => {
    const vues = identitesCitees(await artefactPour(BOTIFY_MINT));
    expect(vues.historiques).toEqual([]);
  });
});

describe("S3 · C1 — MUTANT : la sonde mord sur un artefact qui porte les deux", () => {
  const DEUX_IDENTITES = `
    <html><body>
      <div class="ref">IL-SHILL-BOTIFY-001</div>
      <footer>CASE-2024-BOTIFY-001 — CONFIDENTIEL</footer>
    </body></html>`;

  it("porter le fondé NE SUFFIT PAS : l'historique restant est vu", () => {
    const vues = identitesCitees(DEUX_IDENTITES);
    expect(vues.gouvernees).toContain(BOTIFY_CASEFILE_REF);
    // Le critère « historiques vide » tombe — c'est ce qu'on veut.
    expect(vues.historiques).not.toEqual([]);
  });

  it("CONTRÔLE NÉGATIF — le MÊME artefact, purgé de l'historique, satisfait la sonde", () => {
    const vues = identitesCitees(
      DEUX_IDENTITES.replace("CASE-2024-BOTIFY-001", BOTIFY_CASEFILE_REF),
    );
    expect(vues.historiques).toEqual([]);
    expect(vues.gouvernees).toContain(BOTIFY_CASEFILE_REF);
  });
});
