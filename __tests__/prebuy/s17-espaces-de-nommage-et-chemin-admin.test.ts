// ─── BUILD 12 · S17 — CINQ ESPACES DE NOMMAGE, ET UN CHEMIN JAMAIS EXERCÉ ─
//
// ██  AK · un contournement ne devient pas inutile quand sa cause part      ██
// ██  AL · un chemin de production qui existe et n'a jamais servi           ██
//
// ─── L'AUTORITÉ GOUVERNÉE EXISTE, ET ELLE N'A PAS LA FORME `CASE-*` ────
//
//   src/lib/casefile/publicProjection.ts:67-68
//     export const BOTIFY_CASEFILE_REF = "IL-SHILL-BOTIFY-001";
//     export const VINE_CASEFILE_REF   = "IL-SHILL-VINE-001";
//
//   Elle est consommée par les surfaces CANONIQUES — casefile/pdf,
//   casefile/generate, pdfGeneratorPublic, botifySpreadsheet.
//
//   Ce qui reformule l'axe AG : le problème n'est pas que trois formes
//   `CASE-*` divergent entre elles. C'est que TOUTE LA FAMILLE `CASE-*` EST UN
//   ESPACE CONCURRENT QUE L'AUTORITÉ GOUVERNÉE NE RECONNAÎT PAS — elle n'a
//   même pas cette forme.
//
// ─── CINQ ESPACES DE NOMMAGE POUR UN DOSSIER, MESURÉS ──────────────────
//
//   1  IL-SHILL-BOTIFY-001    l'AUTORITÉ, publicProjection.ts:67
//   2  CASE-2024-BOTIFY-001   le magasin legacy, data/cases/botify.json
//   3  CASE-2025-BOTIFY-001   presets.ts, ET le libellé de l'écran admin
//   4  CASE-2026-BOTIFY-001   la forme SERVIE, réécrite par l'horloge
//   5  BOTIFY / BOTIFY-MAIN   la valeur de `KolCase.caseId`, que l'explorer
//                             expose sous le nom `title`
//
// ─── LE TROU DE PREUVE ANNONCÉ S'EST REFERMÉ, ET IL FAUT LE DIRE ───────
//
//   La couche de mapping était donnée pour non résolue. Elle l'est :
//   `src/lib/explorer/explorerItems.ts:123` → `title: caseId`. Pour
//   `kind='case'`, le `title` que l'explorer compare EST la colonne
//   `KolCase.caseId`. Il n'y a pas de couche de traduction cachée.
//
//   CE QUI RESTE NON MESURÉ, et c'est plus étroit : les VALEURS effectivement
//   stockées dans `KolCase.caseId` en production. Le commentaire de
//   `explorer/[caseId]/page.tsx:41` affirme « BOTIFY-MAIN », « BOTIFY »,
//   « BOTIFY-C1 » — c'est un COMMENTAIRE, pas une mesure, et ce worktree n'a
//   pas accès à la base. La forme est donc établie, les valeurs ne le sont pas.
//
// ─── ET LE CONTOURNEMENT NE TRADUIT PAS : IL DEVINE ────────────────────
//
//   La chaîne de repli de `explorer/[caseId]/page.tsx` se termine par
//   `?? items2[0]` (l. 60) : à défaut de correspondance exacte puis de
//   correspondance par préfixe, ELLE PREND LE PREMIER RÉSULTAT DE RECHERCHE,
//   quel qu'il soit. Un contournement qui devine n'absorbe pas un défaut, il
//   en fabrique un second, silencieux.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const EXPLORER_PAGE = "src/app/en/explorer/[caseId]/page.tsx";
const EXPLORER_ITEMS = "src/lib/explorer/explorerItems.ts";
const PROJECTION = "src/lib/casefile/publicProjection.ts";
const ADMIN_PAGE = "src/app/admin/casefile-generator/page.tsx";
const ROUTE_GENERATE = "src/app/api/casefile/generate/route.ts";

// ═════════════════════════════════════════════════════════════════════════
// S17/c — LES CINQ ESPACES, ET L'AUTORITÉ
// ═════════════════════════════════════════════════════════════════════════

describe("S17/c1 — CONSTAT : l'autorité gouvernée n'a pas la forme des autres", () => {
  it("elle existe, et elle est nommée", () => {
    expect(codeSeul(SRC(PROJECTION))).toContain('export const BOTIFY_CASEFILE_REF = "IL-SHILL-BOTIFY-001"');
    expect(codeSeul(SRC(PROJECTION))).toContain('export const VINE_CASEFILE_REF = "IL-SHILL-VINE-001"');
  });

  it("les surfaces CANONIQUES la consomment", () => {
    for (const f of [
      "src/app/api/casefile/pdf/route.ts",
      ROUTE_GENERATE,
      "src/lib/casefile/pdfGeneratorPublic.ts",
    ]) {
      expect(codeSeul(SRC(f)), f).toContain("CASEFILE_REF");
    }
  });

  it("et sa forme n'est PAS `CASE-YYYY-X-NNN`", () => {
    // C'est le cœur : la famille `CASE-*` est un espace concurrent que
    // l'autorité ne reconnaît pas — elle n'a même pas cette forme.
    expect("IL-SHILL-BOTIFY-001").not.toMatch(/^CASE-\d{4}-/);
    expect("IL-SHILL-BOTIFY-001").toMatch(/^IL-[A-Z]+-/);
  });
});

describe("S17/c2 — CONSTAT : le cinquième espace, et la couche est RÉSOLUE", () => {
  it("l'explorer compare `title`, et `title` EST `KolCase.caseId`", () => {
    // Trou de preuve refermé : il n'y a pas de couche de traduction cachée.
    expect(codeSeul(SRC(EXPLORER_ITEMS))).toContain("title: caseId,");
    expect(codeSeul(SRC(EXPLORER_PAGE))).toContain("items1.find((i: any) => i.title === caseId)");
  });

  it("LIMITE DÉCLARÉE — les VALEURS stockées ne sont pas mesurées ici", () => {
    // La forme est établie ; les valeurs ne le sont pas. Le commentaire de la
    // page les affirme, et un commentaire n'est pas une mesure.
    expect(SRC(EXPLORER_PAGE)).toContain('kolCase rows');
    expect(codeSeul(SRC(EXPLORER_PAGE))).not.toContain("BOTIFY-MAIN");
  });

  it("et le repli se termine par une DEVINETTE", () => {
    expect(codeSeul(SRC(EXPLORER_PAGE))).toContain("?? items2[0]");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AK · UN CONTOURNEMENT NE DEVIENT PAS INUTILE QUAND SA CAUSE PART
// ═════════════════════════════════════════════════════════════════════════

/** Ce qu'un contournement compense, et ce qu'il ferait si la cause partait. */
interface Contournement {
  /** Les causes qu'il DÉCLARE compenser. */
  causesDeclarees: string[];
  /** Celles qu'il compense RÉELLEMENT. */
  causesReelles: string[];
  /** Traite-t-il une forme courte comme une identité de dossier ? */
  formeCourteCommeIdentite: boolean;
  /** Se rabat-il sur une valeur arbitraire à défaut de correspondance ? */
  substitutionSilencieuse: boolean;
  /** La forme courte est-elle assumée comme SLUG d'affichage/routage ? */
  slugAssume: boolean;
}
type ImplAK = (causesRetirees: string[]) => Contournement | null;

const CAUSE_ANNEE = "reecriture-annee";
const CAUSE_SLUG = "forme-courte-kolcase";

function batterieAK(impl: ImplAK): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  // AK1 — retirer la cause AMONT déclarée ne rend pas le contournement
  // inutile : il en compense une seconde, non déclarée. Toute compensation
  // connue doit être REQUALIFIÉE avant d'être retenue ou retirée.
  const apres = impl([CAUSE_ANNEE]);
  dit(apres !== null, "AK1 contournement-suppose-inutile");

  const c = impl([]);
  if (c !== null) {
    // AK2 — une forme courte n'est pas une identité de dossier.
    dit(!c.formeCourteCommeIdentite || c.slugAssume, "AK2 forme-courte-comme-identite");
    // AK3 — pas de substitution silencieuse : à défaut de correspondance, on
    // ne prend pas « le premier venu ».
    dit(!c.substitutionSilencieuse, "AK3 substitution-silencieuse");
    // AK4 — les causes déclarées doivent couvrir les causes réelles, sinon la
    // requalification est impossible : on ne sait pas ce qu'on retire.
    dit(
      c.causesReelles.every((r) => c.causesDeclarees.includes(r)),
      "AK4 cause-reelle-non-declaree",
    );
  }
  // AK5 — SUR-CORRECTION. Un slug d'affichage ou de routage peut légitimement
  // exister. Le critère porte sur la CONFUSION avec l'identité, pas sur
  // l'existence d'un slug.
  const avecSlug = impl([CAUSE_ANNEE, CAUSE_SLUG]);
  dit(avecSlug === null || avecSlug.slugAssume, "AK5 slug-legitime-interdit");
  return v;
}

/** Le témoin : deux causes déclarées, slug assumé, aucune devinette. */
const TEMOIN_AK: ImplAK = (retirees) => {
  const restantes = [CAUSE_ANNEE, CAUSE_SLUG].filter((c) => !retirees.includes(c));
  if (restantes.length === 0) return null;
  return {
    causesDeclarees: [CAUSE_ANNEE, CAUSE_SLUG],
    causesReelles: restantes,
    formeCourteCommeIdentite: false,
    substitutionSilencieuse: false,
    slugAssume: true,
  };
};

describe("S17/ak — CRITÈRE : requalifier avant de retenir ou de retirer", () => {
  it("le TÉMOIN passe", () => expect(batterieAK(TEMOIN_AK)).toEqual([]));

  const MUTANTS_AK: Array<{ nom: string; critere: string; impl: ImplAK }> = [
    {
      nom: "LE PIÈGE — on retire la cause amont et on suppose le contournement inutile",
      critere: "AK1 contournement-suppose-inutile",
      impl: (retirees) => (retirees.includes(CAUSE_ANNEE) ? null : TEMOIN_AK([])),
    },
    {
      nom: "LE DÉFAUT ACTUEL — la forme courte devient l'identité, sans être assumée",
      critere: "AK2 forme-courte-comme-identite",
      impl: (r) => {
        const t = TEMOIN_AK(r);
        return t && { ...t, formeCourteCommeIdentite: true, slugAssume: false };
      },
    },
    {
      nom: "LE DÉFAUT ACTUEL, second volet — `?? items2[0]`, le premier venu",
      critere: "AK3 substitution-silencieuse",
      impl: (r) => {
        const t = TEMOIN_AK(r);
        return t && { ...t, substitutionSilencieuse: true };
      },
    },
    {
      nom: "une cause réelle n'est pas déclarée — la requalification est impossible",
      critere: "AK4 cause-reelle-non-declaree",
      impl: (r) => {
        const t = TEMOIN_AK(r);
        return t && { ...t, causesDeclarees: [CAUSE_ANNEE] };
      },
    },
    {
      nom: "SUR-CORRECTION — tout slug est interdit, même comme routage",
      critere: "AK5 slug-legitime-interdit",
      impl: (r) => {
        const t = TEMOIN_AK(r);
        return t ? { ...t, slugAssume: false, formeCourteCommeIdentite: false }
          : { causesDeclarees: [], causesReelles: [], formeCourteCommeIdentite: false,
              substitutionSilencieuse: false, slugAssume: false };
      },
    },
  ];

  for (const m of MUTANTS_AK) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAK(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AK est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AK1 contournement-suppose-inutile",
      "AK2 forme-courte-comme-identite",
      "AK3 substitution-silencieuse",
      "AK4 cause-reelle-non-declaree",
      "AK5 slug-legitime-interdit",
    ];
    const tues = new Set(MUTANTS_AK.flatMap((m) => batterieAK(m.impl)));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });

  it("l'état d'aujourd'hui MEURT sur AK2 et AK3", () => {
    const AUJOURDHUI: ImplAK = (retirees) => {
      const restantes = [CAUSE_ANNEE, CAUSE_SLUG].filter((c) => !retirees.includes(c));
      if (restantes.length === 0) return null;
      return {
        causesDeclarees: [CAUSE_ANNEE, CAUSE_SLUG],
        causesReelles: restantes,
        formeCourteCommeIdentite: true,
        substitutionSilencieuse: true,
        slugAssume: false,
      };
    };
    expect(batterieAK(AUJOURDHUI).sort()).toEqual([
      "AK2 forme-courte-comme-identite",
      "AK3 substitution-silencieuse",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AL · UN CHEMIN DE PRODUCTION QUI EXISTE ET N'A JAMAIS SERVI
// ═════════════════════════════════════════════════════════════════════════

describe("S17/al1 — CONSTAT : le chemin canonique existe, et il est complet", () => {
  it("la page admin appelle la route de génération", () => {
    expect(codeSeul(SRC(ADMIN_PAGE))).toContain('fetch("/api/casefile/generate"');
  });

  it("la route est protégée et produit le générateur CANONIQUE", () => {
    const c = codeSeul(SRC(ROUTE_GENERATE));
    expect(c).toContain("requireAdminApi");
    expect(c).toContain("generateCaseFilePdf");
    expect(c).toContain("loadCanonicalCaseFile");
    // Et elle résout les claims par l'AUTORITÉ, pas par le preset.
    //
    // ⚠ L'ASSERTION PORTE SUR L'USAGE, PAS SUR L'IDENTIFIANT. Première
    // écriture : `toContain("BOTIFY_CASEFILE_REF")`, qui passait tant que le
    // nom apparaissait QUELQUE PART — import compris. Une route qui importerait
    // la constante sans jamais s'en servir l'aurait satisfaite. La mutation M3
    // l'a montré en ne touchant que la ligne d'import : elle a muté, et le test
    // n'a pas mordu. Une assertion plus lâche que son nom, une fois de plus.
    expect(c).toContain("botify: BOTIFY_CASEFILE_REF,");
    expect(c).toContain("vine: VINE_CASEFILE_REF,");
  });

  it("⛔ mais l'écran qui GÉNÈRE le dossier affiche une référence PÉRIMÉE", () => {
    // `CASE-2025-BOTIFY-001` dans l'écran même dont la route résout par
    // `IL-SHILL-BOTIFY-001`. Deux espaces de nommage à un clic d'écart.
    expect(codeSeul(SRC(ADMIN_PAGE))).toContain("BOTIFY — CASE-2025-BOTIFY-001");
    expect(codeSeul(SRC(ADMIN_PAGE))).not.toContain("IL-SHILL-BOTIFY-001");
  });
});

interface CheminProduction {
  /** Le générateur réellement appelé. */
  generateur: "CANONIQUE" | "AUTRE";
  /** L'autorité par laquelle les claims sont résolus. */
  autoriteDesClaims: "GOUVERNEE" | "PRESET" | "AUCUNE";
  /** La référence affichée dans l'UI qui déclenche la génération. */
  referenceAffichee: string | null;
  /** La référence que l'autorité reconnaît. */
  referenceGouvernee: string;
}
type ImplAL = () => CheminProduction;

function batterieAL(impl: ImplAL): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const p = impl();

  // AL1 — le chemin de production produit bien l'artefact CANONIQUE. C'est
  // « declared canonicality != consumed authority », appliqué à la PRODUCTION.
  dit(p.generateur === "CANONIQUE", "AL1 chemin-produit-un-autre-artefact");
  // AL2 — et il résout les claims par l'autorité gouvernée.
  dit(p.autoriteDesClaims === "GOUVERNEE", "AL2 claims-hors-autorite");
  // AL3 — l'UI qui déclenche n'affiche pas une référence que l'autorité ne
  // reconnaît pas. Un opérateur qui lit l'écran doit pouvoir relier ce qu'il
  // génère à ce que le système nomme.
  if (p.referenceAffichee !== null) {
    dit(p.referenceAffichee === p.referenceGouvernee, "AL3 reference-ui-perimee");
  }
  // AL4 — SUR-CORRECTION. Un libellé d'UI n'est pas une autorité de nommage :
  // le critère porte sur la COHÉRENCE, pas sur l'interdiction d'afficher une
  // référence. Retirer l'affichage n'est pas la correction.
  dit(p.referenceAffichee !== null, "AL4 reference-ui-supprimee");
  return v;
}

const TEMOIN_AL: ImplAL = () => ({
  generateur: "CANONIQUE", autoriteDesClaims: "GOUVERNEE",
  referenceAffichee: "IL-SHILL-BOTIFY-001", referenceGouvernee: "IL-SHILL-BOTIFY-001",
});

describe("S17/al2 — CRITÈRE : le chemin produit le canonique, et l'écran le dit", () => {
  it("le TÉMOIN passe", () => expect(batterieAL(TEMOIN_AL)).toEqual([]));

  const MUTANTS_AL: Array<{ nom: string; critere: string; impl: ImplAL }> = [
    {
      nom: "la page admin bascule sur un autre générateur",
      critere: "AL1 chemin-produit-un-autre-artefact",
      impl: () => ({ ...TEMOIN_AL(), generateur: "AUTRE" }),
    },
    {
      nom: "les claims reviennent au preset au lieu de l'autorité",
      critere: "AL2 claims-hors-autorite",
      impl: () => ({ ...TEMOIN_AL(), autoriteDesClaims: "PRESET" }),
    },
    {
      nom: "LE DÉFAUT ACTUEL — l'écran affiche CASE-2025-BOTIFY-001",
      critere: "AL3 reference-ui-perimee",
      impl: () => ({ ...TEMOIN_AL(), referenceAffichee: "CASE-2025-BOTIFY-001" }),
    },
    {
      nom: "SUR-CORRECTION — on retire la référence de l'écran pour éviter l'incohérence",
      critere: "AL4 reference-ui-supprimee",
      impl: () => ({ ...TEMOIN_AL(), referenceAffichee: null }),
    },
  ];

  for (const m of MUTANTS_AL) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAL(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AL est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AL1 chemin-produit-un-autre-artefact",
      "AL2 claims-hors-autorite",
      "AL3 reference-ui-perimee",
      "AL4 reference-ui-supprimee",
    ];
    const tues = new Set(MUTANTS_AL.flatMap((m) => batterieAL(m.impl)));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });

  it("l'état d'aujourd'hui MEURT sur AL3, et sur AL3 SEULEMENT", () => {
    // Le chemin lui-même est CORRECT : générateur canonique, claims par
    // l'autorité. Seul l'écran ment. Le défaut est localisé, et le dire évite
    // de condamner un chemin qui tient.
    const AUJOURDHUI: ImplAL = () => ({
      generateur: "CANONIQUE", autoriteDesClaims: "GOUVERNEE",
      referenceAffichee: "CASE-2025-BOTIFY-001", referenceGouvernee: "IL-SHILL-BOTIFY-001",
    });
    expect(batterieAL(AUJOURDHUI)).toEqual(["AL3 reference-ui-perimee"]);
  });
});
