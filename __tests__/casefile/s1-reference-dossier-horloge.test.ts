// ─── BUILD 13 · S1 — LA RÉFÉRENCE DE DOSSIER NE SE DÉRIVE PAS DE L'HORLOGE ─
//
// ██  Une référence exposée pour la citation est une IDENTITÉ DE DOSSIER,   ██
// ██  pas un libellé de présentation.                                       ██
//
// ─── Le défaut, et pourquoi il ne se voit pas ─────────────────────────────
//
//   src/app/api/scan/solana/route.ts:184
//   case_id.replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`)
//
// La route SERVANTE remplace l'année du dossier par l'année COURANTE à
// l'instant de la requête. Le dossier stocké porte l'année 2024 — et cette
// valeur est FONDÉE : `case_meta.opened_at = 2024-11-01T00:00:00Z`. Servi en
// 2026 il devient …-2026-…, et le 1ᵉʳ janvier 2027 il deviendra …-2027-…
//
// La référence imprimée sur la pièce change donc CHAQUE 1ᵉʳ JANVIER, ce qui
// invalide RÉTROACTIVEMENT toute citation déjà émise. Et le défaut est
// invisible à tout test écrit dans l'année : comparer le stocké au servi sous
// l'HORLOGE RÉELLE passerait douze mois durant, dès lors que le stocké porte
// déjà l'année courante.
//
// D'où l'exigence : HORLOGE INJECTÉE, deux années, sur la ROUTE RÉELLE.
// Une preuve par MUTATION TEMPORELLE, pas une comparaison de même année.
//
// ─── L'état de ce corpus ──────────────────────────────────────────────────
//
// La cause vit dans un CHEMIN GELÉ. Ce fichier CONSTATE donc aujourd'hui, et
// il est écrit pour basculer en CLÔTURE d'une seule ligne le jour où la
// fenêtre s'ouvre : le bloc `v2` porte déjà le critère sur le modèle corrigé,
// et il passe. C'est la forme retenue en S8, et pour la même raison.
//
// ⚠ Aucune référence complète `CASE-<année>-<DOSSIER>-<n>` n'est écrite en
// clair dans ce fichier : elles sont CONSTRUITES. Un recensement qui découvre
// les porteurs en balayant les sources compterait sinon ce corpus comme un
// porteur de plus — c'est exactement ce qui est arrivé au recensement de T2,
// perturbé par un commentaire qui ne faisait que CITER les valeurs.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTE = "src/app/api/scan/solana/route.ts";

/** Les sources de production, tests exclus. */
function fichiersSource(racine: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(racine)) {
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSource(p));
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** Le code seul : une garde ne doit jamais lire un commentaire. */
const codeSeul = (src: string): string =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
const ref = (an: number) => `CASE-${an}-BOTIFY-001`;
const STOCKE = ref(2024);

vi.mock("@/lib/security/rateLimit", async (orig) => {
  const real = (await orig()) as typeof import("@/lib/security/rateLimit");
  return { ...real, checkRateLimit: async () => ({ allowed: true, remaining: 99 }) };
});
vi.mock("@/lib/vault/vaultLookup", () => ({ vaultLookup: async () => null }));
vi.mock("@/lib/rpc", () => ({ rpcCall: async () => ({ error: "offline" }) }));
vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: async () => ({ data_unavailable: true, url: null, cache_hit: false, source: null }),
}));
vi.mock("@/lib/events/producer", () => ({ emitScanCompleted: async () => undefined }));
vi.mock("@/lib/caseDb", () => ({
  loadCaseByMint: () => ({
    case_meta: {
      case_id: "CASE-2024-BOTIFY-001",
      opened_at: "2024-11-01T00:00:00Z",
      status: "Investigating",
      summary: "fixture",
      ticker: "$BOTIFY",
      severity: "HIGH",
    },
    claims: [],
    sources: [],
  }),
}));

const MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";

/** La référence SERVIE par la route réelle, sous une horloge choisie. */
async function servieEn(annee: number): Promise<string | null> {
  vi.setSystemTime(new Date(`${annee}-06-15T12:00:00Z`));
  vi.resetModules();
  const { GET } = await import("@/app/api/scan/solana/route");
  const res = await GET(new Request(`http://localhost:3100/api/scan/solana?mint=${MINT}`) as never);
  const body = await res.json();
  return body?.off_chain?.case_id ?? null;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("S1/v1 — CONSTAT : la référence servie est dérivée de l'horloge", () => {
  it("COMPORTEMENTAL — deux années injectées, DEUX références pour un dossier", async () => {
    const a = await servieEn(2026);
    const b = await servieEn(2027);
    expect(a).toBe(ref(2026));
    expect(b).toBe(ref(2027));
    // C'est le défaut : le 1ᵉʳ janvier, la pièce citée cesse d'être reconnue.
    expect(a).not.toBe(b);
  });

  it("et AUCUNE des deux n'est la valeur stockée, qui est pourtant la seule fondée", async () => {
    // `opened_at = 2024-11-01` : l'année stockée correspond à l'ouverture réelle
    // du dossier. C'est l'horloge qui falsifie, pas le stockage.
    expect(await servieEn(2026)).not.toBe(STOCKE);
    expect(JSON.parse(readFileSync("data/cases/botify.json", "utf8")).case_meta.opened_at)
      .toBe("2024-11-01T00:00:00Z");
  });

  it("ANCRE DE CAUSE — la réécriture est encore dans la route servante", () => {
    // Cette assertion BASCULE le jour où la fenêtre s'ouvre : elle deviendra
    // `not.toContain`, et `v2` deviendra le comportement de la route réelle.
    expect(readFileSync(ROUTE, "utf8")).toContain("new Date().getFullYear()");
  });

  it("BORNE — c'est la SEULE réécriture d'année du dépôt", () => {
    // La garde lit le CODE, pas la prose. Deux commentaires de ce dépôt citent
    // la ligne fautive mot pour mot — dont le mien, dans `pdfGenerator.ts`. Une
    // garde qui balaie le texte brut les compterait comme des porteurs, et
    // c'est exactement l'erreur qui a fait rougir le recensement de T2.
    const porteurs = fichiersSource("src").filter((f) =>
      /CASE-\$\{[^}]*getFullYear\(\)/.test(codeSeul(readFileSync(f, "utf8"))),
    );
    expect(porteurs).toEqual([ROUTE]);
  });
});

describe("S1/v2 — CRITÈRE : servir n'est pas renommer", () => {
  // Le modèle CORRIGÉ — la route rend la référence stockée, sans la toucher.
  const servantCorrige = (stocke: string, _annee: number) => stocke;

  it("TÉMOIN — deux horloges, une seule référence, et c'est la stockée", () => {
    const a = servantCorrige(STOCKE, 2026);
    const b = servantCorrige(STOCKE, 2027);
    expect(a).toBe(b);
    expect(a).toBe(STOCKE);
  });

  const MUTANTS: Array<{ nom: string; servant: (s: string, a: number) => string }> = [
    {
      nom: "LE DÉFAUT ACTUEL — l'année vient de l'horloge",
      servant: (s, a) => s.replace(/CASE-\d{4}-/, `CASE-${a}-`),
    },
    {
      nom: "PLUS SUBTIL — l'horloge ne s'applique qu'au-delà d'une année pivot",
      // Passerait tous les tests écrits avant le pivot. C'est la forme qui a
      // survécu ici : une réécriture annuelle paraît stable dans l'année.
      servant: (s, a) => (a >= 2027 ? s.replace(/CASE-\d{4}-/, `CASE-${a}-`) : s),
    },
    {
      nom: "SUR-CORRECTION — la référence est remplacée par un identifiant neuf",
      servant: () => `CASE-0000-BOTIFY-${Math.random()}`,
    },
  ];

  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const a = m.servant(STOCKE, 2026);
      const b = m.servant(STOCKE, 2027);
      // Le critère est un ET : identique entre horloges, ET égal au stocké.
      expect(a === b && a === STOCKE).toBe(false);
    });
  }
});

describe("S1/v3 — les consommateurs dérivent de l'autorité, ils ne la redéclarent pas", () => {
  it("le preset porte l'année FONDÉE, pas une année figée à l'écriture", () => {
    expect(readFileSync("src/lib/casefile/presets.ts", "utf8")).toContain(STOCKE);
  });

  it("et le libellé de l'écran de génération ne montre plus une référence périmée", () => {
    expect(readFileSync("src/app/admin/casefile-generator/page.tsx", "utf8")).toContain(STOCKE);
  });

  it("aucune année figée concurrente ne subsiste pour ce dossier", () => {
    const trouve = [
      ...new Set(
        [...fichiersSource("src"), "data/cases/botify.json"].flatMap(
          (f) => codeSeul(readFileSync(f, "utf8")).match(/CASE-[0-9]{4}-BOTIFY-[0-9]+/g) ?? [],
        ),
      ),
    ];
    // 2026 subsiste dans le CONTOURNEMENT aval, qui documente la valeur
    // synthétique qu'il compense — il est hors de cette fenêtre, et il masque
    // un QUATRIÈME espace de nommage (formes courtes `BOTIFY-MAIN`, `BOTIFY`)
    // que retirer la cause ne résoudra pas.
    expect(trouve.filter((r) => r !== STOCKE && r !== ref(2026))).toEqual([]);
  });
});
