/**
 * __tests__/casefile/s3-c2-report-v2-totalite.test.ts
 *
 * BUILD 13 · S3 — CRITÈRE 2
 *
 *   L'IDENTITÉ IMPRIMÉE PAR `/api/report/v2` DÉRIVE DU `CaseFileRef` GOUVERNÉ,
 *   SUR **CHAQUE** PIED — PAS SUR LE PREMIER.
 *
 * ─── LA LEÇON TOTALITÉ, ET POURQUOI ELLE EST ICI ──────────────────────────
 *
 * ██  Un témoin sur la première page ne prouve rien.                     ██
 *
 * `src/lib/pdf/v2/templateV2.ts:427` est un emplacement de citation dans un
 * gabarit. Un gabarit se répète — aujourd'hui une fois, demain autant de fois
 * qu'il y a de pages. Une garde qui asserterait « le HTML contient le ref »
 * resterait VERTE le jour où une seconde page sort avec l'ancienne identité :
 * la première occurrence suffirait à la satisfaire.
 *
 * La sonde énumère donc TOUS les pieds et quantifie universellement. Le mutant
 * en fabrique DEUX dont le second dévie, et la garde doit mourir dessus — c'est
 * la seule chose qui distingue une propriété d'un constat de première page.
 *
 * ─── LES DEUX SUBSTITUTS, MESURÉS ─────────────────────────────────────────
 *
 *     `${off_chain.case_id ?? mint.slice(0,8)}`
 *
 * Deux états servis, deux défauts distincts :
 *
 *   BOTIFY  (dossier legacy présent)  → CASE-2024-BOTIFY-001
 *                                        identité de citation NON FONDÉE
 *   VINE    (dossier legacy absent)   → 6AJcP7wu
 *                                        mint TRONQUÉ en substitut de citation
 *
 * Le second est plus insidieux : il a l'apparence d'un identifiant de dossier
 * dans l'emplacement d'un identifiant de dossier, alors que c'est un morceau de
 * l'adresse du sujet. Et VINE a un dossier gouverné — `IL-SHILL-VINE-001` —
 * que cet artefact ne cite pas.
 *
 * ─── PÉRIMÈTRE ────────────────────────────────────────────────────────────
 *
 * `/api/report/v2` reste un rapport de scan générique : il sert des mints SANS
 * dossier (le `no_casefile` de son booster TigerScore, l.36). On ne le ferme
 * PAS. La propriété porte sur l'IDENTITÉ DE CITATION : quand il en publie une,
 * elle dérive du ref gouverné ; quand il n'y en a pas, il n'en invente pas.
 *
 * `templateV2.ts` reste PASSIF et hors fenêtre : il imprime ce que l'appelant
 * lui donne. C'est l'appelant qu'on corrige.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { htmlCapture } = vi.hoisted(() => ({ htmlCapture: [] as string[] }));

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
    pair_age_days: null,
    data_unavailable: true,
    reason: null,
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/casefile/canonicalReader", () => ({
  loadCanonicalCaseFile: vi.fn(async (ref: string) => ({
    ref,
    codename: "TEST",
    ticker: "$TEST",
    title: "Dossier gouverné",
    claims: [],
    sources: [],
  })),
  assertProvenanceSurvives: () => {},
}));

import { GET } from "@/app/api/report/v2/route";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";
import {
  BOTIFY_CASEFILE_REF,
  VINE_CASEFILE_REF,
  VINE_MINT,
} from "@/lib/casefile/publicProjection";

const HISTORIQUE = /CASE-\d{4}-[A-Z0-9]+-\d+/;

/**
 * LA SONDE — le contenu textuel de CHAQUE pied, dans l'ordre du document.
 *
 * Elle rend une LISTE, jamais une concaténation : une concaténation
 * ré-autoriserait le raisonnement « il y est quelque part », qui est exactement
 * ce que la leçon TOTALITÉ interdit.
 */
export function piedsDeArtefact(html: string): string[] {
  return [...html.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

async function artefactPour(mint: string): Promise<string> {
  htmlCapture.length = 0;
  const res = await GET(
    new Request(`https://app.interligens.com/api/report/v2?mint=${mint}`) as never,
  );
  expect(htmlCapture.length, `aucun HTML rendu (statut ${res.status})`).toBe(1);
  return htmlCapture[0];
}

beforeEach(() => {
  htmlCapture.length = 0;
});

describe("S3 · C2 — PRÉALABLE : la sonde lit bien CHAQUE pied de l'artefact réel", () => {
  it("l'artefact est atteint et la sonde y trouve au moins un pied", async () => {
    const pieds = piedsDeArtefact(await artefactPour(BOTIFY_MINT));
    expect(
      pieds.length,
      "la sonde ne trouve AUCUN pied : elle est aveugle, pas satisfaite",
    ).toBeGreaterThan(0);
    // Le pied est bien l'emplacement de citation, pas une balise vide.
    expect(pieds.every((p) => p.length > 10)).toBe(true);
  });

  // ── APRÈS CORRECTION — les deux préalables deviennent l'ANTI-RÉGRESSION ──
  //
  // Ils assertaient les deux substituts SERVIS avant la fenêtre. Leur rôle
  // était de prouver que la sonde lisait bien l'emplacement de citation ; ce
  // rôle survit en épinglant les valeurs exactes qui ont été retirées.
  it("le substitut HISTORIQUE serait vu, et il a disparu du pied BOTIFY", async () => {
    // Non-cécité : la sonde le verrait s'il y était.
    expect(HISTORIQUE.test("NFA — CASE-2024-BOTIFY-001")).toBe(true);
    const pieds = piedsDeArtefact(await artefactPour(BOTIFY_MINT));
    expect(pieds.some((p) => HISTORIQUE.test(p))).toBe(false);
  });

  it("le MINT TRONQUÉ serait vu, et il a disparu du pied VINE qui cite désormais son dossier", async () => {
    const tronque = VINE_MINT.slice(0, 8);
    expect(tronque).toBe("6AJcP7wu"); // la valeur exacte qui était servie
    const pieds = piedsDeArtefact(await artefactPour(VINE_MINT));
    expect(pieds.some((p) => p.includes(tronque))).toBe(false);
    expect(VINE_CASEFILE_REF).toBe("IL-SHILL-VINE-001");
  });
});

describe("S3 · C2 — CRITÈRE : CHAQUE pied dérive du ref gouverné", () => {
  it("BOTIFY — tous les pieds portent le ref gouverné, aucun l'identité historique", async () => {
    const pieds = piedsDeArtefact(await artefactPour(BOTIFY_MINT));
    expect(pieds.length).toBeGreaterThan(0);
    for (const [i, pied] of pieds.entries()) {
      expect(pied, `pied #${i} ne cite pas le ref gouverné`).toContain(BOTIFY_CASEFILE_REF);
      expect(HISTORIQUE.test(pied), `pied #${i} porte encore l'identité historique`).toBe(false);
    }
  });

  it("VINE — tous les pieds citent le dossier gouverné, aucun le mint tronqué", async () => {
    const pieds = piedsDeArtefact(await artefactPour(VINE_MINT));
    const tronque = VINE_MINT.slice(0, 8);
    expect(pieds.length).toBeGreaterThan(0);
    for (const [i, pied] of pieds.entries()) {
      expect(pied, `pied #${i} ne cite pas le ref gouverné`).toContain(VINE_CASEFILE_REF);
      expect(pied.includes(tronque), `pied #${i} substitue le mint tronqué`).toBe(false);
    }
  });
});

describe("S3 · C2 — MUTANT : un SECOND pied dévie, et la garde meurt dessus", () => {
  const DEUX_PIEDS = `
    <html><body>
      <div class="page">
        <footer class="footer"><span>INTERLIGENS</span><span>NFA — IL-SHILL-BOTIFY-001</span></footer>
      </div>
      <div class="page">
        <footer class="footer"><span>INTERLIGENS</span><span>NFA — CASE-2024-BOTIFY-001</span></footer>
      </div>
    </body></html>`;

  it("la sonde énumère les DEUX pieds — elle ne s'arrête pas au premier", () => {
    expect(piedsDeArtefact(DEUX_PIEDS)).toHaveLength(2);
  });

  it("le premier pied est CONFORME, et cela ne sauve pas l'artefact", () => {
    const pieds = piedsDeArtefact(DEUX_PIEDS);
    // Une garde de première page serait VERTE ici.
    expect(pieds[0]).toContain(BOTIFY_CASEFILE_REF);
    // La garde universelle, elle, voit le second.
    expect(pieds.every((p) => !HISTORIQUE.test(p))).toBe(false);
  });

  it("CONTRÔLE NÉGATIF — les DEUX pieds conformes, la garde est verte", () => {
    const pieds = piedsDeArtefact(
      DEUX_PIEDS.replace("CASE-2024-BOTIFY-001", BOTIFY_CASEFILE_REF),
    );
    expect(pieds).toHaveLength(2);
    expect(pieds.every((p) => p.includes(BOTIFY_CASEFILE_REF) && !HISTORIQUE.test(p))).toBe(true);
  });

  it("un artefact SANS pied ne satisfait pas la garde par le vide", () => {
    // `every` sur une liste vide est VRAI. La garde exige donc d'abord qu'il y
    // ait un pied — sans quoi supprimer le pied ferait passer le critère.
    const pieds = piedsDeArtefact("<html><body><p>rien</p></body></html>");
    expect(pieds).toEqual([]);
    expect(pieds.every((p) => p.includes(BOTIFY_CASEFILE_REF))).toBe(true); // le piège
    expect(pieds.length > 0).toBe(false); // la garde qui le referme
  });
});
