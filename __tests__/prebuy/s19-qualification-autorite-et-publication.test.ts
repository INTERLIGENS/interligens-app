// ─── BUILD 12 · S19 — CONSUMED ≠ FOUNDED, QUALIFIÉ EN HUIT POINTS ─────────
//
// ██  AG3 · qualifier IL-SHILL-BOTIFY-001 / IL-SHILL-VINE-001              ██
// ██  AG4 · l'autorité VISUELLE contredit l'autorité GOUVERNÉE             ██
//
// Porte ratifiée :
//   « A governed CaseFile identity must be founded by an explicit identity
//     rule, not merely by prevalence of consumption. CONSUMED != FOUNDED. »
//
// S18 avait mesuré que la constante n'est pas l'autorité mais une CLÉ DE
// LECTURE. Restait la question que cela ouvre, et qui est la vraie : celle
// qu'elle désigne en est-elle une ? Huit points, traduits en mesures.
//
// ─── 1 · ORIGINE — un littéral écrit à la main, DEUX FOIS ──────────────
//
//   Recherche par CAPACITÉ (qui écrit dans `TokenCaseFile`), pas par nom :
//     · `prisma.tokenCaseFile.upsert` — prisma/seed-lab.ts:470 (IL-PND-LAB-001)
//     · `INSERT INTO token_casefiles` — scripts/casefile/generate-migration-sql.mjs:68
//     · `UPDATE token_casefiles`      — le même script, l. 148
//   Et rien d'autre. Aucune route, aucun service, aucun back-office n'écrit
//   dans cette colonne.
//
//   La valeur `IL-SHILL-BOTIFY-001` est donc SAISIE : un littéral en tête du
//   générateur (l. 24), émis dans un SQL joué à la main. Elle n'est dérivée de
//   rien — ni du mint, ni du codename, ni de la famille.
//
//   ET LA DÉCOUVERTE A RENDU UN CINQUIÈME REF, que je n'attendais pas :
//   `IL-CONC-BLACKBULL-001`. Il n'apparaît que dans un post-check du
//   générateur, qui LIT la ligne — le script dit lui-même que
//   « token_casefiles ne porte que BLACKBULL et LAB ». LAB a son seed.
//   BLACKBULL n'a RIEN : ni seed, ni INSERT, ni script. La colonne
//   d'identité contient donc au moins une valeur dont le dépôt ne peut pas
//   rendre compte de la création. Pour un point « ORIGINE », c'est plus grave
//   que l'absence de règle : la règle est absente pour une valeur DÉJÀ EN
//   BASE, et servie.
//
//   ET ELLE EXISTE EN DEUX EXEMPLAIRES INDÉPENDANTS. Le littéral n'apparaît
//   que dans deux fichiers, et ce sont les deux bouts de la chaîne :
//     · `publicProjection.ts`            — la clé de LECTURE
//     · `generate-migration-sql.mjs`     — la valeur ÉCRITE
//   Aucune constante partagée ne les relie : un script `.mjs` ne peut pas
//   importer la constante TypeScript. Les deux bouts s'accordent À LA MAIN.
//   Une identité dont la clé de lecture et la valeur écrite sont deux
//   littéraux distincts n'a pas de source unique — elle a une coïncidence
//   entretenue.
//
// ─── 2 · SEGMENTS — trois conventions qui se contredisent ──────────────
//
//   `IL` / `SHILL` / `BOTIFY` / `001`. La question n'est pas ce que les
//   segments veulent dire, c'est s'il existe une RÈGLE. Mesuré sur la
//   colonne `family`, pour les cinq refs découverts :
//
//     IL-SHILL-BOTIFY-001   family = 'SHILL'            segment = la famille
//     IL-SHILL-VINE-001     family = 'SHILL'            segment = la famille
//     IL-PND-LAB-001        family = 'pump_and_dump'    segment = abréviation
//     IL-PON-CBEX-001       family = 'platform_fraud'   segment = ni l'un ni
//                                                       l'autre
//     IL-CONC-BLACKBULL-001 family = INCONNUE           rien à comparer :
//                                                       la ligne préexiste au
//                                                       dépôt (voir point 1)
//
//   Ce n'est pas une convention non écrite : ce sont TROIS conventions non
//   écrites et mutuellement incompatibles, plus un cas où la question ne peut
//   même pas se poser. Et aucune n'est vérifiée nulle part — le seul motif qui
//   contraigne la forme dans tout le dépôt vit dans NOS PROPRES TESTS.
//
// ─── 3 · UNICITÉ — contrainte, et c'est le seul point qui tient ────────
//
//   `ref String @unique` (schema.prod.prisma:709, et :669 pour la table des
//   plateformes). Ce n'est pas un espoir : c'est une contrainte en base.
//
// ─── 4 · STABILITÉ — tient en pratique, non close par construction ─────
//
//   Aucun `SET ref` nulle part. L'INSERT du générateur porte
//   `ON CONFLICT (ref) DO NOTHING` — le rejouer ne réécrit rien.
//   MAIS : le seul chemin `upsert` du dépôt passe `update: data` où `data`
//   CONTIENT `ref`. Ici la clé du `where` et `data.ref` sont la même
//   constante, donc rien ne bouge. C'est une stabilité par coïncidence de
//   littéral, pas par exclusion de la colonne d'identité du payload de
//   mise à jour. La distinction compte : la seconde se démontre, la première
//   se relit.
//
// ─── 5 · RÈGLE DE CRÉATION — il n'y en a pas ───────────────────────────
//
//   Pour un dossier N+1, qui choisit `002` ? Mesuré : aucun constructeur,
//   aucun allocateur, aucun compteur, aucun validateur de forme dans
//   `src/`, `prisma/` ni `scripts/`. Pas une seule concaténation qui produise
//   un `IL-*`. Les cinq refs découverts sont cinq littéraux saisis, et tous
//   les cinq se terminent par `001` : le suffixe n'a jamais été exercé, donc
//   son absence d'allocateur n'a jamais été éprouvée.
//   Une règle qui n'existe nulle part n'est pas une règle.
//
// ─── 6 · RÈGLE DE MUTATION — rien ne lie la nature au ref ──────────────
//
//   Si un dossier change de famille, le ref suit-il ? Mesuré : `family` est
//   une colonne libre, `ref` une autre, et aucun code ne lit l'une pour
//   écrire l'autre. La question n'a donc pas de réponse dans le système —
//   ce qui est en soi la réponse : le ref ne suit pas, et ne reste pas non
//   plus « par décision ». Il reste par absence de mécanisme.
//
// ─── 7 · CONSOMMATEURS — découverts, pas énumérés, sous codeSeul ───────
//
//   Voir S19/ag3g. Le point est descriptif, et GPT a raison de refuser qu'il
//   fonde quoi que ce soit : c'est exactement la prévalence de consommation
//   que la porte écarte.
//
// ─── 8 · INDÉPENDANCE — voir le bloc séparé, en fin de fichier ─────────
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune valeur inventée.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
        && !t.startsWith("--") && !t.startsWith("#");
    })
    .join("\n");
const aplat = (s: string) => s.replace(/\s+/g, " ");

const PROJECTION = "src/lib/casefile/publicProjection.ts";
const GENERATEUR_SQL = "scripts/casefile/generate-migration-sql.mjs";
const SCHEMA = "prisma/schema.prod.prisma";
const PDF_INTERNE = "src/lib/casefile/pdfGenerator.ts";
const PDF_SCAN = "src/components/pdf/pdfRenderer.ts";
const ROUTE_GENERATE = "src/app/api/casefile/generate/route.ts";
const PRESETS = "src/lib/casefile/presets.ts";

const BOTIFY_REF = "IL-SHILL-BOTIFY-001";
const VINE_REF = "IL-SHILL-VINE-001";

/**
 * L'univers de recherche : les sources de PRODUCTION uniquement.
 * `__tests__/` en est EXCLU à dessein — un test qui se compte lui-même comme
 * consommateur ou comme porteur de règle fabriquerait sa propre conclusion.
 * (C'est la version « par capacité » de l'erreur que S15/ag1 a commise.)
 */
const fichiers = (racine: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(racine, { withFileTypes: true })) {
    const p = join(racine, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...fichiers(p)); }
    else if (/\.(ts|tsx|mjs|json|prisma)$/.test(e.name)) out.push(p);
  }
  return out;
};
const PRODUCTION: string[] = [...fichiers("src"), ...fichiers("prisma"), ...fichiers("scripts")];

const porteursDe = (motif: RegExp): string[] =>
  PRODUCTION.filter((f) => motif.test(codeSeul(SRC(f)))).sort();

/** Tous les refs `IL-*` du dépôt, découverts, avec les fichiers qui les portent. */
const REFS_DECOUVERTS: Map<string, string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const f of PRODUCTION) {
    for (const m of codeSeul(SRC(f)).matchAll(/\bIL-[A-Z]+-[A-Z0-9]+-\d{3}\b/g)) {
      const l = out.get(m[0]) ?? [];
      if (!l.includes(f)) l.push(f);
      out.set(m[0], l.sort());
    }
  }
  return out;
})();

// ═════════════════════════════════════════════════════════════════════════
// AG3 · LES SEPT POINTS QUI DÉCRIVENT
// ═════════════════════════════════════════════════════════════════════════

describe("S19/ag3a — 1 · ORIGINE : qui ÉCRIT dans la colonne d'identité", () => {
  it("l'univers des écrivains est DÉCOUVERT par capacité, et il compte deux fichiers", () => {
    // On ne cherche pas « ref », on cherche l'ÉCRITURE.
    const ecrivains = porteursDe(
      /tokenCaseFile\.(create|update|upsert|createMany|updateMany|delete)|INSERT INTO token_casefiles|UPDATE token_casefiles/,
    );
    expect(ecrivains).toEqual(["prisma/seed-lab.ts", GENERATEUR_SQL]);
  });

  it("la valeur n'est DÉRIVÉE de rien — elle est saisie en tête du générateur", () => {
    const g = codeSeul(SRC(GENERATEUR_SQL));
    expect(g).toContain(`const BOTIFY_REF = "${BOTIFY_REF}"`);
    expect(g).toContain(`const VINE_REF = "${VINE_REF}"`);
    // Et l'INSERT la pose telle quelle, sans la calculer.
    expect(aplat(g)).toContain("INSERT INTO token_casefiles");
    expect(aplat(g)).toContain("ON CONFLICT (ref) DO NOTHING");
  });

  it("LE POINT DUR — la clé de LECTURE et la valeur ÉCRITE sont deux littéraux distincts", () => {
    // Deux fichiers, et ce sont les deux bouts de la chaîne. Rien ne les relie.
    for (const ref of [BOTIFY_REF, VINE_REF]) {
      expect(porteursDe(new RegExp(ref))).toEqual([GENERATEUR_SQL, PROJECTION].sort());
    }
    // Le générateur ne peut pas importer la constante : ce n'est pas du TS,
    // et il n'importe rien du module qui la porte.
    expect(GENERATEUR_SQL.endsWith(".mjs")).toBe(true);
    expect(codeSeul(SRC(GENERATEUR_SQL))).not.toContain("publicProjection");
  });
});

describe("S19/ag3b — 2 · SEGMENTS : trois refs, trois conventions incompatibles", () => {
  it("le segment 2 entretient une relation DIFFÉRENTE à `family` dans chaque cas", () => {
    // BOTIFY — le segment EST la famille, verbatim.
    expect(aplat(codeSeul(SRC(GENERATEUR_SQL)))).toContain("'SHILL', 'kol_network'");
    // LAB — le segment est une abréviation que rien ne calcule.
    const lab = codeSeul(SRC("prisma/seed-lab.ts"));
    expect(lab).toContain('const REF = "IL-PND-LAB-001"');
    expect(lab).toContain('family: "pump_and_dump"');
    // CBEX — le segment ne reflète ni la famille ni son abréviation.
    const cbex = codeSeul(SRC("prisma/seed-cbex.ts"));
    expect(cbex).toContain('const REF = "IL-PON-CBEX-001"');
    expect(cbex).toContain('family: "platform_fraud"');
  });

  it("et AUCUN code de production ne contraint la forme d'un ref", () => {
    // Le seul motif qui la contraigne dans tout le dépôt vit dans nos tests.
    // Un test n'est pas une règle d'identité : il constate, il ne fonde pas.
    const valideurs = porteursDe(/\/\^IL-|IL-\[A-Z\]|"IL-\[/);
    expect(valideurs, "un valideur de forme existe — le point 2 doit être revu")
      .toEqual([]);
  });
});

describe("S19/ag3c — 3 · UNICITÉ : contrainte en base, et non un espoir", () => {
  it("`ref` est `@unique` sur les deux tables de dossiers", () => {
    const s = SRC(SCHEMA);
    const modele = (nom: string) => {
      const i = s.indexOf(`model ${nom} {`);
      return s.slice(i, s.indexOf("\n}", i));
    };
    for (const nom of ["TokenCaseFile", "PlatformCaseFile"]) {
      expect(modele(nom), `${nom}.ref`).toMatch(/ref\s+String\s+@unique/);
    }
  });
});

describe("S19/ag3d — 4 · STABILITÉ : tient, mais par coïncidence de littéral", () => {
  it("aucun chemin ne fait `SET ref`", () => {
    expect(porteursDe(/SET\s+ref\s*=|\bref:\s*newRef|"ref":\s*ref\s*\+/i)).toEqual([]);
  });

  it("et le rejeu du générateur ne réécrit rien", () => {
    expect(aplat(codeSeul(SRC(GENERATEUR_SQL)))).toContain("ON CONFLICT (ref) DO NOTHING");
  });

  it("MAIS le seul `upsert` du dépôt porte `ref` DANS son payload de mise à jour", () => {
    // La nuance qui sépare « démontré » de « relu » : ici `where.ref` et
    // `data.ref` sont la même constante, donc rien ne bouge. La colonne
    // d'identité n'est pas EXCLUE du payload — elle s'y trouve, et c'est le
    // littéral partagé qui tient, pas une garde.
    const lab = aplat(codeSeul(SRC("prisma/seed-lab.ts")));
    expect(lab).toContain("where: { ref: REF }, create: data, update: data,");
    expect(lab).toContain("ref: REF,");
  });
});

describe("S19/ag3e — 5 · RÈGLE DE CRÉATION : aucune, et c'est mesurable", () => {
  it("aucun constructeur, allocateur ou compteur ne produit un `IL-*`", () => {
    // On cherche la CAPACITÉ de fabriquer un ref, pas le mot « ref ».
    const fabricants = porteursDe(
      /["'`]IL-["'`]\s*\+|`IL-\$\{|\.padStart\(3[^)]*\).*IL-|nextCasefileRef|allocateRef/,
    );
    expect(fabricants, "un fabricant de ref existe — le point 5 doit être revu")
      .toEqual([]);
  });

  it("les refs existants sont des littéraux saisis, un par site", () => {
    // Découvert, non énuméré — et la découverte en a rendu CINQ, pas quatre.
    expect([...REFS_DECOUVERTS.keys()].sort()).toEqual([
      "IL-CONC-BLACKBULL-001", "IL-PND-LAB-001", "IL-PON-CBEX-001", BOTIFY_REF, VINE_REF,
    ].sort());
    // Et tous se terminent par `001` : aucun `002` n'a jamais été alloué.
    // Le suffixe n'a donc jamais été exercé — il n'a pas d'allocateur à
    // exercer.
    expect([...REFS_DECOUVERTS.keys()].every((r) => r.endsWith("-001"))).toBe(true);
  });

  it("ET DEUX DES CINQ PRÉEXISTENT AU DÉPÔT — l'un n'a aucune origine ici", () => {
    // Le générateur le DIT lui-même : « token_casefiles ne porte que BLACKBULL
    // et LAB ». LAB a son seed. BLACKBULL n'a rien : ni seed, ni INSERT, ni
    // script. Il n'apparaît que dans un post-check qui LIT la ligne.
    //
    // Autrement dit, la population de la colonne d'identité contient au moins
    // une valeur dont le dépôt ne peut pas rendre compte de la création. Pour
    // un point « ORIGINE », c'est décisif : la règle n'est pas seulement
    // absente, elle est absente pour une valeur déjà en base.
    const blackbull = REFS_DECOUVERTS.get("IL-CONC-BLACKBULL-001")!;
    expect(blackbull).toEqual([GENERATEUR_SQL]);
    const ecrivains = porteursDe(
      /tokenCaseFile\.(create|update|upsert)|INSERT INTO token_casefiles/,
    );
    for (const f of ecrivains) {
      expect(
        codeSeul(SRC(f)).includes("IL-CONC-BLACKBULL-001")
          && /INSERT|upsert/.test(codeSeul(SRC(f)).split("IL-CONC-BLACKBULL-001")[0].slice(-200)),
        `${f} créerait BLACKBULL`,
      ).toBe(false);
    }
  });
});

describe("S19/ag3f — 6 · RÈGLE DE MUTATION : rien ne lie la nature au ref", () => {
  it("aucun code ne lit `family` pour écrire `ref`, ni l'inverse", () => {
    // `family` non précédé d'un tiret : `font-family` n'est pas la colonne.
    const couplage = porteursDe(
      /\bref\b\s*=\s*[^;\n]*(?<![-\w])family\b|(?<![-\w])family\b\s*=\s*[^;\n]*\bref\b/,
    );
    expect(couplage).toEqual([]);
  });
});

describe("S19/ag3g — 7 · CONSOMMATEURS : découverts, et le point ne FONDE rien", () => {
  it("l'univers est découvert sous codeSeul, littéral ET constante", () => {
    const parConstante = porteursDe(/BOTIFY_CASEFILE_REF/);
    expect(parConstante).toEqual([
      "src/app/api/casefile/generate/route.ts",
      "src/app/api/casefile/pdf/route.ts",
      "src/app/en/cases/botify/evidence/page.tsx",
      "src/lib/casefile/pdfGeneratorPublic.ts",
      PROJECTION,
      "src/scripts/export/botifySpreadsheet.ts",
    ].sort());
  });

  it("VINE en compte MOINS, et l'asymétrie est nommée", () => {
    const vine = porteursDe(/VINE_CASEFILE_REF/);
    expect(vine).toEqual([
      "src/app/api/casefile/generate/route.ts",
      "src/app/api/casefile/pdf/route.ts",
      PROJECTION,
    ].sort());
    // VINE n'a pas d'entrée dans la table de faits du PDF public, et pas de
    // page de preuves dédiée. La prévalence de consommation diffère donc
    // FORTEMENT entre les deux — ce qui est exactement pourquoi elle ne peut
    // pas fonder : elle classerait BOTIFY au-dessus de VINE sans qu'aucune
    // règle d'identité ne le dise.
    expect(codeSeul(SRC("src/lib/casefile/pdfGeneratorPublic.ts")))
      .not.toContain("VINE_CASEFILE_REF");
  });
});

// ─── Le critère : CONSUMED ≠ FOUNDED ─────────────────────────────────────

interface Identite {
  /** Une règle EXPLICITE dit comment la valeur est produite ? */
  readonly regleDeCreation: boolean;
  /** La forme est contrainte par du code de production ? */
  readonly formeValidee: boolean;
  /** L'unicité est garantie par la base ? */
  readonly uniciteContrainte: boolean;
  /** Une seule source de vérité pour la valeur (pas deux littéraux) ? */
  readonly sourceUnique: boolean;
  /** Combien de surfaces la consomment. DESCRIPTIF — ne fonde rien. */
  readonly consommateurs: number;
}

function batterieAG3(i: Identite): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  dit(i.regleDeCreation, "AG3-1 aucune-regle-de-creation");
  dit(i.formeValidee, "AG3-2 forme-non-validee");
  dit(i.uniciteContrainte, "AG3-3 unicite-non-contrainte");
  dit(i.sourceUnique, "AG3-4 deux-litteraux-pour-une-identite");
  // Et RIEN sur `consommateurs` : le champ est lu par le critère rival
  // ci-dessous, jamais par celui-ci. C'est ainsi que « CONSUMED ≠ FOUNDED »
  // s'inscrit — par une absence, pas par une clause.
  return v;
}

/**
 * LE CRITÈRE RIVAL — celui que GPT refuse, écrit noir sur blanc.
 *
 * Première écriture : une clause `AG3-5` DANS la batterie, censée attraper
 * « beaucoup consommé donc fondé ». Elle ne mordait pas, et pour une raison
 * instructive — elle se suspendait dès que l'absence de règle était déjà
 * relevée, c'est-à-dire exactement dans le seul cas qu'elle visait.
 *
 * On ne peut pas exprimer « X ne fonde pas » par une clause de plus dans le
 * critère : c'est une propriété DU critère, pas du sujet. Elle s'inscrit donc
 * comme un DÉSACCORD entre deux critères sur le même sujet mesuré.
 */
const fondeSurLaPrevalence = (i: Identite, seuil = 3): boolean =>
  i.consommateurs >= seuil;

const TEMOIN_AG3: Identite = {
  regleDeCreation: true, formeValidee: true, uniciteContrainte: true,
  sourceUnique: true, consommateurs: 6,
};

describe("S19/ag3h — CRITÈRE : une identité gouvernée est FONDÉE, pas populaire", () => {
  it("le TÉMOIN passe", () => expect(batterieAG3(TEMOIN_AG3)).toEqual([]));

  const MUTANTS: Array<{ nom: string; critere: string; i: Identite }> = [
    {
      nom: "LE CAS MESURÉ — six consommateurs, aucune règle de création",
      critere: "AG3-1 aucune-regle-de-creation",
      i: { ...TEMOIN_AG3, regleDeCreation: false, formeValidee: false, sourceUnique: false },
    },
    {
      nom: "la forme n'est contrainte que par les tests",
      critere: "AG3-2 forme-non-validee",
      i: { ...TEMOIN_AG3, formeValidee: false },
    },
    {
      nom: "l'unicité est une convention, pas une contrainte",
      critere: "AG3-3 unicite-non-contrainte",
      i: { ...TEMOIN_AG3, uniciteContrainte: false },
    },
    {
      nom: "la clé de lecture et la valeur écrite sont deux littéraux",
      critere: "AG3-4 deux-litteraux-pour-une-identite",
      i: { ...TEMOIN_AG3, sourceUnique: false },
    },
  ];

  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAG3(m.i);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AG3 est tué, et aucun n'échappe", () => {
    const CRITERES = [
      "AG3-1 aucune-regle-de-creation",
      "AG3-2 forme-non-validee",
      "AG3-3 unicite-non-contrainte",
      "AG3-4 deux-litteraux-pour-une-identite",
    ];
    const tues = new Set(MUTANTS.map((m) => m.critere));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });

  it("LA PORTE — les deux critères DIVERGENT sur le cas mesuré", () => {
    // Le sujet est le même. Ce qui change est le critère, et c'est tout
    // l'énoncé : la prévalence l'accepte, la fondation le refuse.
    const MESURE: Identite = {
      regleDeCreation: false, formeValidee: false, uniciteContrainte: true,
      sourceUnique: false, consommateurs: 6,
    };
    expect(fondeSurLaPrevalence(MESURE), "le critère rival ACCEPTE").toBe(true);
    expect(batterieAG3(MESURE), "le critère de fondation REFUSE").not.toEqual([]);
  });

  it("et ils divergent ENCORE quand la prévalence s'effondre — VINE contre BOTIFY", () => {
    // Le test qui rend la porte non vacue : si la prévalence fondait, deux
    // dossiers identiquement non fondés seraient classés différemment par le
    // seul nombre de leurs consommateurs. Le critère de fondation, lui, rend
    // exactement le même verdict pour les deux.
    const commun = { regleDeCreation: false, formeValidee: false, uniciteContrainte: true, sourceUnique: false };
    const botify: Identite = { ...commun, consommateurs: 6 };
    const vine: Identite = { ...commun, consommateurs: 3 };
    expect(fondeSurLaPrevalence(botify, 4)).not.toBe(fondeSurLaPrevalence(vine, 4));
    expect(batterieAG3(botify)).toEqual(batterieAG3(vine));
  });

  it("SUR-CORRECTION — l'unicité contrainte NE SUFFIT PAS à fonder", () => {
    // Le point 3 tient, seul. Le conclure suffisant serait la même erreur que
    // conclure de la consommation : une contrainte d'unicité empêche deux
    // dossiers de partager un ref, elle ne dit rien de ce que le ref DÉSIGNE.
    expect(batterieAG3({
      regleDeCreation: false, formeValidee: false, uniciteContrainte: true,
      sourceUnique: false, consommateurs: 6,
    })).toContain("AG3-1 aucune-regle-de-creation");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AG4 · L'AUTORITÉ VISUELLE CONTREDIT L'AUTORITÉ GOUVERNÉE
// ═════════════════════════════════════════════════════════════════════════
//
// Doctrine ratifiée : VISUAL AUTHORITY MUST NOT CONTRADICT GOVERNED AUTHORITY.
//
// Les trois mesures demandées, et la première est celle qui tranche.

describe("S19/ag4a — 1 · LES DEUX SONT DISPONIBLES AU MÊME MOMENT", () => {
  it("`casefile/generate` construit UN OBJET qui porte les DEUX identités", () => {
    // Ce n'est pas une divergence entre deux chemins : c'est une divergence
    // DANS un seul objet, dans une seule requête.
    const c = aplat(codeSeul(SRC(ROUTE_GENERATE)));
    expect(c).toContain("input = { ...(body.source === \"vine\" ? buildVineInput() : buildBotifyInput()), canonical: { ref: dossier.ref, claims: dossier.claims }, };");
  });

  it("le preset y apporte toujours la forme NON gouvernée — seul son millésime a changé", () => {
    // Le constat n'est PAS clos : le preset apporte une identité d'un autre
    // espace que celui par lequel la route résout, et c'est cela le fait. Que
    // son millésime ait été aligné sur la valeur stockée corrige une seconde
    // divergence, pas celle-ci.
    //
    // Écrit par CAPACITÉ : ce qui compte est que le preset porte une forme de
    // l'espace hérité, quel qu'en soit le millésime — un futur réalignement ne
    // doit pas faire disparaître ce constat en silence.
    expect(codeSeul(SRC(PRESETS)), "le preset a cessé de porter une forme héritée")
      .toMatch(/case_id: "CASE-\d{4}-BOTIFY-001"/);
    expect(codeSeul(SRC(PRESETS))).toContain('case_id: "CASE-2024-BOTIFY-001"');
    // VINE : même collision, valeur lue dans le JSON du preset.
    expect(codeSeul(SRC(PRESETS))).toContain("case_id: meta.case_id");
    expect(SRC("src/data/vine-osint.json")).toMatch(/"CASE-\d{4}-VINE-001"/);
  });

  // ── CE BLOC A CHANGÉ DE SENS SUR UN EMPLACEMENT SUR QUATRE ─────────────
  //
  // Il ÉPINGLAIT : « c'est le gabarit qui décide, et il décide contre
  // l'autorité gouvernée sur TOUS les emplacements d'adressage ». Le lot
  // d'identité d'artefact a déplacé le PIED DE PAGE vers l'autorité gouvernée,
  // et lui seul. Le titre de tête, la clé d'archive et le nom de fichier
  // portent toujours la forme du preset.
  //
  // Le « tous » est donc faux et le fait demeure. L'assertion est réécrite
  // pour MESURER LE PARTAGE au lieu de l'affirmer en bloc : c'est cette
  // répartition-là qui est le sujet de RC-5, et une formulation en bloc
  // aurait perdu l'information au moment précis où elle devient actionnable.
  it("LA RÈGLE QUI TRANCHE — il n'y en a toujours pas, et le gabarit décide en ordre dispersé", () => {
    const g = codeSeul(SRC(PDF_INTERNE));

    // Les emplacements qui portent ENCORE la forme non gouvernée. Ils étaient
    // trois ; le titre de tête est passé à la dérivation, et ils sont deux.
    // Tous deux sont HORS DU CORPS DU DOCUMENT — un nom de fichier et une clé
    // d'archive —, ce qui n'est pas un détail de périmètre : ce sont
    // précisément les deux emplacements qu'aucun rendu ne montre au lecteur,
    // donc les deux qu'une relecture d'artefact ne peut pas attraper.
    expect(g, "la CLÉ D'ARCHIVE R2").toContain("input.case_meta.case_id.replace(");
    expect(aplat(codeSeul(SRC(ROUTE_GENERATE))), "le NOM DE FICHIER servi")
      .toContain('filename="${input.case_meta.case_id}.pdf"');

    // Le TITRE DE TÊTE, passé à la dérivation après le pied de page. Il est
    // ancré nommément parce que c'est le site corrigé : un correctif doit
    // rougir là où il a été fait, pas seulement dans l'agrégat qui le contient.
    expect(g, "le TITRE du document est reparti vers la forme non gouvernée")
      .toContain("<h1>${esc(ref)}</h1>");
    expect(g, "un emplacement du CORPS lit encore les métadonnées d'entrée")
      .not.toMatch(/<h1>\$\{esc\(m\.case_id\)\}/);

    // Le pied de page — et il l'a fait par une
    // DÉRIVATION, pas par une valeur figée : c'est ce qui le rend transposable
    // aux trois autres, et c'est pourquoi on l'ancre ici plutôt que de se
    // contenter de constater le résultat.
    expect(g, "le pied de page est reparti vers la forme non gouvernée")
      .toContain("<span>${esc(ref)} — CONFIDENTIEL</span>");
    expect(g, "la dérivation du pied a été remplacée par une valeur figée")
      .toContain("const ref = input.canonical?.ref || m.case_id;");

    // …et l'autorité gouvernée conserve son sous-titre de section.
    expect(g).toContain("Claims — autorité canonique · ${esc(input.canonical.ref)}");
  });
});

describe("S19/ag4b — 2 · DEUX ARTEFACTS DU MÊME DOSSIER SE CONTREDISENT", () => {
  it("le renderer du SCAN met l'autorité gouvernée à l'emplacement d'identité", () => {
    // Voie canonique : `off_chain.case_id = dossier.ref`, imprimé l. 162.
    expect(aplat(codeSeul(SRC("src/app/api/report/casefile/route.ts"))))
      .toContain("casefile.off_chain.case_id = dossier.ref;");
    expect(aplat(codeSeul(SRC(PDF_SCAN)))).toContain("${off_chain.case_id ?? \"—\"}");
  });

  // ── CE CONSTAT EST CLOS, ET LE BLOC QUI LE CONTIENT NE L'EST PAS ───────
  //
  // Il épinglait que le générateur interne mettait la forme non gouvernée à
  // l'emplacement d'identité de tête. Il l'y met désormais la forme gouvernée.
  //
  // Mais le bloc s'appelle « DEUX ARTEFACTS DU MÊME DOSSIER SE CONTREDISENT »,
  // et ils se contredisent toujours : le PDF interne porte l'identité
  // gouvernée, le renderer du scan porte ce que sa route lui donne, et les
  // deux routes qui l'alimentent ne mettent pas la même famille dans ce champ.
  // La contradiction a changé de porteur, elle n'a pas disparu.
  it("le générateur INTERNE met désormais l'autorité GOUVERNÉE à l'emplacement de tête", () => {
    expect(codeSeul(SRC(PDF_INTERNE))).toContain("<h1>${esc(ref)}</h1>");
    expect(codeSeul(SRC(PDF_INTERNE))).not.toMatch(/<h1>\$\{esc\(m\.case_id\)\}/);
  });

  // ── UN SECOND FAUX VERT, DÉCOUVERT PAR LE RETOURNEMENT ────────────────
  //
  // Cette assertion PASSAIT après la fermeture, et son énoncé était devenu
  // faux : elle construisait son ensemble de trois valeurs EN LOCAL, à la
  // main. Rien ne la reliait aux sources, donc rien ne pouvait la faire
  // rougir quand le dépôt est passé à deux formes.
  //
  // C'est la même faute que le faux vert de S13, sous une autre écriture, et
  // c'est la faute générique de ce corpus quand il « reproduit une propriété
  // plutôt qu'une route » : une reproduction ne se périme jamais toute seule.
  // Le retournement des ROUGES ne l'aurait pas trouvée — il a fallu relire les
  // blocs voisins de chaque rouge.
  //
  // Elle est donc reconstruite DEPUIS LES SOURCES, et c'est ce qui la rend
  // capable de se périmer à l'avenir.
  it("CONSÉQUENCE — DEUX formes pour un dossier, selon l'artefact reçu", () => {
    const formesVues = new Set<string>();
    // (1) PDF interne — la forme portée par le preset, lue dans le preset.
    formesVues.add(codeSeul(SRC(PRESETS)).match(/case_id: "(CASE-\d{4}-BOTIFY-001)"/)![1]);
    // (2) scan, voie canonique — l'autorité gouvernée.
    formesVues.add(BOTIFY_REF);
    // (3) scan, voie legacy — la valeur STOCKÉE, servie telle quelle depuis
    //     que la dérivation d'horloge a été retirée. Lue dans le magasin.
    formesVues.add(SRC("data/cases/botify.json").match(/"(CASE-\d{4}-BOTIFY-001)"/)![1]);

    // Trois artefacts, et il ne reste que DEUX valeurs : la voie legacy et le
    // PDF interne ont convergé. C'est un vrai gain, et il ne clôt rien — deux
    // espaces de nommage pour un dossier restent deux.
    expect(formesVues.size).toBe(2);

    // Et rien dans ces valeurs ne permet de les rapprocher, sauf le fragment
    // du codename — qui n'est pas une identité, et dont la règle d'opacité
    // ratifiée dit désormais qu'il ne porte aucune autorité (voir S21).
    expect([...formesVues].every((f) => f.includes("BOTIFY"))).toBe(true);
    expect([...formesVues].filter((f) => f.startsWith("IL-"))).toHaveLength(1);
  });
});

describe("S19/ag4c — 3 · AUCUN CONSOMMATEUR NE DISTINGUE LES DEUX FORMES", () => {
  it("aucune surface de production ne branche sur la forme du ref", () => {
    // S'il existait un consommateur qui les distingue, la contradiction serait
    // au moins détectable en aval. Mesuré : il n'y en a aucun.
    expect(porteursDe(/startsWith\(\s*["'`]IL-|\/\^IL-|=== *["'`]IL-/)).toEqual([]);
  });

  it("et le seul consommateur qui PARSE une forme ne connaît que la NON gouvernée", () => {
    // `explorer/[caseId]` extrait un slug de `CASE-YYYY-X-NNN`. Donné un
    // `IL-SHILL-*`, il n'extrait rien — mesuré en S18/ak6 : chemin « RIEN ».
    // La seule surface qui comprenne une forme comprend celle qui n'est pas
    // gouvernée.
    const p = codeSeul(SRC("src/app/en/explorer/[caseId]/page.tsx"));
    expect(p).toContain("caseId.match(/^CASE-\\d{4}-(.+?)-\\d+$/)");
    expect(p).not.toContain("IL-");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8 · INDÉPENDANCE — LE SEUL POINT QUI PEUT CLORE
// ═════════════════════════════════════════════════════════════════════════
//
// Critère : MÊME DOSSIER + MÊME IDENTITÉ GOUVERNÉE, malgré un changement de
//   · temps de récupération   · route   · renderer   · langue   · format
//
// Deux lectures possibles du critère, et elles ne donnent pas le même verdict.
// Il faut les séparer, sinon on conclut ce qu'on a choisi de mesurer :
//
//   (i)  la VALEUR gouvernée est-elle stable sur ces cinq axes ?
//   (ii) l'identité RENDUE au lecteur est-elle stable sur ces cinq axes ?
//
// (i) tient sur les cinq. (ii) tombe sur trois. Et c'est (ii) que le critère
// vise : une identité qu'on ne peut pas citer depuis l'artefact reçu n'est
// pas une identité indépendante, elle est une clé interne stable.

type Axe = "TEMPS" | "ROUTE" | "RENDERER" | "LANGUE" | "FORMAT";
const AXES: Axe[] = ["TEMPS", "ROUTE", "RENDERER", "LANGUE", "FORMAT"];

/** Ce qui est MESURÉ, axe par axe. Chaque entrée est ancrée par un test. */
const VALEUR_STABLE: Record<Axe, boolean> = {
  TEMPS: true,    // aucune horloge ne touche `dossier.ref`
  ROUTE: true,    // trois tables de routage, une seule valeur
  RENDERER: true, // la valeur relue est la même, quel que soit le gabarit
  LANGUE: true,   // `lang` ne touche que titres et descriptions
  FORMAT: true,   // la valeur ne dépend pas du conteneur
};

const RENDU_STABLE: Record<Axe, boolean> = {
  TEMPS: false,    // voie legacy : l'horloge réécrit l'identité imprimée
  ROUTE: true,     // les routes qui s'arment sur le canonique rendent le même ref
  RENDERER: false, // pdfGenerator rend `case_meta.case_id`, pdfRenderer rend `ref`
  LANGUE: true,    // aucun ref localisé
  FORMAT: false,   // nom de fichier, clé R2 et h1 portent la forme non gouvernée
};

describe("S19/ag3i — 8 · INDÉPENDANCE (i) : la VALEUR gouvernée est stable", () => {
  it("TEMPS — aucune horloge ne touche la valeur relue", () => {
    const lecteur = codeSeul(SRC("src/lib/casefile/canonicalReader.ts"));
    expect(lecteur).toContain("ref: dossier.ref,");
    expect(lecteur, "une horloge intervient dans la lecture d'identité")
      .not.toMatch(/getFullYear|Date\.now\(\)[^;]*ref/);
  });

  it("ROUTE — trois tables de routage, et une seule valeur", () => {
    expect(aplat(codeSeul(SRC(PROJECTION))))
      .toContain("const CANONICAL_REF_BY_MINT: Record<string, string> = { [BOTIFY_MINT]: BOTIFY_CASEFILE_REF, [VINE_MINT]: VINE_CASEFILE_REF, }");
    expect(aplat(codeSeul(SRC(ROUTE_GENERATE))))
      .toContain("const CANONICAL_REF_BY_SOURCE: Record<string, string> = { botify: BOTIFY_CASEFILE_REF, vine: VINE_CASEFILE_REF, };");
    const pdf = aplat(codeSeul(SRC("src/app/api/casefile/pdf/route.ts")));
    expect(pdf).toContain('if (raw === "botify") return BOTIFY_CASEFILE_REF;');
    // Trois tables qui doivent s'accorder à la main — la valeur tient, la
    // construction est fragile. On le dit sans le compter comme une rupture.
  });

  it("LANGUE — `lang` ne produit aucun ref localisé", () => {
    // `\bref\b` et non `ref[A-Za-z]*` : `href=` contient « ref » et faisait
    // remonter cinq fichiers qui ne parlent pas d'identité. Chercher la bonne
    // chose au bon niveau, y compris dans une expression régulière.
    const cible = porteursDe(/\bref\b\s*=\s*[^;\n]*\blang\b|\blang\b\s*===\s*["']fr["'][^;\n]*\bref\b/);
    expect(cible).toEqual([]);
    // Et là où `lang` et `ref` coexistent, `ref` traverse inchangé.
    expect(aplat(codeSeul(SRC("src/app/api/casefile/public/route.ts"))))
      .toContain('filename="${ref}-public-${lang}.pdf"');
  });
});

describe("S19/ag3j — 8 · INDÉPENDANCE (ii) : l'identité RENDUE ne l'est PAS", () => {
  // ── L'AXE « TEMPS » EST CLOS, ET IL ÉTAIT UN DES CINQ ──────────────────
  //
  // Ce bloc qualifiait l'indépendance de l'identité RENDUE sur cinq axes.
  // L'axe TEMPS épinglait que la voie legacy dérivait l'identité imprimée de
  // l'horloge ; il est fermé. Les autres axes de ce bloc — RENDERER, FORMAT —
  // ne le sont pas, et le verdict d'ensemble d'ag3k ne bouge donc pas.
  //
  // L'assertion est retournée sur le MÊME point de code, et écrite par
  // CAPACITÉ : ce qui est interdit est qu'une horloge, sous quelque écriture
  // que ce soit, touche l'identité servie.
  it("TEMPS — CLOS : la voie legacy ne dérive plus l'identité imprimée de l'horloge", () => {
    const c = aplat(codeSeul(SRC("src/app/api/scan/solana/route.ts")));
    expect(c).toContain("off_chain.case_id = caseFile.case_meta.case_id;");
    expect(c, "une horloge est revenue toucher l'identité servie").not.toMatch(
      /case_id[^;]{0,120}(?:getFullYear|getUTCFullYear|Date\.now|new Date\()/,
    );
  });

  // ── L'AXE « RENDERER » EST CLOS DU CÔTÉ GOUVERNÉ, ET LUI SEUL ──────────
  //
  // L'assertion négative de la première écriture était mal visée, et le
  // retournement le montre : elle interdisait UNE ÉCRITURE PRÉCISE
  // (`input.canonical.ref` en tête) plutôt que la propriété. Le correctif a
  // rendu l'emplacement gouverné par une AUTRE écriture — la variable dérivée —
  // et l'assertion négative serait restée verte en certifiant le contraire de
  // ce qu'elle annonçait. Encore une assertion plus lâche que son nom.
  //
  // Elle est donc reprise sur la PROPRIÉTÉ : l'emplacement de tête ne lit plus
  // les métadonnées d'entrée, quelle que soit la façon dont il obtient sa
  // valeur gouvernée.
  it("RENDERER — le gabarit interne a rejoint l'autorité gouvernée en tête", () => {
    expect(codeSeul(SRC(PDF_SCAN)), "gabarit du scan").toContain("off_chain.case_id");
    expect(codeSeul(SRC(PDF_INTERNE)), "gabarit interne")
      .toMatch(/<h1>\$\{esc\(ref\)\}<\/h1>/);
    expect(codeSeul(SRC(PDF_INTERNE)), "l'emplacement de tête relit les métadonnées d'entrée")
      .not.toMatch(/<h1>\$\{esc\(m\.case_id\)\}/);

    // Le gabarit du SCAN, lui, n'a pas bougé : il imprime la chaîne qu'on lui
    // donne, sans nommer l'espace dont elle vient. Les deux routes qui
    // l'alimentent y mettent deux familles. C'est l'axe qui reste ouvert.
    expect(codeSeul(SRC(PDF_SCAN))).not.toContain("IL-SHILL");
  });

  it("FORMAT — le conteneur décide, et il décide contre l'autorité gouvernée", () => {
    // PDF interne : nom de fichier et clé d'archive portent la forme preset.
    expect(aplat(codeSeul(SRC(ROUTE_GENERATE)))).toContain('filename="${input.case_meta.case_id}.pdf"');
    expect(codeSeul(SRC(PDF_INTERNE))).toContain("input.case_meta.case_id.replace(");
    // PDF public : nom de fichier porte le ref gouverné. Le MÊME dossier,
    // deux formats, deux noms de fichier de familles différentes.
    expect(aplat(codeSeul(SRC("src/app/api/casefile/public/route.ts"))))
      .toContain('filename="${ref}-public-${lang}.pdf"');
    // Page HTML de preuves : le ref gouverné, rendu en tête. Correcte, et
    // c'est ce qui rend la contradiction visible plutôt que théorique.
    expect(codeSeul(SRC("src/app/en/cases/botify/evidence/page.tsx"))).toContain("{dossier.ref}");
  });
});

describe("S19/ag3k — 8 · LE VERDICT, et il ne peut pas CLORE", () => {
  it("la lecture (i) passe les cinq axes", () => {
    expect(AXES.filter((a) => !VALEUR_STABLE[a])).toEqual([]);
  });

  it("la lecture (ii) tombe sur TEMPS, RENDERER et FORMAT", () => {
    expect(AXES.filter((a) => !RENDU_STABLE[a])).toEqual(["TEMPS", "RENDERER", "FORMAT"]);
  });

  it("PORTE — le critère vise le RENDU, donc le point 8 NE CLÔT PAS", () => {
    // Conclure sur (i) serait choisir la mesure qui arrange. Une identité que
    // le lecteur ne peut pas citer depuis l'artefact qu'il a reçu n'est pas
    // indépendante du format — elle est une clé interne stable, ce qui est
    // autre chose, et utile, mais pas ce que la porte demande.
    const clot = AXES.every((a) => RENDU_STABLE[a]);
    expect(clot, "le point 8 clôturerait — la qualification doit être revue").toBe(false);
  });

  it("SUR-CORRECTION — l'échec du rendu ne condamne pas la VALEUR", () => {
    // Le défaut est de publication, pas de gouvernance de la valeur. Retirer
    // `IL-SHILL-BOTIFY-001` au motif que les artefacts le contredisent serait
    // supprimer le seul terme stable de l'ensemble.
    expect(VALEUR_STABLE.TEMPS && VALEUR_STABLE.ROUTE && VALEUR_STABLE.LANGUE).toBe(true);
  });
});

// ─── VINE — MÊME TRAITEMENT, ET LE HOLD TIENT ────────────────────────────

describe("S19/ag3l — VINE : la constante existe, et elle ne fonde pas davantage", () => {
  it("les sept points descriptifs donnent le MÊME résultat que BOTIFY", () => {
    // Origine : même littéral saisi, même générateur, mêmes deux exemplaires.
    expect(porteursDe(new RegExp(VINE_REF))).toEqual([GENERATEUR_SQL, PROJECTION].sort());
    // Segments, création, mutation, validation : mesurés globalement plus haut,
    // et aucun n'est spécifique à BOTIFY.
    expect(codeSeul(SRC(GENERATEUR_SQL))).toContain(`const VINE_REF = "${VINE_REF}"`);
  });

  it("et sa PRÉVALENCE est plus faible — ce qui ne change rien à la porte", () => {
    // Trois consommateurs contre six. Si la consommation fondait, VINE serait
    // « moins fondé » que BOTIFY, ce qui n'a pas de sens pour une identité.
    // C'est l'argument le plus court en faveur de CONSUMED ≠ FOUNDED.
    expect(porteursDe(/VINE_CASEFILE_REF/).length)
      .toBeLessThan(porteursDe(/BOTIFY_CASEFILE_REF/).length);
  });

  it("HOLD MAINTENU — l'existence de la constante n'est pas une fondation", () => {
    const vineCommeIdentite: Identite = {
      regleDeCreation: false, formeValidee: false, uniciteContrainte: true,
      sourceUnique: false, consommateurs: 3,
    };
    expect(batterieAG3(vineCommeIdentite)).toContain("AG3-1 aucune-regle-de-creation");
    expect(batterieAG3(vineCommeIdentite)).toContain("AG3-4 deux-litteraux-pour-une-identite");
  });
});
