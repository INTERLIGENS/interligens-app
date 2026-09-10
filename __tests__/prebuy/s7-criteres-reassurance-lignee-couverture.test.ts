// ─── BUILD 12 · S7 — CRITÈRES POUR TROIS CONSTATS QUI SORTENT DU REFACTOR ──
//
// ██  La réplication est CONGÉNITALE : sept sites, cinq nés dans 6585b63    ██
// ██  avec le module canonique lui-même. Elles sont nées divergentes.       ██
//
// Trois des divergences ne sont pas des questions de refactor — ce sont des
// propriétés de mesure. T1 les a mesurées ; ce fichier écrit ce qui devra être
// vrai, avec des mutants qui mordent sur la propriété visée et pas ailleurs.
//
//   Q · une valeur FAVORABLE ne s'affirme pas sans mesure
//   R · un état reconnu sur un chemin et inexistant sur l'autre
//   S · un déclencheur gouverné qui ne peut jamais se déclencher
//
// FORME, reprise de S5 : pour chaque axe, un CONSTAT (mesuré aujourd'hui, il
// rougira le jour de la correction et sera retourné en anti-régression dans le
// même geste) et un CRITÈRE D'ACCEPTATION (une batterie, un témoin qui passe,
// des mutants qui meurent — chacun sur le critère NOMMÉ, jamais « quelque part »).
//
// Chaque axe porte au moins un mutant de SUR-CORRECTION. C'est la leçon de
// BUILD 11.1 : remplacer une réassurance non fondée par un refus permanent de
// conclure n'est pas une correction, c'est l'autre mur.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalPreBuyDecision,
  estDegrade,
  type FaitsDeMesure,
  type ManqueMesure,
} from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity } from "@/lib/prebuy/identity";

/**
 * ⚠ PREUVES LEXICALES — annoncées, comme la règle du 2026-09-09 l'exige.
 *
 * Les CONSTATS sont lexicaux parce que les surfaces concernées ne sont pas
 * exécutables depuis la suite : les trois routes partenaires sont GELÉES,
 * frappent la base et exigent `X-Partner-Key` ; `/api/v1/score` ouvre quatre
 * appels réseau plus un `fetch` interne. Et l'on prouve ici des ABSENCES —
 * aucune exécution ne prouve une absence.
 *
 * Les CRITÈRES, eux, sont comportementaux : batteries sur des implémentations,
 * plus les fonctions réelles de `canonicalDecision.ts` là où elles décident.
 */
const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const PARTENAIRES = ["transaction-check", "score-lite", "batch-score"] as const;
const ROUTE_PARTENAIRE = (p: string) => SRC(`src/app/api/partner/v1/${p}/route.ts`);
const ROUTE_PUBLIQUE = SRC("src/app/api/v1/score/route.ts");
const CANONIQUE = SRC("src/lib/publicScore/computeVerdict.ts");

type Lignee = "CONFIRMED" | "REFERENCED" | "NONE";
/** La valeur FAVORABLE de l'axe lignée. C'est celle qui ne s'affirme pas gratis. */
const FAVORABLE: Lignee = "NONE";

// ═════════════════════════════════════════════════════════════════════════
// AXE Q · UNE VALEUR FAVORABLE NE S'AFFIRME PAS SANS MESURE
// ═════════════════════════════════════════════════════════════════════════

describe("S7/q1 — CONSTAT : les trois routes partenaires affirment NONE sans mesurer", () => {
  it("les trois codent `scam_lineage: \"NONE\"` en dur", () => {
    for (const p of PARTENAIRES) {
      expect(codeSeul(ROUTE_PARTENAIRE(p)), p).toContain('scam_lineage: "NONE"');
    }
  });

  it("et aucune des trois n'inventorie la lignée dans ses manquants", () => {
    // Ni attendue, ni inventoriée, ni tracée : la valeur favorable est publiée
    // comme un fait alors qu'aucun moteur ne l'a établie.
    for (const p of PARTENAIRES) {
      expect(codeSeul(ROUTE_PARTENAIRE(p)), `${p} nomme scam_lineage dans un ManqueMesure`)
        .not.toMatch(/engine:\s*"scam_lineage"/);
    }
  });

  it("alors que la doctrine CONTRE ce geste est écrite, et sur le chemin voisin", () => {
    // BUILD 10 · P0, route.ts:270-273. Le contraste est le constat.
    expect(ROUTE_PUBLIQUE).toContain(
      "laissait \"NONE\" — la valeur FAVORABLE — sans laisser",
    );
    expect(codeSeul(ROUTE_PUBLIQUE)).toContain("scamLineageMeasured");
    // Et le chemin canonique l'applique aussi : `measured` accompagne la valeur.
    expect(codeSeul(CANONIQUE)).toMatch(/lineage:\s*"NONE",\s*measured:\s*false/);
  });
});

// ─── Le critère d'acceptation ────────────────────────────────────────────
//
// La doctrine P0 est PRÉCISE et il ne faut pas la dépasser : « La valeur ne
// bouge pas ; ce qui est ajouté est de SAVOIR que c'est un défaut de mesure. »
// Le critère ne demande donc PAS de cesser de servir NONE. Il demande que,
// non mesurée, elle soit accompagnée d'un fait de mesure qui le dit — nommé,
// et d'un motif qui DÉGRADE.

/** L'état d'un moteur d'axe lignée : consulté ou non, abouti ou non. */
interface EtatQ {
  /** `null` = le moteur n'a pas été consulté du tout. */
  mesure: { valeur: Lignee; aboutie: boolean } | null;
}
/** Ce que la surface publie : la valeur servie, et l'inventaire qui l'escorte. */
interface SortieQ {
  valeur: Lignee;
  missing: ManqueMesure[];
}
type ImplQ = (e: EtatQ) => SortieQ;

const MOTEUR = "scam_lineage";

const ETATS_Q: Array<{ nom: string; etat: EtatQ }> = [
  { nom: "non consulté", etat: { mesure: null } },
  { nom: "consulté, en panne", etat: { mesure: { valeur: "NONE", aboutie: false } } },
  { nom: "mesuré NONE", etat: { mesure: { valeur: "NONE", aboutie: true } } },
  { nom: "mesuré REFERENCED", etat: { mesure: { valeur: "REFERENCED", aboutie: true } } },
  { nom: "mesuré CONFIRMED", etat: { mesure: { valeur: "CONFIRMED", aboutie: true } } },
];

const estMesure = (e: EtatQ) => e.mesure !== null && e.mesure.aboutie;
const entree = (s: SortieQ) => s.missing.find((m) => m.engine === MOTEUR);

function batterieQ(impl: ImplQ): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  for (const { etat } of ETATS_Q) {
    const s = impl(etat);
    const e = entree(s);

    if (!estMesure(etat)) {
      // Q1 — non mesurée, la valeur favorable doit DÉGRADER. La servir reste
      // permis (P0 : la valeur ne bouge pas) ; la servir en silence, non.
      if (s.valeur === FAVORABLE) {
        dit(
          e !== undefined &&
            estDegrade({ expected: 1, expectedMeasured: 1, missing: s.missing }),
          "Q1 favorable-non-degradee",
        );
      }
      // Q2 — et l'inventaire doit NOMMER le moteur. Non mesuré ET non
      // inventorié est pire que non mesuré : le lecteur ne peut même pas
      // savoir ce qui manque.
      dit(e !== undefined, "Q2 non-inventoriee");
    } else {
      // Q3 — SUR-CORRECTION. Une valeur RÉELLEMENT mesurée reste servie telle
      // quelle, et n'est pas inventoriée comme manquante. On ne remplace pas
      // une réassurance non fondée par un refus permanent de conclure.
      dit(s.valeur === etat.mesure!.valeur, "Q3 mesure-non-servie");
      dit(e === undefined, "Q3b mesure-inventoriee-comme-manquante");
    }
  }
  return v;
}

/** Le témoin : la doctrine P0, appliquée. La valeur ne bouge pas ; le fait s'ajoute. */
const TEMOIN_Q: ImplQ = (e) =>
  estMesure(e)
    ? { valeur: e.mesure!.valeur, missing: [] }
    : { valeur: FAVORABLE, missing: [{ engine: MOTEUR, reason: "FAILURE" }] };

describe("S7/q2 — CRITÈRE : la valeur favorable non mesurée est tracée et dégrade", () => {
  it("le TÉMOIN passe", () => expect(batterieQ(TEMOIN_Q)).toEqual([]));

  const MUTANTS_Q: Array<{ nom: string; critere: string; impl: ImplQ }> = [
    {
      nom: "LE DÉFAUT ACTUEL — NONE en dur, rien dans missing, silence complet",
      critere: "Q2 non-inventoriee",
      impl: () => ({ valeur: FAVORABLE, missing: [] }),
    },
    {
      nom: "DÉGRADÉ MAIS ANONYME — un manquant existe, il ne nomme pas la lignée",
      critere: "Q2 non-inventoriee",
      impl: (e) =>
        estMesure(e)
          ? TEMOIN_Q(e)
          : { valeur: FAVORABLE, missing: [{ engine: "unknown", reason: "FAILURE" }] },
    },
    {
      nom: "NOMMÉ MAIS NEUTRALISÉ — l'entrée existe, taguée HORS CONTRAT",
      // La triche tentante : nommer le moteur avec un motif que `estDegrade`
      // ignore. L'inventaire est correct, la conséquence est effacée.
      critere: "Q1 favorable-non-degradee",
      impl: (e) =>
        estMesure(e)
          ? TEMOIN_Q(e)
          : {
              valeur: FAVORABLE,
              missing: [{ engine: MOTEUR, reason: "NOT_REQUESTED_BY_CONTRACT" }],
            },
    },
    {
      nom: "SUR-CORRECTION — refus permanent de conclure, même mesuré",
      critere: "Q3b mesure-inventoriee-comme-manquante",
      impl: (e) => ({
        valeur: e.mesure?.valeur ?? FAVORABLE,
        missing: [{ engine: MOTEUR, reason: "FAILURE" }],
      }),
    },
    {
      nom: "SUR-CORRECTION — la valeur mesurée cesse d'être servie",
      critere: "Q3 mesure-non-servie",
      impl: (e) => ({ ...TEMOIN_Q(e), valeur: FAVORABLE }),
    },
  ];

  for (const m of MUTANTS_Q) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieQ(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("le critère vaut pour les TROIS routes, pas une", () => {
    // La batterie est agnostique de la route par construction : elle porte sur
    // un couple (état de mesure → sortie publiée), pas sur un fichier. Ce test
    // fixe l'exigence de PÉRIMÈTRE que la batterie ne peut pas porter seule.
    expect(PARTENAIRES).toHaveLength(3);
    for (const p of PARTENAIRES) {
      expect(codeSeul(ROUTE_PARTENAIRE(p)), `${p} doit passer par la décision canonique`)
        .toContain("canonicalPreBuyDecision");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════
// AXE R · LES DEUX CHEMINS CLASSENT LE MÊME CAS DIFFÉREMMENT
// ═════════════════════════════════════════════════════════════════════════
//
// ─── RECTIFICATION DATÉE DU 2026-09-10 — ma caractérisation était FAUSSE ──
//
// Ce que cet axe affirmait à sa première écriture, dans un nom de test et dans
// le message de 678df86 :
//
//   « conséquence mesurée : sur le chemin qui se dit canonique, REFERENCED
//     devient NONE » — « un mint REFERENCED devient NONE, c'est-à-dire la
//     valeur FAVORABLE ».
//
// FAUX. J'avais lu `computeVerdict.ts` SEUL et déduit la divergence sans lire
// la table du PRODUCTEUR. Mesurée le 2026-09-10, graph/route.ts:96 :
//
//   public :     clusters > 0 → CONFIRMED
//                flagged  > 0 → REFERENCED
//                sinon        → NONE
//   canonique :  flagged  > 0 → CONFIRMED
//                sinon        → NONE
//
// REFERENCED ne devient donc JAMAIS NONE. Ce qui se passe est différent, et
// pire, parce que ça va dans les DEUX sens :
//
//   D1  clusters > 0, flagged = 0  →  public CONFIRMED, canonique NONE
//       Direction FAVORABLE : un cas à liens devient un mint propre.
//   D2  clusters = 0, flagged > 0  →  public REFERENCED, canonique CONFIRMED
//       Direction AGGRAVANTE : le canonique PROMEUT. C'est la sur-correction
//       « fabrique une lignée » — et elle est en production, pas dans un mutant.
//   D3  pivotAddress de casse différente  →  le graphe replie
//       (`mode: 'insensitive'`, graph/route.ts:14-17), le canonique cherche en
//       exact seulement (computeVerdict.ts:60). Trouvé d'un côté, pas de
//       l'autre. Direction FAVORABLE.
//
// LE CŒUR : le prédicat `flagged > 0` porte REFERENCED sur un chemin et
// CONFIRMED sur l'autre. Ce n'est pas un état manquant, c'est une COLLISION
// SÉMANTIQUE — le même fait, deux verdicts.
//
// Les critères R restent valides : ils portaient sur les propriétés d'un
// classifieur de lignée, et ces propriétés ne changent pas. Ce qui est refait,
// c'est le MODÈLE D'ENTRÉE — les deux chemins ne consomment pas le même objet,
// et les modéliser tous deux comme `Lignee → Lignee` était l'erreur qui m'a
// caché D2 et D3.

describe("S7/r1 — CONSTAT : deux tables de classification, mesurées", () => {
  it("le producteur classe sur clusters PUIS flagged, en trois états", () => {
    expect(aplat(codeSeul(SRC("src/app/api/scan/solana/graph/route.ts")))).toContain(
      "overall_status: clusters.length > 0 ? 'CONFIRMED' : flaggedNodes.length > 0 ? 'REFERENCED' : 'NONE',",
    );
  });

  it("le canonique classe sur flagged SEUL, en deux états — et promeut", () => {
    const c = aplat(codeSeul(CANONIQUE));
    expect(c).toContain('type ScamLineage = "CONFIRMED" | "REFERENCED" | "NONE"');
    expect(c).toContain('lineage: flaggedNodes.length > 0 ? "CONFIRMED" : "NONE",');
    // REFERENCED est déclaré au type et jamais construit.
    expect(c).not.toMatch(/=\s*"REFERENCED"/);
  });

  it("D3 — le producteur replie la casse, le canonique non", () => {
    const g = aplat(codeSeul(SRC("src/app/api/scan/solana/graph/route.ts")));
    expect(g).toContain("pivotAddress: { equals: mint, mode: 'insensitive' }");
    const c = aplat(codeSeul(CANONIQUE));
    expect(c).toContain("where: { pivotAddress: mint },");
    expect(c).not.toContain("mode: 'insensitive'");
    expect(c).not.toContain('mode: "insensitive"');
  });

  it("et les deux ne lisent pas la même source", () => {
    expect(codeSeul(ROUTE_PUBLIQUE)).toContain("/api/scan/solana/graph");
    expect(codeSeul(CANONIQUE)).toContain("prisma.graphCase.findFirst");
  });

  it("le chemin qui DIVERGE est celui qui se déclare canonique", () => {
    // ⚠ source BRUTE : la revendication est un commentaire.
    expect(CANONIQUE).toContain("L'unique chemin de mesure pré-achat");
  });
});

// ─── Le critère d'acceptation ────────────────────────────────────────────

/** Ce que les deux chemins consomment RÉELLEMENT — et ce n'est pas une lignée. */
interface EtatGraphe {
  /** Le cas est-il trouvé par ce chemin ? (D3 : la casse.) */
  trouve: boolean;
  clusters: number;
  flagged: number;
}
type Classifieur = (e: EtatGraphe) => Lignee;

const CAS: Array<{ nom: string; etat: EtatGraphe }> = [
  { nom: "aucun cas", etat: { trouve: false, clusters: 0, flagged: 0 } },
  { nom: "cas vide", etat: { trouve: true, clusters: 0, flagged: 0 } },
  { nom: "D1 — liens, aucun nœud flaggé", etat: { trouve: true, clusters: 2, flagged: 0 } },
  { nom: "D2 — nœuds flaggés, aucun lien", etat: { trouve: true, clusters: 0, flagged: 3 } },
  { nom: "les deux", etat: { trouve: true, clusters: 2, flagged: 3 } },
];

const RANG: Record<Lignee, number> = { NONE: 0, REFERENCED: 1, CONFIRMED: 2 };

function batterieR(paire: { public: Classifieur; canonique: Classifieur }): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok && !v.includes(c)) v.push(c); };

  for (const { etat } of CAS) {
    const a = paire.public(etat);
    const b = paire.canonique(etat);

    // R1 — aucun chemin ne fait tomber sur NONE ce que l'autre a classé.
    dit(!((a !== "NONE" && b === "NONE") || (b !== "NONE" && a === "NONE")), "R1 divergence-vers-favorable");
    // R2 — SUR-CORRECTION. Aucun chemin ne PROMEUT ce que l'autre a classé
    // plus bas : REFERENCED et CONFIRMED ne sont pas le même fait.
    dit(!(RANG[a] !== RANG[b] && a !== "NONE" && b !== "NONE"), "R2 divergence-vers-aggravant");
    // R3 — même cas, même conclusion. Motif de l'axe K, 3e vérification.
    dit(a === b, "R3 chemins-divergents");
    // R4 — un cas trouvé et neutre reste NONE des deux côtés : on ne
    // sur-corrige pas en classant tout le monde.
    if (etat.trouve && etat.clusters === 0 && etat.flagged === 0) {
      dit(a === "NONE" && b === "NONE", "R4 etats-neutres-deplaces");
    }
    // R5 — les trois états restent DISTINGUABLES : un classifieur qui aplatit
    // tout sur une seule valeur satisfait R3 sans rien mesurer.
  }
  const imagePublique = new Set(CAS.map((c) => paire.public(c.etat)));
  dit(imagePublique.size >= 3, "R5 etats-aplatis");
  return v;
}

/** Le témoin : la table du PRODUCTEUR, appliquée des deux côtés. */
const TABLE_PRODUCTEUR: Classifieur = (e) =>
  !e.trouve ? "NONE" : e.clusters > 0 ? "CONFIRMED" : e.flagged > 0 ? "REFERENCED" : "NONE";
/** La table du canonique, telle qu'elle est aujourd'hui. */
const TABLE_CANONIQUE: Classifieur = (e) =>
  !e.trouve ? "NONE" : e.flagged > 0 ? "CONFIRMED" : "NONE";

describe("S7/r2 — CRITÈRE : un cas, une classification, sur les deux chemins", () => {
  it("le TÉMOIN passe — la même table des deux côtés", () =>
    expect(batterieR({ public: TABLE_PRODUCTEUR, canonique: TABLE_PRODUCTEUR })).toEqual([]));

  const MUTANTS_R: Array<{
    nom: string;
    critere: string;
    paire: { public: Classifieur; canonique: Classifieur };
  }> = [
    {
      nom: "LE DÉFAUT ACTUEL, D1 — liens sans nœud flaggé : CONFIRMED contre NONE",
      critere: "R1 divergence-vers-favorable",
      paire: { public: TABLE_PRODUCTEUR, canonique: TABLE_CANONIQUE },
    },
    {
      nom: "LE DÉFAUT ACTUEL, D2 — flaggé sans lien : REFERENCED contre CONFIRMED",
      critere: "R2 divergence-vers-aggravant",
      paire: { public: TABLE_PRODUCTEUR, canonique: TABLE_CANONIQUE },
    },
    {
      nom: "D3 — le repli de casse manque d'un côté : le cas est introuvable",
      critere: "R1 divergence-vers-favorable",
      paire: {
        public: TABLE_PRODUCTEUR,
        canonique: (e) => TABLE_PRODUCTEUR({ ...e, trouve: false }),
      },
    },
    {
      nom: "SUR-CORRECTION — tout cas trouvé devient CONFIRMED, même vide",
      critere: "R4 etats-neutres-deplaces",
      paire: {
        public: (e) => (e.trouve ? "CONFIRMED" : "NONE"),
        canonique: (e) => (e.trouve ? "CONFIRMED" : "NONE"),
      },
    },
    {
      nom: "SUR-CORRECTION — les deux chemins s'accordent en aplatissant tout sur NONE",
      // Concorder ne suffit pas : deux chemins d'accord sur rien sont d'accord.
      critere: "R5 etats-aplatis",
      paire: { public: () => "NONE", canonique: () => "NONE" },
    },
  ];

  for (const m of MUTANTS_R) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batterieR(m.paire);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère R est tué par au moins un mutant", () => {
    // Règle ratifiée le 2026-09-10, dans les deux sens : tout critère nommé
    // doit être tué, et aucun critère émis ne doit échapper à la liste.
    const CRITERES_R = [
      "R1 divergence-vers-favorable",
      "R2 divergence-vers-aggravant",
      "R3 chemins-divergents",
      "R4 etats-neutres-deplaces",
      "R5 etats-aplatis",
    ];
    const tues = new Set(MUTANTS_R.flatMap((m) => batterieR(m.paire)));
    expect(CRITERES_R.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_R.includes(c))).toEqual([]);
  });

  it("LA COLLISION, nommée — `flagged > 0` porte deux verdicts", () => {
    const flaggeSansLien: EtatGraphe = { trouve: true, clusters: 0, flagged: 3 };
    expect(TABLE_PRODUCTEUR(flaggeSansLien)).toBe("REFERENCED");
    expect(TABLE_CANONIQUE(flaggeSansLien)).toBe("CONFIRMED");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE S · UN DÉCLENCHEUR GOUVERNÉ QUI NE PEUT JAMAIS SE DÉCLENCHER
// ═════════════════════════════════════════════════════════════════════════
//
// INSUFFICIENT_COVERAGE est le cinquième verdict REFLEX. Il est déclaré, il a
// une entrée de constantes, la projection le mappe sur WARN. Sur la surface
// pré-achat, il est STRUCTURELLEMENT MORT — et pas seulement sur une route.

describe("S7/s1 — le déclencheur FONCTIONNE : la mort est aux sites d'appel", () => {
  const decide = (m: FaitsDeMesure) =>
    canonicalPreBuyDecision({
      score: 42,
      measurement: m,
      identity: resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: "casefile", attests: true }],
      }),
    });

  it("nourri de zéro attendu abouti, la fonction réelle rend INSUFFICIENT_COVERAGE", () => {
    const d = decide({ expected: 3, expectedMeasured: 0, missing: [] });
    expect(d.verdict).toBe("INSUFFICIENT_COVERAGE");
    expect(d.verdictSource).toBe("NO_MEASUREMENT");
  });

  it("le second portail — score absent — fonctionne aussi", () => {
    const d = canonicalPreBuyDecision({
      score: null,
      measurement: { expected: 3, expectedMeasured: 3, missing: [] },
      identity: resolveTokenIdentity({ syntacticallyValid: true, attestations: [] }),
    });
    expect(d.verdict).toBe("INSUFFICIENT_COVERAGE");
  });

  it("dès UN attendu abouti, le verdict repasse au score legacy", () => {
    // La frontière exacte. Le plancher de tous les sites vaut 1 (S7/s2) : ils
    // sont tous du mauvais côté de cette frontière, d'exactement un cran.
    expect(decide({ expected: 3, expectedMeasured: 1, missing: [] }).verdict).not.toBe(
      "INSUFFICIENT_COVERAGE",
    );
  });
});

/**
 * Les sept sites d'appel de `canonicalPreBuyDecision`, avec leur plancher de
 * couverture — le minimum que `expectedMeasured` peut atteindre, étant donné
 * les moteurs capables de porter FAILURE à ce site.
 *
 * Chaque ligne est ANCRÉE lexicalement : si un site change sa formule, son
 * `attendus`, ou l'ensemble de ses moteurs faillibles, l'ancre casse et le
 * tableau cesse de mentir en silence.
 */
const SITES: Array<{ site: string; fichier: string; ancre: string; plancher: number }> = [
  {
    site: "api/v1/score · EVM",
    fichier: "src/app/api/v1/score/route.ts",
    ancre: "expected: 1, expectedMeasured: 1,",
    plancher: 1,
  },
  {
    site: "api/v1/score · SOL",
    fichier: "src/app/api/v1/score/route.ts",
    // 3 − |{market, scam_lineage}| = 1. `tigerscore`, le troisième membre, est
    // pur et synchrone (route.ts:297) : il ne peut pas porter FAILURE.
    ancre: 'expected: 3, expectedMeasured: 3 - solManquants.filter((m) => m.reason === "FAILURE").length,',
    plancher: 1,
  },
  {
    site: "partner/transaction-check · SOL",
    fichier: "src/app/api/partner/v1/transaction-check/route.ts",
    ancre: "expected: 2, expectedMeasured: 2 - solManquants.length,",
    plancher: 1,
  },
  {
    site: "partner/transaction-check · EVM",
    fichier: "src/app/api/partner/v1/transaction-check/route.ts",
    ancre: "expected: 1, expectedMeasured: 1,",
    plancher: 1,
  },
  {
    site: "partner/score-lite",
    fichier: "src/app/api/partner/v1/score-lite/route.ts",
    ancre: 'expected: attendus, expectedMeasured: attendus - manquants.filter((m) => m.reason === "FAILURE").length,',
    plancher: 1,
  },
  {
    site: "partner/batch-score",
    fichier: "src/app/api/partner/v1/batch-score/route.ts",
    ancre: 'expected: attendus, expectedMeasured: attendus - manquants.filter((m) => m.reason === "FAILURE").length,',
    plancher: 1,
  },
  {
    site: "publicScore/measurePreBuy · SOL",
    fichier: "src/lib/publicScore/computeVerdict.ts",
    ancre: "expected: 3, expectedMeasured: 3 - manquants.length,",
    plancher: 1,
  },
  {
    site: "publicScore/measurePreBuy · EVM",
    fichier: "src/lib/publicScore/computeVerdict.ts",
    ancre: "expected: 1, expectedMeasured: 1,",
    plancher: 1,
  },
];

const aplat = (s: string) => s.replace(/\s+/g, " ");

describe("S7/s2 — ÉPINGLE : l'inatteignabilité, et elle rougit dans les DEUX sens", () => {
  it("chaque site est encore à sa forme ancrée", () => {
    // Rougit si un site change de formule — donc si son plancher peut bouger.
    for (const s of SITES) {
      expect(aplat(SRC(s.fichier)), `${s.site} — l'ancre a bougé`).toContain(aplat(s.ancre));
    }
  });

  it("les moteurs faillibles de chaque site sont bornés — aucun `attendus` ne peut être épuisé", () => {
    // Les deux routes à `attendus` variable ne prennent que 1 (EVM) ou 2 (SOL),
    // et leur seul moteur faillible est `market`. Plancher 1 des deux côtés.
    for (const p of ["score-lite", "batch-score"]) {
      const code = aplat(codeSeul(ROUTE_PARTENAIRE(p)));
      expect(code, `${p} — attendus initial`).toContain("let attendus = 1;");
      expect(code, `${p} — attendus SOL`).toContain("attendus = 2;");
      expect(code, `${p} — un second moteur faillible est apparu`).not.toMatch(
        /engine: "(?!market)[a-z_]+", reason: "FAILURE"/,
      );
    }
  });

  it("le tableau des planchers est EXACTEMENT celui-ci — tout écart rougit", () => {
    // `toEqual` sur la carte complète : un plancher qui tombe à 0 (la capacité
    // revit) comme un plancher qui monte (un site change de contrat) casse ici.
    expect(Object.fromEntries(SITES.map((s) => [s.site, s.plancher]))).toEqual({
      "api/v1/score · EVM": 1,
      "api/v1/score · SOL": 1,
      "partner/transaction-check · SOL": 1,
      "partner/transaction-check · EVM": 1,
      "partner/score-lite": 1,
      "partner/batch-score": 1,
      "publicScore/measurePreBuy · SOL": 1,
      "publicScore/measurePreBuy · EVM": 1,
    });
  });

  it("aucun plancher n'atteint 0 : le portail `expectedMeasured === 0` est mort partout", () => {
    expect(SITES.filter((s) => s.plancher === 0)).toEqual([]);
    expect(SITES.every((s) => s.plancher >= 1)).toBe(true);
  });

  it("le second portail est mort aussi : aucun site ne passe `score: null`", () => {
    // ⚠ PREUVE LEXICALE d'une ABSENCE. Tous les sites passent un nombre issu
    // de `Math.max(...)` ou de `intel.finalScore`.
    for (const f of new Set(SITES.map((s) => s.fichier))) {
      expect(aplat(codeSeul(SRC(f))), `${f} passe score: null`).not.toContain("score: null");
    }
  });

  it("et aucun site ne passe `reflexVerdict` — la troisième voie est fermée elle aussi", () => {
    // `canonicalPreBuyDecision` accepte un verdict REFLEX, qui SAIT produire
    // INSUFFICIENT_COVERAGE (reflex/verdict.ts:340, sur measuredEngines === 0).
    // Aucun site pré-achat ne l'emprunte : ils passent tous un score.
    for (const f of new Set(SITES.map((s) => s.fichier))) {
      expect(codeSeul(SRC(f)), `${f} passe reflexVerdict`).not.toContain("reflexVerdict");
    }
  });
});

describe("S7/s3 — la capacité est DÉCLARÉE, et c'est ce qui rend sa mort notable", () => {
  it("le verdict existe au type, aux constantes, et à la projection", () => {
    expect(codeSeul(SRC("src/lib/reflex/types.ts"))).toContain('"INSUFFICIENT_COVERAGE"');
    expect(codeSeul(SRC("src/lib/reflex/constants.ts"))).toContain("INSUFFICIENT_COVERAGE");
    expect(codeSeul(SRC("src/lib/prebuy/projection.ts"))).toContain('case "INSUFFICIENT_COVERAGE"');
  });

  it("et REFLEX sait le produire — la mort est locale à la surface pré-achat", () => {
    expect(codeSeul(SRC("src/lib/reflex/verdict.ts"))).toContain('verdict: "INSUFFICIENT_COVERAGE"');
  });

  /**
   * Ce que ce fichier NE prétend PAS : il ne dit pas que la mort est un défaut
   * à corriger. Un plancher à 1 peut être exactement ce qu'on veut — le
   * troisième membre SOL est `tigerscore`, pur et synchrone, et une surface où
   * il ne reste plus rien de mesuré n'existe peut-être pas.
   *
   * Ce qu'il exige, c'est qu'on le SACHE, et qu'on le sache le jour où ça
   * change. Motif de BUILD 11 — une capacité déclarée et structurellement
   * morte — transposé aux verdicts.
   */
  it("la question est POSÉE, pas tranchée : le verdict est mappé sur WARN", () => {
    // Si la capacité revit un jour, elle produira des WARN. C'est la
    // conséquence à connaître d'avance.
    expect(aplat(codeSeul(SRC("src/lib/prebuy/projection.ts")))).toContain(
      'case "INSUFFICIENT_COVERAGE":',
    );
  });
});
