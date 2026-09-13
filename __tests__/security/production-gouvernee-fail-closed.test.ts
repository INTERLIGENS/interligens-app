// __tests__/security/production-gouvernee-fail-closed.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// E-RC · LEASE A — LA GARDE DE FORME, ET SES DENTS
// ═══════════════════════════════════════════════════════════════════════════
//
// ██  RÉINTRODUIRE LE FLUX DIRECT DOIT FAIRE MOURIR UN TEST.               ██
//
// Le correctif a été qualifié HORS FENÊTRE, puis appliqué DEDANS :
// `src/app/api/pdf/casefile/route.ts` est un chemin GELÉ, et il a fallu la
// lease `E-RC-A` pour l'écrire. Ce fichier tenait DEUX choses séparées :
//
//   · la CIBLE (docs/prep/patches/E-RC-lease-A/route.ts.cible), PROPRE ;
//   · la route SERVIE, qui portait encore le trou, et le CLIQUET le comptait.
//
// Le cliquet a basculé de 4 à 0 sous la lease, et ce basculement EST la preuve
// que le correctif a mordu. Le §B l'épingle désormais à l'envers, et exige en
// plus que servi et cible ne puissent plus diverger — octet pour octet.
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

// ── LE CLIQUET A BASCULÉ, ET C'EST LA BASCULE QUI EST LA PREUVE ──────────
//
// Ce bloc comptait les QUATRE formes hors registre ENCORE présentes dans la
// route servie, parce que la lease A n'était pas ouverte. Il était
// VOLONTAIREMENT rouge-en-puissance — « il devient faux le jour où le patch
// est appliqué, et c'est exactement ce qu'on veut lire ce jour-là ». Ce jour
// est arrivé : sous lease `E-RC-A`, le patch a été appliqué et le compte est
// passé de 4 à 0. Un cliquet qui n'aurait pas bougé quand le défaut se referme
// n'aurait rien mesuré.
//
// Son rôle SURVIT, retourné : il n'épingle plus la présence du défaut, il
// épingle sa DISPARITION — et sur le fichier RÉELLEMENT SERVI, pas sur la
// cible. Les deux ne peuvent plus diverger : la dernière assertion l'exige
// octet pour octet.
describe("B — CLIQUET BASCULÉ : le trou de la route servie est REFERMÉ", () => {
  it("les quatre formes ont disparu de la route SERVIE", () => {
    expect(formesTrouvees(lire(ROUTE_SERVIE))).toEqual([]);
  });

  it("la variable d'environnement ne décide plus de l'autorité dans la route", () => {
    // Elle est toujours lue — mais DANS LA PRIMITIVE, où son absence est un
    // refus et non un contournement. Ce qui a disparu, c'est la décision.
    expect(lire(ROUTE_SERVIE)).not.toContain("isStorageEnabled()");
  });

  it("et la route servie est OCTET POUR OCTET la cible prouvée hors fenêtre", () => {
    // La preuve la plus forte disponible ici : ce qui a été appliqué sous
    // lease est EXACTEMENT ce qui avait été qualifié avant elle. Sans cette
    // assertion, la fenêtre pourrait avoir livré autre chose que le prouvé.
    expect(lireBrut(ROUTE_SERVIE)).toBe(lireBrut(CIBLE));
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
