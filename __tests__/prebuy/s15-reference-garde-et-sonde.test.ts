// ─── BUILD 12 · S15 — RÉFÉRENCE, GARDE CASSÉE, ET LA SONDE QUI REND ───────
//
// ██  AG · une référence de dossier INSTABLE est pire qu'aucune référence   ██
// ██  AE · une GARDE cassée a rendu un repli universel — pas un texte       ██
// ██  AH · pour un artefact, la sonde REND ; elle ne grep pas               ██
//
// ─── AG · LA RÉFÉRENCE EST RÉÉCRITE EN TRANSIT, ET L'ANNÉE EST L'HORLOGE ─
//
//   ██  src/app/api/scan/solana/route.ts:184                              ██
//   ██                                                                     ██
//   ██  off_chain.case_id = caseFile.case_meta.case_id                     ██
//   ██    .replace(/CASE-\d{4}-/, `CASE-${new Date().getFullYear()}-`);    ██
//
//   La route SERVANTE écrase l'année du dossier avec L'ANNÉE COURANTE À
//   L'INSTANT DE LA REQUÊTE. Le dossier stocké est CASE-2024-BOTIFY-001 ;
//   servi en 2026 il devient CASE-2026-BOTIFY-001, et servi en 2027 il
//   deviendra CASE-2027-BOTIFY-001.
//
//   LA RÉFÉRENCE IMPRIMÉE SUR LA PIÈCE CHANGE DONC CHAQUE 1ᵉʳ JANVIER. Deux
//   tirages du même dossier à un jour d'intervalle, de part et d'autre du
//   nouvel an, portent deux références différentes — et le document ne dit
//   nulle part que sa référence est instable.
//
//   C'est mon critère AG3 (« une référence neuve à chaque tirage »), mais sous
//   une forme PIRE que le nonce par rendu : une réécriture ANNUELLE paraît
//   parfaitement stable à tout test écrit dans l'année, et casse en silence
//   une fois par an — en invalidant RÉTROACTIVEMENT toute citation déjà émise.
//
//   ─── Ce que ça explique ─────────────────────────────────────────────────
//
//   CASE-2024-BOTIFY-001   la valeur STOCKÉE, `data/cases/botify.json`, lue
//                          par `loadCaseByMint` — 8 fichiers du dépôt
//   CASE-2025-BOTIFY-001   `src/lib/casefile/presets.ts:55` — le même bug,
//                          figé dans le code l'an dernier
//   CASE-2026-BOTIFY-001   la valeur SERVIE cette année, et celle du PDF réel
//                          remis au fondateur
//
//   Et la conséquence est déjà connue en aval : `src/app/en/explorer/[caseId]/
//   page.tsx:39-44` porte un CONTOURNEMENT documenté — « Some case IDs
//   reaching this page are synthetic (e.g. CASE-2026-BOTIFY-001 produced by
//   /api/scan/solana which rewrites the year) [...] We try the exact caseId
//   first, then fall back to the extracted slug. » Le défaut n'est pas
//   ignoré : il est absorbé, une surface à la fois.
//
//   Et S1B met ce champ EN TÊTE du document. Le défaut ne se voit qu'au moment
//   où l'on s'en sert — c'est-à-dire trop tard, et une fois par an.
//
//   ─── UNE MESURE DE MOI, FAUSSE, CORRIGÉE AVANT COMMIT ──────────────────
//
//   J'ai d'abord écrit que la forme 2026 n'était « nulle part dans le dépôt ».
//   FAUX : mon grep portait `--include='*.ts' --include='*.json'`, donc
//   EXCLUAIT les `.tsx` — c'est-à-dire exactement la page qui la porte.
//   Septième fois qu'une sonde à moi exclut le fichier qui détient la réponse,
//   et la même faute que l'exclusion de `src/lib/solanaGraph/`. C'est le test
//   S15/ag1, découvrant l'univers au lieu de l'énumérer, qui a refusé de
//   passer et m'a envoyé chercher.
//
// ─── AE · REDÉFINI PAR LA MESURE — la garde, pas le texte ──────────────
//
//   `fe4ea04` n'a PAS touché `pdfRenderer.ts` : il a rewiré
//   /api/scan/solana/graph vers GraphCase DB. Le texte « unavailable for this
//   token » existait DÉJÀ avant lui (vérifié à `fe4ea04~1`), écrit comme un
//   repli LÉGITIME de l'ère Helius — pas de clé, pas de rapport.
//
//   Personne n'a jamais écrit une phrase fausse. UNE GARDE CASSÉE A RENDU UN
//   REPLI VRAI UNIVERSELLEMENT APPLICABLE, DANS UN MONDE OÙ SA CAUSE N'EXISTAIT
//   PLUS. C'est la voie A / voie B de S11, et ça change le correctif : il n'y a
//   pas de texte à restaurer, il y a un chemin de données à rebrancher.
//
// ─── AH · LA SIXIÈME FORME, ET LA PLUS COÛTEUSE ────────────────────────
//
//   Les cinq formes précédentes étaient des contrôles qui ne contrôlaient pas.
//   Celle-ci est différente : LA SONDE FONCTIONNE, LA REQUÊTE EST CORRECTE,
//   LES BONS MOTS SONT CHERCHÉS — et le résultat est faux parce que le texte
//   n'est pas là où il s'affiche. Les libellés du CaseFile passent par une
//   table i18n ; un grep de littéral sur `pdfRenderer.ts` les manque TOUS.
//
//   Pour un ARTEFACT, chercher le bon mot dans le bon fichier ne suffit pas.
//   La sonde REND, et lit ce qui en sort.
//
// ─── UNE SECONDE PROPRIÉTÉ ÉMERGENTE, ET ELLE EST TOMBÉE SUR SON AUTEUR ─
//
// ██  UN UNIVERS DÉCOUVERT ATTRAPE CE QU'UNE LISTE AURAIT CONFIRMÉ.        ██
//
// Constaté le 2026-09-10, contre moi. J'ai écrit que la forme 2026 n'était
// « nulle part dans le dépôt ». Mon grep portait `--include='*.ts'
// --include='*.json'` : il EXCLUAIT les `.tsx`, c'est-à-dire exactement la
// page qui la porte. Même faute que l'exclusion de `src/lib/solanaGraph/`, qui
// m'avait fait déclarer orphelin un moteur vivant.
//
// Ce qui l'a attrapée est S15/ag1, qui DÉCOUVRE l'univers au lieu de
// l'énumérer : il a refusé de passer et m'a envoyé chercher. Une liste écrite
// à la main aurait confirmé mon erreur en silence, et le commit serait parti.
//
// C'est le pendant de la propriété notée en tête de S10 — « ce corpus remarque
// qu'on l'a vidé ». Les deux sont des conséquences de la FORME choisie, pas
// des critères écrits, et aucune n'avait été posée comme objectif :
//
//   S10  un corpus qui asserte l'EXISTENCE de ses gardes signale son
//        affaiblissement
//   S15  un corpus qui DÉCOUVRE son univers signale l'erreur de son auteur
//
// Corollaire à tenir avec l'autre : ne jamais remplacer une découverte par une
// liste au motif qu'elle serait « plus lisible ». La liste est plus lisible et
// elle est d'accord avec vous, ce qui est exactement le problème.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderCaseFilePDF } from "@/components/pdf/pdfRenderer";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const scanDe = (caseId: string): any => ({
  mint: "MINT-A", scanned_at: "2026-09-10T11:22:33.000Z",
  off_chain: { claims: [], source: "CaseDB", status: "Referenced", summary: "s", case_id: caseId },
  on_chain: { markets: { source: null, primary_pool: null, dex: null, url: null, price: null,
    liquidity_usd: null, volume_24h_usd: null, fdv_usd: null,
    fetched_at: "2026-09-10T11:22:33.000Z", cache_hit: false } },
  risk: { score: 50, tier: "ORANGE", flags: [], breakdown: { claim_penalty: 0, severity_multiplier: 1 } },
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AG · UNE RÉFÉRENCE INSTABLE EST PIRE QU'AUCUNE RÉFÉRENCE
// ═════════════════════════════════════════════════════════════════════════

const fichiers = (racine: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(racine, { withFileTypes: true })) {
    const p = join(racine, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") out.push(...fichiers(p)); }
    else if (/\.(ts|tsx|json)$/.test(e.name)) out.push(p);
  }
  return out;
};

/** L'univers est DÉCOUVERT : toute référence de dossier BOTIFY, où qu'elle soit. */
const REFS_TROUVEES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const f of [...fichiers("src"), ...fichiers("data")]) {
    for (const m of SRC(f).matchAll(/CASE-(\d{4})-BOTIFY-001/g)) {
      (out[m[1]] ??= []).includes(f) || (out[m[1]] ??= []).push(f);
    }
  }
  return out;
})();

describe("S15/ag1 — CONSTAT : trois références pour un seul dossier", () => {
  it("le dépôt en porte TROIS, découvertes et non énumérées", () => {
    // L'univers est DÉCOUVERT — `.tsx` compris, faute de quoi la troisième
    // échappe. Voir la rectification en tête.
    expect(Object.keys(REFS_TROUVEES).sort()).toEqual(["2024", "2025", "2026"]);
    expect(REFS_TROUVEES["2024"].length).toBeGreaterThanOrEqual(5);
    expect([...REFS_TROUVEES["2025"]].sort()).toEqual([
      "src/app/admin/casefile-generator/page.tsx",
      "src/lib/casefile/presets.ts",
    ]);
    expect(REFS_TROUVEES["2026"]).toEqual(["src/app/en/explorer/[caseId]/page.tsx"]);
  });

  it("la source que le PDF lit RÉELLEMENT porte la forme 2024", () => {
    // `loadCaseByMint` lit le JSON de dossier ; c'est de là que vient le
    // `case_id` rendu en tête du document.
    expect(SRC("data/cases/botify.json")).toContain("CASE-2024-BOTIFY-001");
  });

  it("LA CAUSE — la route servante réécrit l'année avec l'horloge", () => {
    // Le cœur du défaut, et il tient en une ligne.
    expect(codeSeul(SRC("src/app/api/scan/solana/route.ts"))).toContain(
      "case_id.replace(/CASE-\\d{4}-/, `CASE-${new Date().getFullYear()}-`)",
    );
  });

  it("et l'aval porte déjà un CONTOURNEMENT documenté", () => {
    // Le défaut n'est pas ignoré : il est absorbé, une surface à la fois.
    const p = SRC("src/app/en/explorer/[caseId]/page.tsx");
    expect(p).toContain("which rewrites the year");
    expect(codeSeul(p)).toContain("caseId.match(/^CASE-\\d{4}-(.+?)-\\d+$/)");
  });

  it("CONSÉQUENCE — deux tirages de part et d'autre du nouvel an divergent", () => {
    // Reproduction annoncée de l'expression du site (ancrée ci-dessus) : ce
    // qui est démontré est la propriété de la réécriture, pas la route.
    const reecrire = (stocke: string, annee: number) =>
      stocke.replace(/CASE-\d{4}-/, `CASE-${annee}-`);
    expect(reecrire("CASE-2024-BOTIFY-001", 2026)).toBe("CASE-2026-BOTIFY-001");
    expect(reecrire("CASE-2024-BOTIFY-001", 2027)).toBe("CASE-2027-BOTIFY-001");
    expect(reecrire("CASE-2024-BOTIFY-001", 2026)).not.toBe(
      reecrire("CASE-2024-BOTIFY-001", 2027),
    );
  });

  it("COMPORTEMENTAL — le renderer imprime la référence qu'on lui donne, sans la valider", () => {
    // Il n'y a aucune garde : n'importe quelle chaîne devient la référence
    // citable du document.
    const html = renderCaseFilePDF(scanDe("CASE-9999-INVENTEE-042"), "en", null);
    expect(html).toContain("CASE-9999-INVENTEE-042");
  });
});

// ─── Le critère ──────────────────────────────────────────────────────────

type Source = "CASEDB" | "PRESET" | "PDF_SERVI";
const SOURCES: Source[] = ["CASEDB", "PRESET", "PDF_SERVI"];

interface Reference {
  valeur: string | null;
  /** Le document présente-t-il cette référence comme CITABLE ? */
  presenteeCommeCitable: boolean;
  /** Résout-elle vers le dossier, depuis n'importe quelle source ? */
  resoluble: boolean;
}
type ImplAG = (s: Source, tirage: 1 | 2) => Reference;

function batterieAG(impl: ImplAG): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  const valeurs = SOURCES.map((s) => impl(s, 1).valeur);
  // AG1 — une seule référence pour un dossier, quelle que soit la source.
  dit(new Set(valeurs).size === 1, "AG1 reference-varie-selon-la-source");
  // AG2 — présentée comme citable, elle doit être RÉSOLUBLE. Imprimer en tête
  // une référence que le système ne reconnaît pas est le défaut mesuré.
  for (const s of SOURCES) {
    const r = impl(s, 1);
    if (r.presenteeCommeCitable) dit(r.resoluble, "AG2 citable-non-resoluble");
  }
  // AG3 — SUR-CORRECTION, et c'est AA4 appliqué à la lettre : « résoudre »
  // l'instabilité en tirant une référence neuve à chaque génération détruit la
  // citabilité au lieu de la rétablir.
  dit(impl("CASEDB", 1).valeur === impl("CASEDB", 2).valeur, "AG3 reference-neuve-a-chaque-tirage");
  // AG4 — SUR-CORRECTION. On ne retire pas l'identification par prudence : une
  // référence stable et unique reste affichée, et présentée comme citable.
  dit(
    impl("CASEDB", 1).valeur !== null && impl("CASEDB", 1).presenteeCommeCitable,
    "AG4 identification-retiree",
  );
  return v;
}

const TEMOIN_AG: ImplAG = () => ({
  valeur: "CASE-2024-BOTIFY-001", presenteeCommeCitable: true, resoluble: true,
});

describe("S15/ag2 — CRITÈRE : une référence, résoluble, stable entre les tirages", () => {
  it("le TÉMOIN passe", () => expect(batterieAG(TEMOIN_AG)).toEqual([]));

  const MUTANTS_AG: Array<{ nom: string; critere: string; impl: ImplAG }> = [
    {
      nom: "LE DÉFAUT ACTUEL — 2024 en base, 2025 au preset, 2026 sur la pièce",
      critere: "AG1 reference-varie-selon-la-source",
      impl: (s) => ({
        valeur: s === "CASEDB" ? "CASE-2024-BOTIFY-001"
          : s === "PRESET" ? "CASE-2025-BOTIFY-001" : "CASE-2026-BOTIFY-001",
        presenteeCommeCitable: true, resoluble: s !== "PDF_SERVI",
      }),
    },
    {
      nom: "la référence est imprimée en tête, et ne résout vers rien",
      critere: "AG2 citable-non-resoluble",
      impl: () => ({ ...TEMOIN_AG("CASEDB", 1), resoluble: false }),
    },
    {
      nom: "SUR-CORRECTION — une référence neuve à chaque tirage « règle » l'instabilité",
      critere: "AG3 reference-neuve-a-chaque-tirage",
      impl: (s, t) => ({ ...TEMOIN_AG(s, t), valeur: `CASE-GEN-${t}` }),
    },
    {
      nom: "SUR-CORRECTION — l'identification est retirée par prudence",
      critere: "AG4 identification-retiree",
      impl: () => ({ valeur: null, presenteeCommeCitable: false, resoluble: false }),
    },
  ];

  for (const m of MUTANTS_AG) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAG(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AG est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_AG = [
      "AG1 reference-varie-selon-la-source",
      "AG2 citable-non-resoluble",
      "AG3 reference-neuve-a-chaque-tirage",
      "AG4 identification-retiree",
    ];
    const tues = new Set(MUTANTS_AG.flatMap((m) => batterieAG(m.impl)));
    expect(CRITERES_AG.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AG.includes(c))).toEqual([]);
    expect(SOURCES).toHaveLength(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AE · UNE GARDE CASSÉE REND UN REPLI UNIVERSEL
// ═════════════════════════════════════════════════════════════════════════

describe("S15/ae1 — CONSTAT : le texte est ANTÉRIEUR à la panne qu'il décrit", () => {
  it("le repli existe encore, avec sa cause d'origine", () => {
    const html = renderCaseFilePDF(scanDe("CASE-A"), "en", null);
    expect(html).toContain("Graph data unavailable for this token.");
    expect(html).toContain("Re-run analysis with HELIUS_API_KEY configured.");
  });

  it("et la GARDE qui le rend universel est toujours là", () => {
    // Le mécanisme, pas le texte : `version === "1.0"` contre un producteur
    // qui n'émet pas de `version`. Voir S11 pour la chaîne complète.
    expect(codeSeul(SRC("src/app/api/report/casefile/route.ts")))
      .toContain('if (gData?.version === "1.0") graphReport = gData;');
    expect(codeSeul(SRC("src/app/api/scan/solana/graph/route.ts"))).not.toMatch(/version\s*:/);
  });
});

/** L'état d'un repli : sa cause d'origine est-elle encore la vraie cause ? */
interface Repli {
  /** La garde de forme accepte-t-elle encore une réponse du producteur ? */
  gardeSatisfiable: boolean;
  /** La cause NOMMÉE par le texte est-elle celle qui s'applique ? */
  causeNommeeEncoreVraie: boolean;
  /** Le repli est-il devenu le SEUL chemin possible ? */
  seulChemin: boolean;
  /** Une mesure a-t-elle produit un zéro, compteurs et fournisseur nommés ? */
  zeroMesure: { compteurs: boolean; fournisseurNomme: boolean } | null;
}
type ImplAE = () => Repli;

function batterieAE(impl: ImplAE): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const r = impl();

  // AE1 — une garde de forme qui n'est plus satisfiable rend le repli
  // universel. C'est le mécanisme du défaut, et il est indépendant du texte.
  dit(r.gardeSatisfiable, "AE1 garde-insatisfiable-repli-universel");
  // AE2 — un repli ne se sert pas sans vérifier que sa CAUSE est encore la
  // vraie. Le texte était vrai ; sa cause a disparu.
  if (r.seulChemin) dit(r.causeNommeeEncoreVraie, "AE2 cause-du-repli-perimee");
  // AE3 — un ZÉRO MESURÉ ne se rend pas comme une absence : les compteurs et
  // le fournisseur font la différence entre « rien trouvé » et « rien cherché ».
  if (r.zeroMesure !== null) {
    dit(r.zeroMesure.compteurs, "AE3 compteurs-supprimes");
    dit(r.zeroMesure.fournisseurNomme, "AE4 fournisseur-non-nomme");
  }
  return v;
}

const TEMOIN_AE: ImplAE = () => ({
  gardeSatisfiable: true, causeNommeeEncoreVraie: true, seulChemin: false,
  zeroMesure: { compteurs: true, fournisseurNomme: true },
});

describe("S15/ae2 — CRITÈRE : la garde tient, la cause est vraie, le zéro se dit", () => {
  it("le TÉMOIN passe", () => expect(batterieAE(TEMOIN_AE)).toEqual([]));

  const MUTANTS_AE: Array<{ nom: string; critere: string; impl: ImplAE }> = [
    {
      nom: "LE DÉFAUT ACTUEL — garde insatisfiable, le repli devient le seul chemin",
      critere: "AE1 garde-insatisfiable-repli-universel",
      impl: () => ({ ...TEMOIN_AE(), gardeSatisfiable: false, seulChemin: true }),
    },
    {
      nom: "le repli est servi alors que sa cause a disparu",
      critere: "AE2 cause-du-repli-perimee",
      impl: () => ({ ...TEMOIN_AE(), seulChemin: true, causeNommeeEncoreVraie: false }),
    },
    {
      nom: "les compteurs sont supprimés, le verdict reste — « rien trouvé » devient « rien »",
      critere: "AE3 compteurs-supprimes",
      impl: () => ({ ...TEMOIN_AE(), zeroMesure: { compteurs: false, fournisseurNomme: true } }),
    },
    {
      nom: "le fournisseur d'une mesure aboutie n'est plus nommé",
      critere: "AE4 fournisseur-non-nomme",
      impl: () => ({ ...TEMOIN_AE(), zeroMesure: { compteurs: true, fournisseurNomme: false } }),
    },
  ];

  for (const m of MUTANTS_AE) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAE(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("SUR-CORRECTION — une vraie indisponibilité reste disable, avec sa cause RÉELLE", () => {
    // On ne remplace pas une fausse cause par un faux zéro. Une panne qui
    // survient, dont la cause nommée est la bonne, passe la batterie.
    const PANNE_HONNETE: ImplAE = () => ({
      gardeSatisfiable: true, causeNommeeEncoreVraie: true, seulChemin: true, zeroMesure: null,
    });
    expect(batterieAE(PANNE_HONNETE)).toEqual([]);
  });

  it("GARDE ANTI-VACUITÉ — chaque critère AE est tué, et aucun n'échappe à la liste", () => {
    const CRITERES_AE = [
      "AE1 garde-insatisfiable-repli-universel",
      "AE2 cause-du-repli-perimee",
      "AE3 compteurs-supprimes",
      "AE4 fournisseur-non-nomme",
    ];
    const tues = new Set(MUTANTS_AE.flatMap((m) => batterieAE(m.impl)));
    expect(CRITERES_AE.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_AE.includes(c))).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AH · LA SONDE REND, ELLE NE GREP PAS
// ═════════════════════════════════════════════════════════════════════════
//
// Armé contre NOS PROPRES corpus. Le test est simple : une assertion qui
// conclut à l'ABSENCE d'un contenu RENDU doit porter sur un rendu, jamais sur
// une source — parce qu'un libellé peut vivre dans une table i18n.

const CORPUS_ARTEFACT = [
  "__tests__/prebuy/s12-ambiguite-operationnelle-et-registre.test.ts",
  "__tests__/prebuy/s13-identite-autorite-artefact.test.ts",
  "__tests__/prebuy/s14-promesses-empreinte-et-temps.test.ts",
] as const;

describe("S15/ah1 — AUTO-AUDIT : nos négations d'artefact portent sur un RENDU", () => {
  it("chaque `not.toMatch`/`not.toContain` sur un contenu rendu porte sur `html`", () => {
    // On extrait les assertions négatives et on vérifie leur SUJET. Une
    // négation sur `SRC(...)` reste légitime quand elle vise du CODE (un
    // import, un appel, un littéral de contrat) ; elle ne l'est pas pour un
    // contenu affiché.
    const suspectes: string[] = [];
    for (const f of CORPUS_ARTEFACT) {
      SRC(f).split("\n").forEach((l, i) => {
        const negation = /expect\((html|rendu)\)\s*\.not\./.test(l);
        const surSource = /expect\(\s*(codeSeul\()?SRC\(/.test(l) && /\.not\./.test(l);
        // Une négation sur source qui cherche un libellé D'AFFICHAGE.
        if (surSource && /Confidential|Generated by|Reproduce|Sources & Method|CaseFile Report/.test(l)) {
          suspectes.push(`${f}:${i + 1}`);
        }
        void negation;
      });
    }
    expect(suspectes, "négation d'un libellé AFFICHÉ, faite sur la SOURCE").toEqual([]);
  });

  it("et l'inventaire positif de S12 est bien fait sur un rendu", () => {
    const s12 = SRC(CORPUS_ARTEFACT[0]);
    expect(s12).toContain("MESURÉ SUR L'ARTEFACT");
    expect(s12).toContain('expect(html, `le document ne porte plus : ${marque}`).toContain(marque)');
  });

  it("SUR-CORRECTION — un grep sur du CODE reste légitime", () => {
    // La règle vise les CONTENUS RENDUS. Une garde, un appel, un littéral de
    // contrat se cherchent dans la source, et c'est correct.
    const s12 = SRC(CORPUS_ARTEFACT[0]);
    expect(s12).toContain('expect(codeSeul(SRC(AUTORITAIRE))).not.toContain("renderCaseFilePDF")');
  });
});

describe("S15/ah2 — la table i18n est la raison, et elle est nommée", () => {
  it("les libellés du CaseFile viennent d'une table, pas de littéraux", () => {
    const r = codeSeul(SRC("src/components/pdf/pdfRenderer.ts"));
    for (const cle of ["t.howToReproduce", "t.sourcesMethod", "t.engine", "t.timestamp"]) {
      expect(r, `${cle} a disparu — la sonde d'AH doit être revue`).toContain(cle);
    }
    // Et les libellés eux-mêmes ne sont PAS dans ce fichier : c'est tout le
    // piège, en une assertion.
    expect(r).not.toContain("How to Reproduce");
    expect(r).not.toContain("Confidential — For Internal Review Only");
  });

  it("alors qu'ils SONT dans le document rendu", () => {
    const html = renderCaseFilePDF(scanDe("CASE-A"), "en", null);
    expect(html).toContain("How to Reproduce");
    expect(html).toContain("Confidential — For Internal Review Only");
  });
});
