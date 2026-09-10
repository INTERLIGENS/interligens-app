// ─── BUILD 13 · S1 — LA RÉFÉRENCE DE DOSSIER NE SE DÉRIVE PAS DE L'HORLOGE ─
//
// ██  Une référence exposée pour la citation est une IDENTITÉ DE DOSSIER,   ██
// ██  pas un libellé de présentation.                                       ██
//
// ─── CLÔTURE — la cause est retirée ───────────────────────────────────────
//
//   src/app/api/scan/solana/route.ts rendait
//   case_id.replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`)
//
// La route SERVANTE remplaçait l'année du dossier par l'année COURANTE à
// l'instant de la requête. La référence imprimée sur la pièce changeait donc
// CHAQUE 1ᵉʳ JANVIER, ce qui invalidait RÉTROACTIVEMENT toute citation déjà
// émise. La route rend désormais la valeur stockée, sans la toucher.
//
// ─── CE QUE CE CORPUS PROUVE ──────────────────────────────────────────────
//
// Sur la ROUTE RÉELLE, sous HORLOGE INJECTÉE, contre le DOSSIER RÉEL :
//
//   la référence SERVIE est IDENTIQUE sous 2026 et sous 2027,
//   ET ÉGALE À LA VALEUR STOCKÉE du dossier.
//
// Le critère est un ET, et aucune moitié ne suffit. « Identique entre deux
// horloges » seul serait tenu par n'importe quelle constante. « Égal au
// stocké » seul serait tenu douze mois durant par la réécriture elle-même,
// dès lors que le stocké porte déjà l'année courante — c'est précisément ce
// qui a permis au défaut de survivre. D'où la preuve par MUTATION TEMPORELLE,
// et non par comparaison de même année.
//
// ─── CE QUE CE CORPUS S'INTERDIT DE PROUVER ───────────────────────────────
//
// Rien sur l'AUTORITÉ. La référence restaurée est la VALEUR STOCKÉE de ce
// dossier — `data/cases/botify.json`, `case_meta.opened_at = 2024-11-01` — et
// c'est tout ce que ce fichier en dit. Ce dépôt porte CINQ espaces de nommage
// pour le même dossier, dont celui des surfaces canoniques
// (`src/lib/.../publicProjection.ts`, `BOTIFY_CASEFILE_REF`) qui n'a même pas
// la forme `CASE-*`.
//
// Prouver que la réécriture a disparu n'ÉLIT pas la valeur restaurée comme
// identité gouvernée : EXCLUSION ≠ ELECTION, dans ce sens-là aussi. La
// question de l'autorité reste OUVERTE, et ce corpus ne la tranche pas.
//
// ⚠ Aucune référence complète n'est écrite en clair ici : la valeur stockée
// est LUE dans le dossier, les autres années sont CONSTRUITES. Un recensement
// qui découvre les porteurs en balayant les sources compterait sinon ce corpus
// comme un porteur de plus — c'est exactement ce qui est arrivé au recensement
// de T2, perturbé par un commentaire qui ne faisait que CITER les valeurs.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTE = "src/app/api/scan/solana/route.ts";
const DOSSIER_PATH = "data/cases/botify.json";

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

/** Le dossier RÉEL — celui que `loadCaseByMint` lit, pas une fixture. */
const DOSSIER = JSON.parse(readFileSync(DOSSIER_PATH, "utf8")) as {
  case_meta: { case_id: string; opened_at: string };
};

/** La VALEUR STOCKÉE. Lue. Ce corpus ne la réécrit ni ne l'élit. */
const STOCKE = DOSSIER.case_meta.case_id;
const ref = (an: number) => STOCKE.replace(/CASE-\d{4}-/, `CASE-${an}-`);

// `loadCaseByMint` n'est PAS simulé : il lit `data/cases/` en fs pur. La chaîne
// prouvée va donc du DOSSIER STOCKÉ à la RÉFÉRENCE SERVIE, sans fixture entre
// les deux. Seuls les accès réseau/DB de la route sont neutralisés.
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

/** Le mint canonique BOTIFY — celui sur lequel `MINT_TO_CASE` est indexé. */
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

describe("S1/v1 — CLÔTURE : la référence servie ne se dérive plus de l'horloge", () => {
  it("CRITÈRES 1 & 2 — deux années injectées, UNE référence, et c'est la stockée", async () => {
    const a = await servieEn(2026);
    const b = await servieEn(2027);
    // Le ET, en deux assertions : stable entre horloges…
    expect(a).toBe(b);
    // …et non pas stable sur une valeur inventée.
    expect(a).toBe(STOCKE);
  });

  it("la valeur stockée est FONDÉE — son année est celle de l'ouverture du dossier", async () => {
    // Ceci qualifie le STOCKAGE, pas l'autorité : l'année portée par la valeur
    // stockée correspond à `opened_at`. C'est l'horloge qui falsifiait.
    const anStocke = STOCKE.match(/^CASE-(\d{4})-/)?.[1];
    expect(anStocke).toBe(DOSSIER.case_meta.opened_at.slice(0, 4));
    expect(DOSSIER.case_meta.opened_at).toBe("2024-11-01T00:00:00Z");
    // Et la servie n'est plus l'année de la requête.
    expect(await servieEn(2026)).not.toBe(ref(2026));
  });

  it("ANCRE DE CAUSE — la réécriture n'est plus dans la route servante", () => {
    expect(readFileSync(ROUTE, "utf8")).not.toContain("new Date().getFullYear()");
  });

  it("CRITÈRE 3 — aucune dérivation d'année courante ne subsiste dans le chemin d'identité", () => {
    // La garde lit le CODE, pas la prose : deux commentaires de ce dépôt citent
    // la ligne retirée mot pour mot — dont le mien, dans `pdfGenerator.ts`. Une
    // garde qui balaie le texte brut les compterait comme des porteurs, et
    // c'est exactement l'erreur qui a fait rougir le recensement de T2.
    const porteurs = fichiersSource("src").filter((f) =>
      /CASE-\$\{[^}]*getFullYear\(\)/.test(codeSeul(readFileSync(f, "utf8"))),
    );
    expect(porteurs).toEqual([]);
  });
});

describe("S1/v2 — CRITÈRE 4 : le mutant mord sur la référence RÉELLEMENT SERVIE", () => {
  // Les mutants ne s'appliquent pas à une fixture : ils enveloppent ce que la
  // route SERT. Réintroduire la réécriture par-dessus la sortie réelle doit
  // tuer le critère.
  const MUTANTS: Array<{ nom: string; servant: (s: string, a: number) => string }> = [
    {
      nom: "LE DÉFAUT RETIRÉ — l'année vient de l'horloge",
      servant: (s, a) => s.replace(/CASE-\d{4}-/, `CASE-${a}-`),
    },
    {
      nom: "PLUS SUBTIL — l'horloge ne s'applique qu'au-delà d'une année pivot",
      // Passerait tout test écrit avant le pivot. C'est la forme qui a survécu
      // ici : une réécriture annuelle paraît stable dans l'année.
      servant: (s, a) => (a >= 2027 ? s.replace(/CASE-\d{4}-/, `CASE-${a}-`) : s),
    },
    {
      nom: "SUR-CORRECTION — la référence est remplacée par un identifiant neuf",
      servant: () => `CASE-0000-BOTIFY-${Math.random()}`,
    },
  ];

  const critere = (a: string | null, b: string | null) => a === b && a === STOCKE;

  it("TÉMOIN — la route non mutée tient le critère", async () => {
    expect(critere(await servieEn(2026), await servieEn(2027))).toBe(true);
  });

  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, async () => {
      const a = m.servant((await servieEn(2026))!, 2026);
      const b = m.servant((await servieEn(2027))!, 2027);
      expect(critere(a, b)).toBe(false);
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
    // MESURÉ : le CONTOURNEMENT aval de l'explorer ne porte sa référence …-2026-…
    // qu'en PROSE, pour documenter la valeur synthétique qu'il compensait ; son
    // CODE ne connaît qu'un motif `^CASE-\d{4}-(.+?)-\d+$`. Il est donc
    // invisible à un balayage du code seul — et il reste hors périmètre de
    // toute façon : il compense la réécriture ET franchit un autre espace de
    // nommage (formes courtes `BOTIFY-MAIN`, `BOTIFY`), que retirer la cause ne
    // résout pas. Retirer la cause ≠ retirer le contournement.
    const trouve = [
      ...new Set(
        [...fichiersSource("src"), DOSSIER_PATH].flatMap(
          (f) => codeSeul(readFileSync(f, "utf8")).match(/CASE-[0-9]{4}-BOTIFY-[0-9]+/g) ?? [],
        ),
      ),
    ];
    expect(trouve).toEqual([STOCKE]);
  });
});
