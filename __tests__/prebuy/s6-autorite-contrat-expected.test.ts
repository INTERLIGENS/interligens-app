// ─── BUILD 12 · S6 — L'AUTORITÉ DU CONTRAT `expected`, MESURÉE ────────────
//
// ██  La divergence T1/T2 sur `holders` se ferme, et elle me donne tort.  ██
//
// ─── LA QUESTION ─────────────────────────────────────────────────────────
//
// `holders` est-il l'un des trois membres d'`expected: 3` sur le chemin SOL de
// `/api/v1/score` (src/app/api/v1/score/route.ts:370) ?
//
// ─── MA DÉDUCTION, ET POURQUOI ELLE ÉTAIT FAUSSE ─────────────────────────
//
// J'avais écrit : « solManquants nomme market · holders · scam_lineage,
// EXACTEMENT TROIS, et expected vaut 3 — donc holders est l'un des trois. »
//
// L'inférence porte sur la mauvaise liste. `missing` n'est pas l'énumération
// des ATTENDUS : son propre contrat dit le contraire, « les manquants, avec
// leur cause exacte — HORS CONTRAT COMPRIS » (canonicalDecision.ts:53). Une
// liste qui admet des non-membres ne peut pas servir à compter les membres.
//
// Et le contre-exemple est en production, quatre-vingt-dix lignes au-dessus du
// site contesté : le chemin EVM du MÊME fichier déclare `expected: 1` avec
// TROIS entrées dans `missing` (route.ts:180-186). Si |missing| valait
// l'appartenance, ce site serait incohérent. Il ne l'est pas — il est la
// démonstration que les deux nombres ne se parlent pas.
//
// ─── L'AUTORITÉ, ET OÙ ELLE EST ──────────────────────────────────────────
//
// `expected` est un ENTIER NU partout (FaitsDeMesure.expected, « ce que le
// contrat demandait POUR CETTE requête », canonicalDecision.ts:49). Aucune
// structure ne porte ses membres. L'énumération existe pourtant, une seule
// fois, en prose, dans l'en-tête du chemin de mesure canonique :
//
//   src/lib/publicScore/computeVerdict.ts:88-96
//     « Le contrat de mesure ATTENDUE, par famille de cible.
//       SOL : marché, tigerscore et lignée de scam sont demandés — les trois.
//       EVM : seul tigerscore est demandé ; ... »
//
// Les trois noms sont des moteurs réels du vocabulaire (`market`,
// `scam_lineage`, et `tigerscore` — reflex/adapters/tigerscore.ts:97). Le
// compte colle des deux côtés : SOL 3, EVM 1. `holders` n'y figure pas, et
// n'apparaît nulle part dans computeVerdict.ts — le chemin qui PORTE le
// contrat ne le sonde même pas.
//
// ─── ET L'INDICE DU COMMENTAIRE « QUATRE » ───────────────────────────────
//
// route.ts:334 dit « Quatre capacités sont ATTENDUES » face à `expected: 3`.
// L'hypothèse indulgente — le littéral aurait été réduit sans redéfinir le
// contrat — est FAUSSE, mesurée : `git log -L` montre le commentaire, le motif
// HORS CONTRAT de `holders` et le littéral `3` NÉS DANS LE MÊME COMMIT
// (6585b63). Le `3` n'a jamais valu 4. Le commentaire était faux à l'arrivée,
// contredit quatre lignes plus bas par sa propre justification de quinze
// lignes : « il n'entre PAS au dénominateur ATTENDU » (route.ts:341).
//
// Ce n'est donc PAS le cas NOT_MEASURABLE du ruling : l'autorité existe et
// tranche. Elle tranche contre moi.
//
// ─── CE QUE CE FICHIER PROUVE ────────────────────────────────────────────
//
// A · le critère d'appartenance est le MOTIF, pas la présence dans `missing` ;
// B · |missing| et `expected` sont indépendants (forme EVM en production) ;
// C · le mutant d'APPARTENANCE mord : « holders DANS expected » a un
//     comportement observable, et ce n'est pas celui de la production ;
// D · l'arithmétique du site n'est cohérente que sous la lecture HORS contrat ;
// E · ancrage lexical du site et de l'autorité.
//
// A à D s'exécutent contre les FONCTIONS RÉELLES exportées par
// canonicalDecision.ts. Aucune réimplémentation n'est testée à leur place.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  canonicalPreBuyDecision,
  contratSatisfait,
  estDegrade,
  type FaitsDeMesure,
  type ManqueMesure,
} from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity } from "@/lib/prebuy/identity";

/** L'entrée `holders` telle que la route l'émet aujourd'hui. */
const HOLDERS_HORS_CONTRAT: ManqueMesure = {
  engine: "holders",
  reason: "NOT_REQUESTED_BY_CONTRACT",
};
/** La MÊME entrée, un seul champ changé : le motif. */
const HOLDERS_EN_PANNE: ManqueMesure = { engine: "holders", reason: "FAILURE" };

/**
 * L'état de production visé : `holders` indisponible — mesuré des deux côtés
 * le 2026-09-09 — et les trois attendus aboutis.
 */
const PROD_HOLDERS_ETEINT: FaitsDeMesure = {
  expected: 3,
  expectedMeasured: 3,
  missing: [HOLDERS_HORS_CONTRAT],
};

// ═══ A · LE CRITÈRE D'APPARTENANCE EST LE MOTIF ═══════════════════════════

describe("A · appartenance = motif, pas présence dans `missing`", () => {
  it("deux mesures identiques au motif près divergent sur `degraded`", () => {
    const horsContrat: FaitsDeMesure = PROD_HOLDERS_ETEINT;
    const enPanne: FaitsDeMesure = { ...PROD_HOLDERS_ETEINT, missing: [HOLDERS_EN_PANNE] };

    // Mêmes nombres, même |missing|, même moteur nommé. UN champ change.
    expect(horsContrat.expected).toBe(enPanne.expected);
    expect(horsContrat.expectedMeasured).toBe(enPanne.expectedMeasured);
    expect(horsContrat.missing).toHaveLength(enPanne.missing.length);

    expect(estDegrade(horsContrat)).toBe(false);
    expect(estDegrade(enPanne)).toBe(true);
  });

  it("être NOMMÉ dans `missing` ne retire rien au contrat satisfait", () => {
    expect(contratSatisfait(PROD_HOLDERS_ETEINT)).toBe(true);
  });
});

// ═══ B · |missing| ET `expected` SONT INDÉPENDANTS ════════════════════════

describe("B · la forme EVM en production réfute le comptage", () => {
  /**
   * Reprise littérale de route.ts:180-186 — `expected: 1`, TROIS manquants.
   * Si la présence dans `missing` valait appartenance, ce site déclarerait
   * trois attendus. Il en déclare un.
   */
  const EVM: FaitsDeMesure = {
    expected: 1,
    expectedMeasured: 1,
    missing: [
      { engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" },
      { engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" },
      { engine: "scam_lineage", reason: "NOT_REQUESTED_BY_CONTRACT" },
    ],
  };

  it("trois manquants coexistent avec un seul attendu, sans dégradation", () => {
    expect(EVM.missing).toHaveLength(3);
    expect(EVM.expected).toBe(1);
    expect(estDegrade(EVM)).toBe(false);
    expect(contratSatisfait(EVM)).toBe(true);
  });
});

// ═══ C · LE MUTANT D'APPARTENANCE ═════════════════════════════════════════

describe("C · déplacer `holders` DANS `expected` mord", () => {
  /**
   * Le mutant ne touche ni un seuil ni un compte de WARN : il déplace UNE
   * ligne d'un côté à l'autre du dénominateur. Les deux formes possibles de
   * ce déplacement sont testées, et les deux changent le comportement.
   */

  it("MUTANT-1 — holders membre ET en panne : `degraded` bascule", () => {
    const mutant: FaitsDeMesure = {
      expected: 4,
      expectedMeasured: 3,
      missing: [HOLDERS_EN_PANNE],
    };
    expect(estDegrade(PROD_HOLDERS_ETEINT)).toBe(false);
    expect(estDegrade(mutant)).toBe(true);
    expect(contratSatisfait(mutant)).toBe(false);
  });

  it("MUTANT-2 — holders membre ET HORS CONTRAT : l'état contradictoire est OBSERVABLE", () => {
    /**
     * C'est l'état que j'affirmais impossible — « simultanément DANS le
     * dénominateur et HORS contrat, les deux ne peuvent pas être vrais
     * ensemble ». Il est parfaitement exprimable. Ce qui est faux, c'est qu'il
     * décrive la production : `estDegrade` mord dessus par sa PREMIÈRE branche
     * (l'arithmétique, canonicalDecision.ts:109) avant même de regarder le
     * motif. `holders` membre ferait donc `degraded: true` sur TOUTE réponse
     * SOL — exactement ce que la justification de route.ts:348-351 refuse.
     */
    const mutant: FaitsDeMesure = {
      expected: 4,
      expectedMeasured: 3,
      missing: [HOLDERS_HORS_CONTRAT],
    };
    expect(estDegrade(mutant)).toBe(true);
    expect(estDegrade(PROD_HOLDERS_ETEINT)).toBe(false);
  });

  it("le mutant traverse la décision canonique entière, pas seulement le prédicat", () => {
    const decide = (m: FaitsDeMesure) =>
      canonicalPreBuyDecision({
        score: 10,
        measurement: m,
        identity: resolveTokenIdentity({
          syntacticallyValid: true,
          attestations: [{ source: "casefile", attests: true }],
        }),
      });

    const reel = decide(PROD_HOLDERS_ETEINT);
    const mutant = decide({ expected: 4, expectedMeasured: 3, missing: [HOLDERS_HORS_CONTRAT] });

    expect(reel.degraded).toBe(false);
    expect(reel.expectedContractSatisfied).toBe(true);
    expect(mutant.degraded).toBe(true);
    expect(mutant.expectedContractSatisfied).toBe(false);
  });
});

// ═══ D · LA COHÉRENCE ARITHMÉTIQUE DU SITE ════════════════════════════════

describe("D · le dénominateur n'est cohérent que sous la lecture HORS contrat", () => {
  /**
   * Ici on ne teste PAS une fonction : `expectedMeasured` est une EXPRESSION
   * écrite au site d'appel (route.ts:371-372), pas un point d'entrée. On
   * reproduit donc la formule, et on l'annonce — c'est le piège que S5 a payé
   * une fois : prouver sa propre copie et croire avoir prouvé la production.
   * La formule est ancrée mot pour mot en section E ; un mutant qui l'édite au
   * site fait rougir E, pas D.
   */
  const formuleDuSite = (manquants: ManqueMesure[]) =>
    3 - manquants.filter((m) => m.reason === "FAILURE").length;

  it("holders seul indisponible laisse le rapport PLEIN : 3/3", () => {
    expect(formuleDuSite([HOLDERS_HORS_CONTRAT])).toBe(3);
  });

  it("sous la lecture « holders ∈ expected », le site déclarerait 3/3 en sachant qu'un des trois a manqué", () => {
    /**
     * Deux lectures, une seule survit :
     *
     *   holders ∈ {les trois}  →  3 mesurés sur 3 alors que l'un des trois est
     *                             admis absent. `expectedMeasured` MENT.
     *   holders ∉ {les trois}  →  3 mesurés sur 3, et les trois sont market,
     *                             tigerscore et lignée — tous aboutis. VRAI.
     */
    const rapport = formuleDuSite([HOLDERS_HORS_CONTRAT]);
    expect(rapport).toBe(3);
    expect(contratSatisfait({ expected: 3, expectedMeasured: rapport, missing: [HOLDERS_HORS_CONTRAT] })).toBe(true);
  });

  it("les seuls moteurs capables de décrémenter sont market et scam_lineage", () => {
    // Le troisième membre ne peut pas échouer : `tigerscore` est calculé
    // localement et sans garde (route.ts:297), donc il n'entre jamais dans
    // `solManquants`. Le plancher du rapport est 1, jamais 0.
    expect(formuleDuSite([{ engine: "market", reason: "FAILURE" }])).toBe(2);
    expect(
      formuleDuSite([
        { engine: "market", reason: "FAILURE" },
        HOLDERS_HORS_CONTRAT,
        { engine: "scam_lineage", reason: "FAILURE" },
      ]),
    ).toBe(1);
  });
});

// ═══ E · ANCRAGE LEXICAL ══════════════════════════════════════════════════

/**
 * ─── PREUVE LEXICALE, ANNONCÉE COMME TELLE ──────────────────────────────
 *
 * Règle ratifiée le 2026-09-09. Le comportement ne suffit pas ici pour deux
 * raisons distinctes :
 *
 *   1. le site contesté est le corps d'un handler `GET` qui ouvre quatre
 *      appels réseau en parallèle plus un `fetch` interne vers
 *      /api/scan/solana/graph — il n'est pas exécutable depuis la suite, et
 *      `expected: 3` n'est exporté par rien ;
 *   2. l'AUTORITÉ elle-même est en PROSE. Une énumération qui vit dans un
 *      commentaire ne peut être liée que lexicalement. C'est la fragilité
 *      réelle du contrat, et ce test la rend visible au lieu de la masquer.
 *
 * Contrairement à S5, on ne retire PAS les commentaires : ici le commentaire
 * EST l'objet de la preuve. Les assertions de code, elles, portent sur du code.
 */
const ROUTE = readFileSync("src/app/api/v1/score/route.ts", "utf8");
const AUTORITE = readFileSync("src/lib/publicScore/computeVerdict.ts", "utf8");
const aplat = (s: string) => s.replace(/\s+/g, " ");

describe("E · le site et l'autorité, ancrés", () => {
  it("l'autorité énumère les trois membres SOL, et holders n'en est pas", () => {
    expect(AUTORITE).toContain(
      "SOL : marché, tigerscore et lignée de scam sont demandés — les trois.",
    );
    expect(AUTORITE).toContain("EVM : seul tigerscore est demandé");
    // Le chemin qui porte le contrat ne sonde même pas holders.
    expect(AUTORITE).not.toContain("holders");
  });

  it("le site SOL déclare 3 et tague holders HORS CONTRAT", () => {
    expect(aplat(ROUTE)).toContain(aplat(`expected: 3,
        expectedMeasured:
          3 - solManquants.filter((m) => m.reason === "FAILURE").length,`));
    expect(aplat(ROUTE)).toContain(
      aplat(`{ engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" as const }`),
    );
  });

  it("le site EVM déclare 1 avec trois manquants — le contre-exemple est bien là", () => {
    expect(aplat(ROUTE)).toContain(aplat(`expected: 1,
          expectedMeasured: 1,
          missing: [
            { engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" },
            { engine: "holders", reason: "NOT_REQUESTED_BY_CONTRACT" },
            { engine: "scam_lineage", reason: "NOT_REQUESTED_BY_CONTRACT" },
          ],`));
  });

  it("DETTE OUVERTE — l'en-tête du site annonce QUATRE attendues et se contredit", () => {
    /**
     * Ce test ne défend pas le commentaire : il le CONSTATE. Tant que la
     * phrase est là, le fichier porte une fausse énumération née avec lui
     * (6585b63) ; le jour où elle est corrigée, ce test rougit et sera retiré
     * dans le même geste. C'est un marqueur de dette, pas un invariant.
     *
     * Aucune correction n'est appliquée ici : consigne « n'implémente rien »
     * tant que l'autorité n'est pas mesurée. Elle l'est maintenant — la
     * correction est proposée, pas prise.
     */
    expect(ROUTE).toContain("Quatre capacités sont ATTENDUES sur ce chemin");
    expect(ROUTE).toContain("il n'entre PAS au dénominateur");
    // Les deux phrases sont dans le même bloc, à quelques lignes d'écart.
    const iQuatre = ROUTE.indexOf("Quatre capacités sont ATTENDUES");
    const iHors = ROUTE.indexOf("il n'entre PAS au dénominateur");
    expect(iHors - iQuatre).toBeGreaterThan(0);
    expect(iHors - iQuatre).toBeLessThan(600);
  });
});
