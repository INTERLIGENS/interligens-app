// ─── BUILD 12 · S16 — UNE SEULE AUTORITÉ, ET UNE MÉTHODOLOGIE QUI NE MENT PAS
//
// ██  AG+ · une référence de dossier ne se dérive pas de L'HORLOGE          ██
// ██  AI  · une méthodologie décrit ce que l'artefact PUBLIE                ██
// ██  AJ  · reproductibilité d'ARTEFACT ≠ recalcul de SCORE                 ██
//
// ─── AI · LE DÉFAUT EST LIVE, ET IL EST TOTAL ──────────────────────────
//
// Mesuré sur l'ARTEFACT RENDU le 2026-09-10 — priorité de preuve 1, pas un
// grep. La page « Sources & Method » publie :
//
//   « Scoring: CRITICAL×15 + HIGH×10 + MEDIUM×5 + LOW×2, multiplier ×1.2 if
//     CRITICAL present »
//   « Floor rule: claims ≥ 6 → score ≥ 70 (tier RED guaranteed) »
//
// et la page « How to Reproduce » publie, à la ligne Score :
//
//   « Withheld — Score withheld — this document does not publish the corpus it
//     was computed from. »
//
// L'ARTEFACT NE PUBLIE NI LE SCORE NI LE TIER. Vérifié sur le texte rendu :
// « ORANGE » est absent, « 50 » est absent, « /100 » est absent, et les seules
// occurrences de « RED » et de « tier » sont À L'INTÉRIEUR de la phrase de la
// règle de plancher elle-même.
//
// Le document explique donc en détail comment calculer un nombre qu'il refuse
// de publier, et refuse de le publier au motif qu'il ne publie pas le corpus.
// Chaque partie est défendable seule ; ensemble, elles publient LA
// MÉTHODOLOGIE D'UNE ASSERTION QUE L'ARTEFACT NE FAIT PAS.
//
// La méthodologie n'est pas PARTIELLEMENT orpheline — elle l'est TOTALEMENT,
// et c'est ce qui rend le cas net : la sur-correction « si le moteur est une
// entrée réelle, dis son rôle et sa version » ne s'applique pas ici, faute
// d'assertion publiée à gouverner.
//
// ─── AJ · ET LA TABLE DE REPRODUCTION DÉCLARE CE QU'ELLE NE PUBLIE PAS ──
//
// « How to Reproduce » liste `Score` comme champ de reproduction, et sa valeur
// est « Withheld ». La table annonce donc une entrée gouvernante qu'elle ne
// publie pas — c'est mon critère de SUFFISANCE d'AF, violé en production.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
/** Le texte VU par un lecteur : balises retirées, espaces normalisés. */
const texteRendu = (caseId = "CASE-A"): string =>
  renderCaseFilePDF(scanDe(caseId), "en", null).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// ═════════════════════════════════════════════════════════════════════════
// AXE AG+ · UNE SEULE AUTORITÉ, ET LE TEMPS N'EN EST PAS UNE
// ═════════════════════════════════════════════════════════════════════════

/** Une horloge INJECTÉE : le critère ne doit pas dépendre du jour où il tourne. */
type Horloge = () => number;

interface ResolutionRef {
  /** La référence servie. */
  valeur: string | null;
  /** Est-elle présentée comme citable ? */
  citable: boolean;
  /** Les alias historiques encore rattachables, s'il y en a. */
  alias: string[];
}
/** Résout la référence d'un dossier stocké, sous une horloge donnée. */
type ImplAG = (stocke: string, horloge: Horloge, source: "CASEDB" | "PRESET" | "ADMIN") => ResolutionRef;

const SOURCES_AG = ["CASEDB", "PRESET", "ADMIN"] as const;
const H2026: Horloge = () => 2026;
const H2027: Horloge = () => 2027;

function batterieAG(impl: ImplAG): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const STOCKE = "CASE-2024-BOTIFY-001";

  // AG5 — L'HORLOGE N'EST PAS UNE AUTORITÉ. Deux horloges, même référence.
  // Le critère est écrit avec des horloges INJECTÉES : il tient donc aussi le
  // 1ᵉʳ janvier, jour où un test qui lirait l'horloge réelle passerait à tort.
  dit(
    impl(STOCKE, H2026, "CASEDB").valeur === impl(STOCKE, H2027, "CASEDB").valeur,
    "AG5 reference-derivee-de-l-horloge",
  );
  // AG6 — une seule autorité : aucune source concurrente ne déclare la sienne.
  const parSource = SOURCES_AG.map((s) => impl(STOCKE, H2026, s).valeur);
  dit(new Set(parSource).size === 1, "AG6 source-concurrente");
  // AG7 — pas de repli silencieux vers une valeur dérivée : la référence servie
  // est celle du dossier STOCKÉ, pas une reconstruction.
  dit(impl(STOCKE, H2026, "CASEDB").valeur === STOCKE, "AG7 repli-vers-une-derivee");
  // AG8 — SUR-CORRECTION. Les alias historiques peuvent être conservés
  // EXPLICITEMENT : une pièce déjà émise sous CASE-2026-… doit rester
  // rattachable. Les supprimer détache les documents déjà partis.
  dit(impl(STOCKE, H2026, "CASEDB").alias.length > 0, "AG8 alias-historique-supprime");
  // AG9 — SUR-CORRECTION. On ne supprime pas l'identité pour éviter
  // l'instabilité : la référence reste servie et présentée comme citable.
  const r = impl(STOCKE, H2026, "CASEDB");
  dit(r.valeur !== null && r.citable, "AG9 identite-supprimee");
  return v;
}

const TEMOIN_AG: ImplAG = (stocke) => ({
  valeur: stocke, citable: true, alias: ["CASE-2025-BOTIFY-001", "CASE-2026-BOTIFY-001"],
});

describe("S16/ag — CRITÈRE : une autorité, et l'horloge n'en est pas une", () => {
  it("le TÉMOIN passe", () => expect(batterieAG(TEMOIN_AG)).toEqual([]));

  const MUTANTS_AG: Array<{ nom: string; critere: string; impl: ImplAG }> = [
    {
      nom: "LE DÉFAUT ACTUEL — l'année est réécrite avec l'horloge (route.ts:184)",
      critere: "AG5 reference-derivee-de-l-horloge",
      impl: (stocke, horloge) => ({
        valeur: stocke.replace(/CASE-\d{4}-/, `CASE-${horloge()}-`),
        citable: true, alias: [],
      }),
    },
    {
      nom: "une seconde source déclare sa propre référence (presets, admin)",
      critere: "AG6 source-concurrente",
      impl: (stocke, h, source) => ({
        ...TEMOIN_AG(stocke, h, source),
        valeur: source === "CASEDB" ? stocke : "CASE-2025-BOTIFY-001",
      }),
    },
    {
      nom: "repli silencieux : la référence est reconstruite au lieu d'être lue",
      critere: "AG7 repli-vers-une-derivee",
      impl: (stocke, h, s) => ({ ...TEMOIN_AG(stocke, h, s), valeur: "CASE-DERIVEE-001" }),
    },
    {
      nom: "SUR-CORRECTION — les alias historiques sont supprimés, les pièces émises se détachent",
      critere: "AG8 alias-historique-supprime",
      impl: (stocke, h, s) => ({ ...TEMOIN_AG(stocke, h, s), alias: [] }),
    },
    {
      nom: "SUR-CORRECTION — l'identité est supprimée pour éviter l'instabilité",
      critere: "AG9 identite-supprimee",
      impl: () => ({ valeur: null, citable: false, alias: [] }),
    },
  ];

  for (const m of MUTANTS_AG) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAG(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AG+ est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AG5 reference-derivee-de-l-horloge",
      "AG6 source-concurrente",
      "AG7 repli-vers-une-derivee",
      "AG8 alias-historique-supprime",
      "AG9 identite-supprimee",
    ];
    const tues = new Set(MUTANTS_AG.flatMap((m) => batterieAG(m.impl)));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
    expect(SOURCES_AG).toHaveLength(3);
  });

  it("le critère tient un 1ᵉʳ JANVIER — l'horloge est injectée, jamais lue", () => {
    // Un test qui comparerait « stocké » et « servi » sous l'horloge RÉELLE
    // passerait tout janvier d'une année où le stocké porte déjà l'année
    // courante. Deux horloges explicites ferment ce trou.
    expect(codeSeul(SRC("__tests__/prebuy/s16-autorite-reference-et-methodologie.test.ts")))
      .not.toMatch(/new Date\(\)\.getFullYear\(\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AI · LA MÉTHODOLOGIE DÉCRIT CE QUE L'ARTEFACT PUBLIE
// ═════════════════════════════════════════════════════════════════════════

describe("S16/ai1 — CONSTAT sur l'ARTEFACT : la méthodologie est ORPHELINE", () => {
  it("le document publie une FORMULE de score", () => {
    const t = texteRendu();
    expect(t).toContain("Scoring: CRITICAL×15 + HIGH×10 + MEDIUM×5 + LOW×2");
    expect(t).toContain("Floor rule: claims ≥ 6 → score ≥ 70");
  });

  it("et il ne publie NI le score NI le tier", () => {
    const t = texteRendu();
    expect(t).toContain("Score withheld");
    expect(t).not.toContain("ORANGE");
    expect(t).not.toContain("/100");
    // Les seules occurrences de « RED » et « tier » sont DANS la formule.
    const horsFormule = t.replace(/Floor rule[^.]*?guaranteed\)/g, "");
    expect(horsFormule).not.toContain("RED");
    expect(horsFormule).not.toContain("tier");
  });

  it("le moteur, lui, est nommé AVEC sa version — ce qui tient", () => {
    // À la décharge de l'artefact : sur ce point précis il fait ce qu'il faut.
    expect(texteRendu()).toContain("TigerScore Engine v2 — CaseDB v1");
  });
});

interface Methodologie {
  /** L'artefact publie-t-il un score ? un tier ? */
  publieScore: boolean;
  publieTier: boolean;
  /** La section décrit-elle la formule du score ? */
  decritFormuleScore: boolean;
  /** Le moteur nommé dérive-t-il RÉELLEMENT les claims publiés ? */
  moteurDeriveLesClaims: boolean;
  /** Est-il nommé, et avec sa version ? */
  moteurNomme: boolean;
  moteurVersionne: boolean;
  /** La prose assimile-t-elle la conclusion du dossier au score ? */
  conclusionAssimileeAuScore: boolean;
}
type ImplAI = () => Methodologie;

function batterieAI(impl: ImplAI): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const m = impl();

  // AI1 — pas d'assertion publiée, pas de formule. « NO PUBLISHED SCORE → NO
  // SCORE FORMULA BY DEFAULT ».
  if (!m.publieScore && !m.publieTier) {
    dit(!m.decritFormuleScore, "AI1 formule-sans-assertion-publiee");
  }
  // AI2 — pas de paternité sur des claims que le moteur ne dérive pas.
  if (!m.moteurDeriveLesClaims) {
    dit(!m.decritFormuleScore, "AI2 paternite-sur-claims-non-derives");
  }
  // AI3 — un moteur nommé l'est AVEC sa version. « TigerScore » n'est pas
  // citable ; « TigerScore Engine v2 — CaseDB v1 » l'est.
  if (m.moteurNomme) dit(m.moteurVersionne, "AI3 moteur-sans-version");
  // AI4 — la conclusion du dossier n'ÉQUIVAUT pas au score.
  dit(!m.conclusionAssimileeAuScore, "AI4 conclusion-assimilee-au-score");
  // AI5 — SUR-CORRECTION. Si le moteur EST une entrée réelle d'un claim
  // publié, son rôle et sa version DOIVENT être dits. Une méthodologie muette
  // n'est pas plus honnête qu'une méthodologie périmée.
  if (m.moteurDeriveLesClaims) {
    dit(m.moteurNomme && m.moteurVersionne, "AI5 methodologie-muette");
  }
  return v;
}

/** Le témoin : l'artefact ne publie pas de score, donc pas de formule. */
const TEMOIN_AI: ImplAI = () => ({
  publieScore: false, publieTier: false, decritFormuleScore: false,
  moteurDeriveLesClaims: false, moteurNomme: true, moteurVersionne: true,
  conclusionAssimileeAuScore: false,
});

describe("S16/ai2 — CRITÈRE : la méthodologie suit ce qui est publié", () => {
  it("le TÉMOIN passe", () => expect(batterieAI(TEMOIN_AI)).toEqual([]));

  const MUTANTS_AI: Array<{ nom: string; critere: string; impl: ImplAI }> = [
    {
      nom: "LE DÉFAUT ACTUEL — formule et règle de plancher, sans score ni tier publiés",
      critere: "AI1 formule-sans-assertion-publiee",
      impl: () => ({ ...TEMOIN_AI(), decritFormuleScore: true }),
    },
    {
      nom: "le moteur est nommé sans sa version — « TigerScore » seul",
      critere: "AI3 moteur-sans-version",
      impl: () => ({ ...TEMOIN_AI(), moteurVersionne: false }),
    },
    {
      nom: "la prose assimile la conclusion du dossier au score",
      critere: "AI4 conclusion-assimilee-au-score",
      impl: () => ({ ...TEMOIN_AI(), conclusionAssimileeAuScore: true }),
    },
    {
      nom: "SUR-CORRECTION — le moteur DÉRIVE réellement, et la méthodologie se tait",
      critere: "AI5 methodologie-muette",
      impl: () => ({ ...TEMOIN_AI(), moteurDeriveLesClaims: true, moteurNomme: false }),
    },
  ];

  for (const m of MUTANTS_AI) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAI(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("AI2 est atteignable en propre — paternité sans dérivation, score publié", () => {
    // Sans ce cas, AI2 ne se déclencherait qu'avec AI1 et ne localiserait rien.
    // C'est la leçon d'AC1 : un critère qui ne mord jamais seul ne dit pas ce
    // qu'il prétend.
    const viol = batterieAI(() => ({
      ...TEMOIN_AI(), publieScore: true, decritFormuleScore: true,
      moteurDeriveLesClaims: false,
    }));
    expect(viol).toEqual(["AI2 paternite-sur-claims-non-derives"]);
  });

  it("GARDE ANTI-VACUITÉ — chaque critère AI est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AI1 formule-sans-assertion-publiee",
      "AI2 paternite-sur-claims-non-derives",
      "AI3 moteur-sans-version",
      "AI4 conclusion-assimilee-au-score",
      "AI5 methodologie-muette",
    ];
    const cas: ImplAI[] = [
      ...MUTANTS_AI.map((m) => m.impl),
      () => ({ ...TEMOIN_AI(), publieScore: true, decritFormuleScore: true, moteurDeriveLesClaims: false }),
    ];
    const tues = new Set(cas.flatMap((i) => batterieAI(i)));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });

  it("l'artefact d'aujourd'hui MEURT sur AI1 et AI2", () => {
    const AUJOURDHUI: ImplAI = () => ({
      publieScore: false, publieTier: false, decritFormuleScore: true,
      moteurDeriveLesClaims: false, moteurNomme: true, moteurVersionne: true,
      conclusionAssimileeAuScore: false,
    });
    expect(batterieAI(AUJOURDHUI).sort()).toEqual([
      "AI1 formule-sans-assertion-publiee",
      "AI2 paternite-sur-claims-non-derives",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE AJ · REPRODUCTIBILITÉ D'ARTEFACT ≠ RECALCUL DE SCORE
// ═════════════════════════════════════════════════════════════════════════

describe("S16/aj1 — CONSTAT : la table déclare une entrée qu'elle ne publie pas", () => {
  it("« How to Reproduce » liste Score, et sa valeur est « Withheld »", () => {
    const t = texteRendu();
    expect(t).toContain("How to Reproduce");
    expect(t).toContain("Score Withheld");
  });

  it("les entrées réellement publiées, elles, le sont", () => {
    // À la décharge : mint, horodatage, moteur versionné et source off-chain
    // sont là. Le défaut est localisé sur UNE ligne.
    const t = texteRendu();
    for (const champ of ["Mint MINT-A", "TigerScore Engine v2 — CaseDB v1", "Offchain Source CaseDB"]) {
      expect(t, champ).toContain(champ);
    }
  });
});

interface Reproduction {
  /** Les entrées que la table DÉCLARE nécessaires. */
  declarees: string[];
  /** Celles qui sont effectivement PUBLIÉES avec leur valeur. */
  publiees: string[];
  /** Celles qui gouvernent réellement l'artefact et ses claims. */
  gouvernantes: string[];
  /** La section publie-t-elle une formule de recalcul à la place ? */
  recalculAuLieuDeReproduction: boolean;
}
type ImplAJ = () => Reproduction;

function batterieAJ(impl: ImplAJ): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };
  const r = impl();

  // AJ1 — reproduire un ARTEFACT n'est pas recalculer un SCORE.
  dit(!r.recalculAuLieuDeReproduction, "AJ1 recalcul-au-lieu-de-reproduction");
  // AJ2 — toute entrée GOUVERNANTE doit être publiée. C'est la SUFFISANCE.
  dit(r.gouvernantes.every((g) => r.publiees.includes(g)), "AJ2 entree-gouvernante-non-publiee");
  // AJ3 — une entrée DÉCLARÉE mais non publiée est pire que tout : la table
  // annonce ce qu'elle retient.
  dit(r.declarees.every((d) => r.publiees.includes(d)), "AJ3 entree-declaree-non-publiee");
  // AJ4 — SUR-CORRECTION. Publier une entrée qui ne gouverne rien alourdit
  // sans prouver : le critère porte sur la SUFFISANCE, pas l'exhaustivité.
  dit(r.publiees.every((p) => r.gouvernantes.includes(p)), "AJ4 entree-non-gouvernante-publiee");
  return v;
}

const TEMOIN_AJ: ImplAJ = () => ({
  declarees: ["mint", "horodatage", "moteur+version", "source"],
  publiees: ["mint", "horodatage", "moteur+version", "source"],
  gouvernantes: ["mint", "horodatage", "moteur+version", "source"],
  recalculAuLieuDeReproduction: false,
});

describe("S16/aj2 — CRITÈRE : suffisance des entrées, et pas un recalcul", () => {
  it("le TÉMOIN passe", () => expect(batterieAJ(TEMOIN_AJ)).toEqual([]));

  const MUTANTS_AJ: Array<{ nom: string; critere: string; impl: ImplAJ }> = [
    {
      nom: "LE DÉFAUT ACTUEL — `Score` déclaré dans la table, valeur « Withheld »",
      critere: "AJ3 entree-declaree-non-publiee",
      impl: () => ({ ...TEMOIN_AJ(), declarees: [...TEMOIN_AJ().declarees, "score"] }),
    },
    {
      nom: "une entrée GOUVERNANTE n'est pas publiée",
      critere: "AJ2 entree-gouvernante-non-publiee",
      impl: () => ({
        ...TEMOIN_AJ(),
        gouvernantes: [...TEMOIN_AJ().gouvernantes, "corpus"],
      }),
    },
    {
      nom: "la reproductibilité est remplacée par une formule de recalcul",
      critere: "AJ1 recalcul-au-lieu-de-reproduction",
      impl: () => ({ ...TEMOIN_AJ(), recalculAuLieuDeReproduction: true }),
    },
    {
      nom: "SUR-CORRECTION — on publie des entrées qui ne gouvernent rien",
      critere: "AJ4 entree-non-gouvernante-publiee",
      impl: () => ({
        ...TEMOIN_AJ(),
        declarees: [...TEMOIN_AJ().declarees, "couleur du logo"],
        publiees: [...TEMOIN_AJ().publiees, "couleur du logo"],
      }),
    },
  ];

  for (const m of MUTANTS_AJ) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieAJ(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère AJ est tué, et aucun n'échappe à la liste", () => {
    const CRITERES = [
      "AJ1 recalcul-au-lieu-de-reproduction",
      "AJ2 entree-gouvernante-non-publiee",
      "AJ3 entree-declaree-non-publiee",
      "AJ4 entree-non-gouvernante-publiee",
    ];
    const tues = new Set(MUTANTS_AJ.flatMap((m) => batterieAJ(m.impl)));
    expect(CRITERES.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES.includes(c))).toEqual([]);
  });
});
