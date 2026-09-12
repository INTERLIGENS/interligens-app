// ─── BUILD 12 · S9 — LES DEUX HARD GATES, RENDUES EXÉCUTABLES ─────────────
//
// ██  Une gate qui ne vit que dans un ruling sera oubliée le jour où       ██
// ██  quelqu'un seedera GraphCase — et ce jour-là les deux P0 latents      ██
// ██  deviennent actifs en même temps.                                     ██
//
// Les deux gates posées :
//
//   GATE 1  « no production lineage population may be introduced WHILE
//             partner surfaces can fabricate NONE. »
//   GATE 2  même forme, pour la scission sémantique : la population ne peut
//           pas précéder la résolution des divergences de classification.
//
// FORME. Une gate est une FONCTION de deux faits — l'état de la POPULATION et
// l'état des SURFACES — et elle rend VERT / ROUGE / NON_EVALUABLE. La fonction
// est testée exhaustivement avec des faits injectés ; le bras LIVE l'évalue sur
// l'état réel du dépôt et sur une population lue d'ailleurs.
//
// CONTRAINTES TENUES :
//   · LECTURE SEULE. Rien n'est seedé, rien n'est écrit, la base n'est pas
//     touchée — ce worktree n'y a pas accès et n'a pas à l'avoir.
//   · ROBUSTESSE À LA FORME. Déplacer le littéral en dur ailleurs ne rend pas
//     vert : ce qui est sondé est la PREUVE DE MESURE, pas l'absence d'une
//     chaîne. Axe C de S6, transposé.
//   · SATISFIABILITÉ. Une gate qui ne peut jamais devenir verte est un blocage,
//     pas une gate. Un critère l'exige explicitement (G4).
//   · LE TROU DE PREUVE EST DÉCLARÉ, pas contourné. Voir S9/g0.
//
// Aucun chemin gelé touché. Aucune écriture prod. Aucune sémantique changée.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, type Dirent } from "node:fs";

const SRC = (p: string) => readFileSync(p, "utf8");
const codeSeul = (s: string): string =>
  s
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
const aplat = (s: string) => s.replace(/\s+/g, " ");

// ═════════════════════════════════════════════════════════════════════════
// S9/g0 · LE TROU DE PREUVE, DÉCLARÉ
// ═════════════════════════════════════════════════════════════════════════

/**
 * Ce worktree n'a pas accès à la base, et ne doit pas l'avoir : la règle du
 * dépôt interdit toute lecture prod depuis un test. La moitié POPULATION des
 * deux gates doit donc être INJECTÉE.
 *
 * CONTRAT D'INJECTION — variable d'environnement `INTERLIGENS_GRAPH_POPULATION`,
 * JSON, de la forme :
 *
 *   {"graphCase": 0, "graphNode": 0, "graphEdge": 0, "date": "2026-09-10"}
 *
 * D'OÙ ELLE DOIT VENIR EN CI : une étape qui compte les trois tables avec
 * l'URL en lecture seule, AVANT `pnpm test`, et exporte le JSON. Tant que
 * cette étape n'existe pas, les gates rendent NON_EVALUABLE — et surtout PAS
 * VERT. Un contrôle qui ne peut pas échouer ne contrôle rien ; un contrôle qui
 * ne peut pas s'évaluer doit le DIRE, pas se taire en vert.
 *
 * ─── CONDITION D'ACTIVATION, ratifiée le 2026-09-10 ─────────────────────
 *
 * ██  LE TROU DE PREUVE S9/g0 N'EST PAS UNE RÉSERVE, C'EST UNE CONDITION.  ██
 *
 * « Current production population zero is LEGITIMATE, but ACTIVATION REQUIRES
 *   SEEDED DB INTEGRATION PROOF before population may be introduced. »
 *
 * Donc, dans l'ordre, et AVANT la première ligne de GraphCase :
 *
 *   1. l'étape CI qui compte les trois tables et exporte
 *      INTERLIGENS_GRAPH_POPULATION — sans elle les gates rendent
 *      NON_EVALUABLE, ce qui est honnête mais ne protège rien ;
 *   2. le test d'intégration sur BASE SEEDÉE, exerçant les VRAIES fonctions
 *      (`getScamLineage` et le handler du graphe) sur les trois cas mesurés :
 *      liens sans nœud flaggé, nœud flaggé sans lien, casse différente du
 *      pivotAddress. C'est ce que les corpus S7/S9 ne prouvent PAS — ils
 *      prouvent que les deux TABLES divergent, pas que les deux FONCTIONS
 *      divergent sur de vraies données ;
 *   3. seulement ensuite, la population.
 *
 * Peupler avant 1 et 2 rend les deux P0 actifs en même temps, sans témoin
 * pour le dire. L'ordre n'est pas une préférence de méthode.
 */
type LecturePopulation =
  | { source: "MESURE"; graphCase: number; graphNode: number; graphEdge: number; date: string }
  | { source: "ABSENTE" };

const VAR_POPULATION = "INTERLIGENS_GRAPH_POPULATION";

/**
 * `Record<string, string | undefined>` et non `NodeJS.ProcessEnv` : ce dernier
 * exige `NODE_ENV`, ce qui rendrait intestable une injection minimale. La
 * fonction ne lit qu'une clé ; son paramètre ne doit pas en exiger d'autres.
 */
function lirePopulation(
  env: Record<string, string | undefined> = process.env,
): LecturePopulation {
  const brut = env[VAR_POPULATION];
  if (!brut) return { source: "ABSENTE" };
  try {
    const o = JSON.parse(brut);
    if (
      typeof o?.graphCase !== "number" ||
      typeof o?.graphNode !== "number" ||
      typeof o?.graphEdge !== "number"
    ) {
      return { source: "ABSENTE" };
    }
    return {
      source: "MESURE",
      graphCase: o.graphCase,
      graphNode: o.graphNode,
      graphEdge: o.graphEdge,
      date: typeof o.date === "string" ? o.date : "inconnue",
    };
  } catch {
    return { source: "ABSENTE" };
  }
}

/**
 * OBSERVATION DATÉE, conservée comme telle et JAMAIS traitée comme la vérité
 * courante : T1 a mesuré GraphCase = 0, GraphNode = 0, GraphEdge = 0 le
 * 2026-09-10. C'est ce qui rend les deux P0 LATENTS aujourd'hui. Ce n'est pas
 * une lecture live, et les gates ne s'en servent pas — sinon elles seraient
 * vertes pour toujours sur la foi d'une observation périmée.
 */
const OBSERVATION_T1 = { graphCase: 0, graphNode: 0, graphEdge: 0, date: "2026-09-10" } as const;

describe("S9/g0 — le trou de preuve est déclaré, et il ne se déguise pas en vert", () => {
  it("sans injection, la lecture est ABSENTE — jamais zéro par défaut", () => {
    expect(lirePopulation({})).toEqual({ source: "ABSENTE" });
    // Un JSON malformé est ABSENT, pas zéro : on ne devine pas une population.
    expect(lirePopulation({ [VAR_POPULATION]: "pas du json" })).toEqual({ source: "ABSENTE" });
    expect(lirePopulation({ [VAR_POPULATION]: '{"graphCase":"zéro"}' })).toEqual({ source: "ABSENTE" });
  });

  it("avec injection, elle est lue telle quelle", () => {
    const l = lirePopulation({
      [VAR_POPULATION]: '{"graphCase":3,"graphNode":9,"graphEdge":4,"date":"2026-10-01"}',
    });
    expect(l).toEqual({ source: "MESURE", graphCase: 3, graphNode: 9, graphEdge: 4, date: "2026-10-01" });
  });

  it("l'observation de T1 est datée et n'alimente aucune gate", () => {
    expect(OBSERVATION_T1.date).toBe("2026-09-10");
    // Elle n'est passée à personne : les gates ne lisent que `lirePopulation`.
    expect(peupleeSelon(OBSERVATION_T1)).toBe(false);
  });
});

const peupleeSelon = (p: { graphCase: number; graphNode: number; graphEdge: number }) =>
  p.graphCase > 0 || p.graphNode > 0 || p.graphEdge > 0;

// ═════════════════════════════════════════════════════════════════════════
// LA FONCTION DE GATE
// ═════════════════════════════════════════════════════════════════════════

type EtatGate = "VERT" | "ROUGE" | "NON_EVALUABLE";
interface Verdict {
  etat: EtatGate;
  /** Les DEUX moitiés, nommées. Une gate qui rougit sans dire quoi est inutile. */
  raisons: string[];
}

/**
 * Le défaut que la gate protège, réduit à un booléen + son libellé.
 * `null` = le défaut est fermé.
 */
interface DefautProtege {
  ouvert: boolean;
  libelle: string;
}

function evaluerGate(pop: LecturePopulation, defaut: DefautProtege): Verdict {
  if (pop.source === "ABSENTE") {
    return {
      etat: "NON_EVALUABLE",
      raisons: [
        `population non lue — injecter ${VAR_POPULATION} (voir S9/g0)`,
        defaut.ouvert ? `défaut OUVERT : ${defaut.libelle}` : "défaut fermé",
      ],
    };
  }
  const peuplee = peupleeSelon(pop);
  if (peuplee && defaut.ouvert) {
    return {
      etat: "ROUGE",
      raisons: [
        `population NON VIDE au ${pop.date} : case=${pop.graphCase} node=${pop.graphNode} edge=${pop.graphEdge}`,
        `défaut OUVERT : ${defaut.libelle}`,
      ],
    };
  }
  return {
    etat: "VERT",
    raisons: [peuplee ? "population non vide, défaut fermé" : "population vide"],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// LES SONDES — ce qui rend les gates ROBUSTES À LA FORME
// ═════════════════════════════════════════════════════════════════════════

/**
 * `readonly string[]` et NON `as const` : avec `as const`, `length` a le type
 * littéral `3` et TypeScript refuse `PARTENAIRES.length === 0` comme une
 * comparaison impossible (TS2367). Or c'est exactement le fail-safe qu'on
 * veut — la liste peut se vider par ÉDITION, ce que le type ne voit pas. Un
 * type qui interdit d'écrire la garde contre sa propre modification est un
 * type trop précis pour l'usage.
 */
const PARTENAIRES: readonly string[] = ["transaction-check", "score-lite", "batch-score"];

/**
 * ─── L'UNIVERS GOUVERNÉ EST COUVERT, PAS ÉNUMÉRÉ — 2026-09-10 ───────────
 *
 * « A gate must prove : 1. THE CLAIMED PROPERTY ; 2. THE GOVERNED SUBJECT
 *   UNIVERSE IS ACTUALLY COVERED. EMPTY SUBJECT SET != PASS unless emptiness
 *   is itself the governed expected state. »
 *
 * La première moitié était tenue par le fail-safe et l'assertion de longueur.
 * La seconde ne l'était pas : `PARTENAIRES` était une LISTE ÉCRITE À LA MAIN.
 * Une route partenaire ajoutée demain aurait échappé à la GATE 1 sans rien
 * faire rougir — la gate aurait affiché VERT en ne gardant que trois quarts
 * de son univers.
 *
 * L'univers est désormais DÉCOUVERT sur le disque, et la liste déclarée doit
 * lui être ÉGALE.
 */
const PARTENAIRES_DECOUVERTS: readonly string[] = (() => {
  return (readdirSync("src/app/api/partner/v1", { withFileTypes: true }) as Dirent[])
    .filter((e) => e.isDirectory() && e.name !== "__tests__")
    .map((e) => e.name)
    .filter((n) => existsSync(`src/app/api/partner/v1/${n}/route.ts`))
    .sort();
})();
const ROUTE_PARTENAIRE = (p: string) => codeSeul(SRC(`src/app/api/partner/v1/${p}/route.ts`));
const GRAPHE = () => codeSeul(SRC("src/app/api/scan/solana/graph/route.ts"));
const CANONIQUE = () => codeSeul(SRC("src/lib/publicScore/computeVerdict.ts"));

/**
 * SONDE GATE 1 — une surface FABRIQUE une lignée si elle en publie une SANS
 * preuve de mesure.
 *
 * Ce n'est délibérément PAS `contains('scam_lineage: "NONE"')`. Déplacer le
 * littéral dans une constante, un helper, ou un objet de configuration ne
 * changerait rien au défaut, et rendrait une sonde par littéral verte à tort.
 * Ce qui est sondé est donc :
 *
 *   publie   : la surface fournit une valeur de lignée au scoreur, quelle
 *              qu'en soit la forme — littéral, variable, appel ;
 *   preuve   : la surface NOMME le moteur dans un `ManqueMesure`, ou délègue à
 *              `measurePreBuy`, qui le nomme.
 *
 * La preuve retenue est exactement ce que le critère Q2 exige (« l'inventaire
 * doit NOMMER le moteur »). Les deux ne peuvent donc pas diverger : fermer Q
 * ferme cette moitié de la gate, par construction et non par coïncidence.
 */
function surfaceFabrique(code: string): boolean {
  const publie = /scam_lineage\s*:/.test(code);
  const preuve =
    /engine:\s*"scam_lineage"/.test(code) || /measurePreBuy/.test(code);
  return publie && !preuve;
}

/** SONDE GATE 2 — les deux classifieurs peuvent-ils diverger sur un même cas ? */
function classificationsDivergentes(graphe: string, canonique: string): boolean {
  const tableProducteur =
    "overall_status: clusters.length > 0 ? 'CONFIRMED' : flaggedNodes.length > 0 ? 'REFERENCED' : 'NONE',";
  const producteurATroisEtats = aplat(graphe).includes(tableProducteur);
  // Le canonique est aligné s'il reproduit les trois états, ou s'il délègue.
  const canoniqueAligne =
    aplat(canonique).includes(tableProducteur) ||
    /clusters?\.length\s*>\s*0/.test(canonique) ||
    /overallStatusDuGraphe|classerLignee/.test(canonique);
  // D3 — le repli de casse doit être des deux côtés ou d'aucun.
  const repliGraphe = /mode:\s*['"]insensitive['"]/.test(graphe);
  const repliCanonique = /mode:\s*['"]insensitive['"]/.test(canonique);
  const repliAligne = repliGraphe === repliCanonique;
  // FAIL-SAFE assumé : si l'ancre du producteur ne correspond plus, sa table a
  // changé et cette sonde ne sait plus ce qu'elle compare. Elle déclare alors
  // « divergentes », ce qui laisse la gate protéger au lieu de se taire. Le
  // prix est un faux ROUGE le jour où la table bouge légitimement — et c'est
  // le bon sens de l'erreur pour une gate.
  return !(producteurATroisEtats && canoniqueAligne && repliAligne);
}

/**
 * ─── CORRIGÉ LE 2026-09-10, BALAYAGE ANTI-CONCORDANCE ───────────────────
 *
 * `ouvert: fabriquantes.length > 0` se DÉSARMAIT SILENCIEUSEMENT si
 * `PARTENAIRES` devenait vide : zéro surface fabriquante, défaut « fermé »,
 * GATE 1 VERTE POUR TOUJOURS. Une gate dont la moitié « défaut » s'éteint
 * quand la liste qu'elle inspecte se vide n'est pas une gate stricte, c'est
 * une gate qu'il suffit de vider.
 *
 * FAIL-SAFE, comme la sonde de la GATE 2 : liste vide ⇒ la sonde ne sait plus
 * ce qu'elle inspecte ⇒ le défaut est déclaré OUVERT.
 */
const defautGate1 = (): DefautProtege => {
  if (PARTENAIRES.length === 0) {
    return { ouvert: true, libelle: "liste des surfaces partenaires VIDE — sonde désarmée" };
  }
  const fabriquantes = PARTENAIRES.filter((p) => surfaceFabrique(ROUTE_PARTENAIRE(p)));
  return {
    ouvert: fabriquantes.length > 0,
    libelle: `surfaces partenaires fabriquant une lignée sans mesure : ${fabriquantes.join(", ") || "aucune"}`,
  };
};

const defautGate2 = (): DefautProtege => ({
  ouvert: classificationsDivergentes(GRAPHE(), CANONIQUE()),
  libelle: "les deux chemins peuvent classer le même cas différemment (D1/D2/D3)",
});

// ═════════════════════════════════════════════════════════════════════════
// S9/g1 · LA FONCTION DE GATE, TESTÉE EXHAUSTIVEMENT
// ═════════════════════════════════════════════════════════════════════════

const POP_VIDE: LecturePopulation = {
  source: "MESURE", graphCase: 0, graphNode: 0, graphEdge: 0, date: "2026-09-10",
};
const POP_SEEDEE: LecturePopulation = {
  source: "MESURE", graphCase: 1, graphNode: 12, graphEdge: 7, date: "2026-11-01",
};
const OUVERT: DefautProtege = { ouvert: true, libelle: "le défaut" };
const FERME: DefautProtege = { ouvert: false, libelle: "le défaut" };

describe("S9/g1 — la gate est une fonction, et elle est totale", () => {
  it("G1 — population vide, défaut ouvert : VERT. Il n'y a rien à protéger encore", () => {
    expect(evaluerGate(POP_VIDE, OUVERT).etat).toBe("VERT");
  });

  it("G2 — population SEEDÉE, défaut ouvert : ROUGE, et les DEUX moitiés sont nommées", () => {
    const v = evaluerGate(POP_SEEDEE, OUVERT);
    expect(v.etat).toBe("ROUGE");
    expect(v.raisons.join(" | ")).toContain("population NON VIDE");
    expect(v.raisons.join(" | ")).toContain("défaut OUVERT");
    // La date de la mesure de population est dans le message : un rouge qui ne
    // dit pas de quand date son fait est inexploitable.
    expect(v.raisons.join(" | ")).toContain("2026-11-01");
  });

  it("G3 — l'ORDRE est imposé : corriger d'abord, seeder ensuite, reste VERT", () => {
    expect(evaluerGate(POP_VIDE, FERME).etat).toBe("VERT");
    expect(evaluerGate(POP_SEEDEE, FERME).etat).toBe("VERT");
  });

  it("G4 — SATISFIABILITÉ : la gate PEUT devenir verte avec une population", () => {
    // Une gate qui ne peut jamais se satisfaire est un blocage. Celle-ci se
    // satisfait exactement en fermant le défaut, ce qui est le but.
    const atteignable = [POP_VIDE, POP_SEEDEE]
      .flatMap((p) => [OUVERT, FERME].map((d) => evaluerGate(p, d)))
      .filter((v) => v.etat === "VERT");
    expect(atteignable.length).toBeGreaterThan(0);
    expect(evaluerGate(POP_SEEDEE, FERME).etat).toBe("VERT");
  });

  it("G5 — sans lecture de population : NON_EVALUABLE, jamais VERT", () => {
    for (const d of [OUVERT, FERME]) {
      const v = evaluerGate({ source: "ABSENTE" }, d);
      expect(v.etat).toBe("NON_EVALUABLE");
      expect(v.etat).not.toBe("VERT");
      expect(v.raisons.join(" | ")).toContain(VAR_POPULATION);
    }
  });

  it("G6 — n'importe laquelle des trois tables suffit à déclencher", () => {
    const base = { source: "MESURE" as const, graphCase: 0, graphNode: 0, graphEdge: 0, date: "d" };
    expect(evaluerGate({ ...base, graphCase: 1 }, OUVERT).etat).toBe("ROUGE");
    expect(evaluerGate({ ...base, graphNode: 1 }, OUVERT).etat).toBe("ROUGE");
    expect(evaluerGate({ ...base, graphEdge: 1 }, OUVERT).etat).toBe("ROUGE");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// S9/g2 · LES SONDES SONT ROBUSTES À LA FORME
// ═════════════════════════════════════════════════════════════════════════

describe("S9/g2 — déplacer le littéral ne rend pas vert", () => {
  const AVEC_LITTERAL = 'const x = { scam_lineage: "NONE", autre: 1 };';
  const LITTERAL_DEPLACE = 'const LIGNEE_PAR_DEFAUT = "NONE";\nconst x = { scam_lineage: LIGNEE_PAR_DEFAUT };';
  const MESUREE = 'manquants = [{ engine: "scam_lineage", reason: "FAILURE" }];\nconst x = { scam_lineage: l };';
  const DELEGUEE = "const m = await measurePreBuy(target);\nconst x = { scam_lineage: m.lignee };";

  it("le défaut est détecté sous sa forme actuelle", () => {
    expect(surfaceFabrique(AVEC_LITTERAL)).toBe(true);
  });

  it("ET sous sa forme déplacée — c'est l'axe C de S6, transposé", () => {
    expect(surfaceFabrique(LITTERAL_DEPLACE)).toBe(true);
  });

  it("une surface qui NOMME le moteur dans son inventaire n'est plus fabriquante", () => {
    expect(surfaceFabrique(MESUREE)).toBe(false);
  });

  it("une surface qui DÉLÈGUE au chemin de mesure non plus", () => {
    expect(surfaceFabrique(DELEGUEE)).toBe(false);
  });

  it("une surface qui ne publie aucune lignée n'est pas concernée", () => {
    expect(surfaceFabrique("const x = { chain: 'SOL' };")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// S9/g3 · LE BRAS LIVE — l'état réel du dépôt
// ═════════════════════════════════════════════════════════════════════════

describe("S9/g3 — GATE 1 : la population ne précède pas le correctif partenaire", () => {
  it("la sonde inspecte bien TROIS surfaces — une liste vide la désarmerait", () => {
    // Balayage du 2026-09-10 : sans cette assertion, vider `PARTENAIRES`
    // rendait la gate verte pour toujours. Ceinture, en plus du fail-safe.
    expect(PARTENAIRES).toHaveLength(3);
    // L'UNIVERS, couvert et non énuméré : une quatrième route partenaire fait
    // rougir ici, au lieu d'échapper silencieusement à la gate.
    expect([...PARTENAIRES].sort()).toEqual([...PARTENAIRES_DECOUVERTS]);
    expect(defautGate1().ouvert).toBe(true);
  });

  it("liste vide ⇒ défaut déclaré OUVERT, jamais fermé par défaut", () => {
    const vide = { ouvert: true, libelle: "liste des surfaces partenaires VIDE — sonde désarmée" };
    expect(evaluerGate(POP_SEEDEE, vide).etat).toBe("ROUGE");
  });

  it("CONSTAT — les trois surfaces partenaires fabriquent encore", () => {
    const d = defautGate1();
    expect(d.ouvert).toBe(true);
    for (const p of PARTENAIRES) expect(d.libelle, p).toContain(p);
  });

  it("GATE — évaluée sur l'état réel, et son verdict est explicite", () => {
    const v = evaluerGate(lirePopulation(), defautGate1());
    // Trois issues possibles, toutes acceptables SAUF le rouge.
    //   NON_EVALUABLE : la population n'est pas injectée (cas d'aujourd'hui)
    //   VERT          : population vide, ou défaut fermé
    //   ROUGE         : quelqu'un a seedé sans corriger — LA GATE MORD ICI
    expect(v.etat, `GATE 1 ROUGE — ${v.raisons.join(" | ")}`).not.toBe("ROUGE");
  });
});

describe("S9/g4 — GATE 2 : la population ne précède pas la résolution de la scission", () => {
  it("CONSTAT — les deux classifications peuvent encore diverger", () => {
    expect(defautGate2().ouvert).toBe(true);
  });

  it("GATE — évaluée sur l'état réel", () => {
    const v = evaluerGate(lirePopulation(), defautGate2());
    expect(v.etat, `GATE 2 ROUGE — ${v.raisons.join(" | ")}`).not.toBe("ROUGE");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// S9/g5 · LA GATE MORD VRAIMENT — démonstration, pas promesse
// ═════════════════════════════════════════════════════════════════════════

/**
 * Le reproche fait à un ruling est qu'il ne s'exécute pas. Le reproche
 * symétrique, qu'une gate exécutable mérite, est qu'elle n'ait jamais été vue
 * mordre. Ces tests SIMULENT le jour du seed, sur l'état réel du dépôt, sans
 * rien seeder : seule la moitié POPULATION est injectée.
 *
 * ─── VÉRIFIÉ LE 2026-09-10, DANS LES DEUX SENS ──────────────────────────
 *
 * Les deux moitiés ont été exercées pour de vrai, sans rien écrire en base :
 *
 *   population injectée, défauts OUVERTS ....... S9/g3 et S9/g4 ROUGES, et le
 *                                                message nomme les deux
 *                                                moitiés plus les trois routes
 *   population injectée, défauts FERMÉS ........ S9/g3 et S9/g4 VERTS
 *                                                → la gate est SATISFIABLE,
 *                                                  elle n'est pas un blocage
 *
 * Dans le second cas, ce sont les CONSTATS et cette section g5 qui rougissent
 * — c'est voulu, et c'est la même bascule que partout ailleurs dans ce corpus.
 *
 * ─── CE QU'IL FAUDRA FAIRE LE JOUR OÙ LES DÉFAUTS SERONT FERMÉS ─────────
 *
 * ██  RETIRER les constats et cette section. Pas les passer en `.skip`.    ██
 *
 * En un seul commit : supprimer S9/g5 et les deux `it("CONSTAT — ...")`, les
 * remplacer par leur anti-régression (les surfaces ne REDEVIENNENT pas
 * fabriquantes, les classifications ne REDIVERGENT pas), et GARDER S9/g3 et
 * S9/g4 tels quels — eux restent utiles pour toujours, puisqu'ils protègent
 * contre la réouverture. Rectifier aussi les constats jumeaux de S7 (axes Q
 * et R), qui cesseront d'être vrais le même jour.
 */
describe("S9/g5 — le jour du seed, sur l'état RÉEL des surfaces", () => {
  const JOUR_DU_SEED: LecturePopulation = {
    source: "MESURE", graphCase: 1, graphNode: 4, graphEdge: 2, date: "2026-XX-XX",
  };

  it("GATE 1 mordrait AUJOURD'HUI si quelqu'un seedait", () => {
    const v = evaluerGate(JOUR_DU_SEED, defautGate1());
    expect(v.etat).toBe("ROUGE");
    expect(v.raisons.join(" | ")).toContain("transaction-check");
    expect(v.raisons.join(" | ")).toContain("population NON VIDE");
  });

  it("GATE 2 mordrait AUJOURD'HUI si quelqu'un seedait", () => {
    const v = evaluerGate(JOUR_DU_SEED, defautGate2());
    expect(v.etat).toBe("ROUGE");
    expect(v.raisons.join(" | ")).toContain("D1/D2/D3");
  });

  it("et les deux mordraient EN MÊME TEMPS — c'est le scénario du voile qui se retire", () => {
    const deux = [defautGate1(), defautGate2()].map((d) => evaluerGate(JOUR_DU_SEED, d));
    expect(deux.every((v) => v.etat === "ROUGE")).toBe(true);
  });

  it("et elles deviendraient VERTES si les défauts étaient fermés d'abord", () => {
    // La sur-correction inverse : une gate qui reste rouge après correction
    // interdirait la population pour toujours.
    expect(evaluerGate(JOUR_DU_SEED, { ouvert: false, libelle: "" }).etat).toBe("VERT");
  });
});
