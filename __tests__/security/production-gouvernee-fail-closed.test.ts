// __tests__/security/production-gouvernee-fail-closed.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// E-RC · LEASE A — LA GARDE DE FORME, ET SES DENTS
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  RÉINTRODUIRE LE FLUX DIRECT DOIT FAIRE MOURIR UN TEST.               ██
//
// Le correctif n'est PAS appliqué : `src/app/api/pdf/casefile/route.ts` est un
// chemin GELÉ, et la lease A n'est pas ouverte. Ce fichier tient donc DEUX
// choses à la fois, et les tient séparées :
//
//   · la CIBLE (docs/prep/patches/E-RC-lease-A/route.ts.cible) est PROPRE ;
//   · la route SERVIE porte encore le trou, et le CLIQUET le compte.
//
// Le jour où la lease s'ouvre, appliquer le patch fait basculer le cliquet de
// 4 à 0 — et ce basculement est ce qui prouve que le correctif a mordu.
//
// ⚠️ UNE GARDE VERTE QUI N'A JAMAIS RIEN ATTRAPÉ EST INDISCERNABLE D'UNE
// GARDE QUI NE PEUT RIEN ATTRAPER. Les mutants du §C sont la seule raison
// pour laquelle le zéro de la cible est une MESURE et non un silence.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE_SERVIE = "src/app/api/pdf/casefile/route.ts";
const CIBLE = "docs/prep/patches/E-RC-lease-A/route.ts.cible";
const PATCH = "docs/prep/patches/E-RC-lease-A/E-RC-lease-A-src-app-api-pdf-casefile-route.ts.patch";

/**
 * LA GARDE LIT LE CODE, PAS LA PROSE.
 *
 * Sans cela, elle attrapait sa propre documentation : la cible EXPLIQUE en
 * commentaire le repli qu'elle supprime — « R2 down → fallback stream
 * direct » — et une garde textuelle ne distingue pas décrire de faire. Une
 * garde qui interdit de NOMMER le défaut qu'on vient de fermer pousse à
 * effacer l'explication, donc à perdre la raison du correctif.
 *
 * Les CHAÎNES restent, elles : `console.warn("… falling back to stream")` est
 * du code, et c'est un signal qu'on veut attraper. C'est la forme employée
 * ailleurs dans la suite (s9, s11, s17).
 */
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const lire = (p: string) => codeSeul(readFileSync(p, "utf8"));
/** Le patch se lit BRUT : ses marqueurs de diff ne sont pas du code à filtrer. */
const lireBrut = (p: string) => readFileSync(p, "utf8");

/**
 * Les formes par lesquelles un artefact gouverné peut sortir SANS être
 * enregistré. Elles ne sont pas une liste de mots interdits : chacune est un
 * CHEMIN, mesuré sur la route servie avant le correctif.
 */
const FORMES_HORS_REGISTRE: ReadonlyArray<readonly [string, RegExp]> = [
  ["corps PDF servi directement", /new\s+NextResponse\s*\(\s*pdfBuf/],
  ["en-tête de téléchargement d'artefact", /"Content-Disposition"\s*:/],
  ["repli explicite sur échec de stockage", /falling back to stream|fallback stream direct/i],
  ["l'environnement décide de l'autorité", /if\s*\(\s*isStorageEnabled\s*\(\s*\)\s*\)/],
];

function formesTrouvees(source: string): string[] {
  return FORMES_HORS_REGISTRE.filter(([, re]) => re.test(source)).map(([nom]) => nom);
}

// ─── A · LA CIBLE EST PROPRE ─────────────────────────────────────────────

describe("A — la cible du correctif ne porte AUCUN chemin hors registre", () => {
  it("les quatre formes ont disparu", () => {
    expect(formesTrouvees(lire(CIBLE))).toEqual([]);
  });

  it("elle appelle la primitive, et rend le refus NOMMÉ", () => {
    const cible = lire(CIBLE);
    expect(cible).toContain("produireArtefactGouverne");
    expect(cible).toContain("governed_production_unavailable");
    // 503 et non 500 : le PDF a été rendu, c'est l'autorité qui manque.
    expect(cible).toContain("status: production.statutHttp");
    expect(cible).not.toContain('from "@/lib/storage/pdfStorage"');
  });

  it("elle rend l'identifiant de registre avec l'artefact", () => {
    // Ce qui rend la démonstration dicible à un cabinet : l'artefact remis
    // porte le lien vers la ligne d'autorité qui le fonde.
    expect(lire(CIBLE)).toContain("registreId: production.registreId");
  });

  it("le patch livré correspond EXACTEMENT à la cible", () => {
    // Sans cette assertion, la cible et le patch pourraient diverger, et la
    // fenêtre appliquerait autre chose que ce qui a été prouvé ici.
    const patch = lireBrut(PATCH);
    expect(patch).toContain("a/src/app/api/pdf/casefile/route.ts");
    expect(patch).toContain("b/src/app/api/pdf/casefile/route.ts");
    expect(patch).toContain("+import { produireArtefactGouverne }");
    expect(patch).toContain("-    return new NextResponse(pdfBuf, {");
  });
});

// ─── B · LE CLIQUET SUR LA ROUTE SERVIE ──────────────────────────────────

describe("B — CLIQUET : le trou de la route servie est COMPTÉ, pas oublié", () => {
  it("les quatre formes y sont ENCORE — la lease A n'est pas ouverte", () => {
    // Ce test est VOLONTAIREMENT rouge-en-puissance : il devient faux le jour
    // où le patch est appliqué, et c'est exactement ce qu'on veut lire ce
    // jour-là. Un cliquet qui ne bouge pas quand le défaut se referme
    // n'aurait mesuré rien.
    expect(formesTrouvees(lire(ROUTE_SERVIE))).toEqual([
      "corps PDF servi directement",
      "en-tête de téléchargement d'artefact",
      "repli explicite sur échec de stockage",
      "l'environnement décide de l'autorité",
    ]);
  });

  it("et la dépendance à la variable d'environnement y est encore lisible", () => {
    expect(lire(ROUTE_SERVIE)).toContain("isStorageEnabled()");
  });
});

// ─── C · LES MUTANTS — la garde a-t-elle des dents ? ─────────────────────
//
// Corpus SYNTHÉTIQUES : démontrer qu'une garde attrape une violation ne doit
// pas exiger d'introduire la violation dans le dépôt.

describe("C — MUTANTS : réintroduire le flux direct FAIT MOURIR le test", () => {
  const cible = lire(CIBLE);

  it("LE MUTANT DÉCISIF — le repli en flux direct, remis tel quel", () => {
    const mutant =
      cible +
      `
    // mutant : le repli d'avant, remis
    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": \`attachment; filename="x.pdf"\`,
      },
    });
`;
    expect(formesTrouvees(mutant)).toContain("corps PDF servi directement");
    expect(formesTrouvees(mutant)).toContain("en-tête de téléchargement d'artefact");
    // Et la garde de la cible, appliquée au mutant, N'EST PLUS VERTE.
    expect(formesTrouvees(mutant)).not.toEqual([]);
  });

  it.each([
    ["l'environnement redevient une condition", "    if (isStorageEnabled()) {\n      doSomething();\n    }"],
    ["le repli revient par son commentaire", '    console.warn("R2 upload failed, falling back to stream");'],
    ["le corps est servi sous un autre nom de variable", '    return new NextResponse(pdfBuf, { headers: {} });'],
  ])("mutant attrapé : %s", (_nom, ligne) => {
    expect(formesTrouvees(cible + "\n" + ligne)).not.toEqual([]);
  });

  it("la garde ne crie PAS sur une modification sans rapport", () => {
    // Une garde qui rougit sur une édition sans rapport est une garde qu'on
    // désarme. Elle doit être sensible à ce qui compte, et sourde au reste.
    const inoffensif = cible + '\n    console.log("trace ajoutée sans rapport");\n';
    expect(formesTrouvees(inoffensif)).toEqual([]);
  });
});

// ─── D · LA PRIMITIVE, ET SON ARGUMENT DE FORME ──────────────────────────

describe("D — la décision vit dans la primitive, pas dans la route", () => {
  it("la primitive lit elle-même l'environnement, et le REFUSE", () => {
    const src = lire("src/lib/storage/registre/production.ts");
    expect(src).toContain("isStorageEnabled()");
    expect(src).toContain("STOCKAGE_GOUVERNE_INDISPONIBLE");
    // Aucune variante « voici le PDF, mais hors registre » n'existe dans le
    // type de retour : un appelant ne peut pas se tromper en la lisant mal.
    expect(src).not.toMatch(/produit:\s*false[^}]*signedUrl/);
  });

  it("aucun second client S3 n'est ouvert dans le périmètre gouverné", () => {
    // Un second client est un chemin d'écriture qui ne peut STRUCTURELLEMENT
    // pas être vu par une garde posée sur la primitive. La clé fabriquée
    // était visible à la relecture ; le client, non.
    for (const f of [
      "src/lib/casefile/pdfGenerator.ts",
      "src/lib/storage/registre/production.ts",
      CIBLE,
    ]) {
      expect(lire(f), f).not.toContain("new S3Client");
    }
  });
});
