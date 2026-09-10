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
// C · « holders DANS expected » se réfute par un DILEMME sur deux règles de
//     comptage — corrigé le 2026-09-10, voir la rectification ci-dessous ;
// D · l'arithmétique du site n'est cohérente que sous la lecture HORS contrat ;
// E · ancrage lexical du site et de l'autorité.
//
// A à D s'exécutent contre les FONCTIONS RÉELLES exportées par
// canonicalDecision.ts. Aucune réimplémentation n'est testée à leur place.
//
// ─── RECTIFICATION DATÉE DU 2026-09-10 — la section C était SURQUALIFIÉE ──
//
// Ce que ce fichier affirmait à sa première écriture, et qui est FAUX :
//
//   « MUTANT-2 : l'état contradictoire est OBSERVABLE. » — et, dans le message
//   de d8104ea : « Réfutation COMPORTEMENTALE de l'appartenance, indépendante
//   de solManquants. »
//
// T1 l'a falsifié en construisant l'écriture que j'affirmais impossible.
// ÉTAT B — `expected: 3`, `holders` PARMI les trois, décrément gaté sur
// FAILURE. `holders` éteint émet alors NOT_REQUESTED_BY_CONTRACT, le décrément
// ne le compte pas, `expectedMeasured` reste 3 : la branche l. 109 évalue
// 3 < 3 → false, elle NE MORD PAS, et le motif est dans HORS_CONTRAT. L'état B
// est donc INDISTINGUABLE de la production sur tout comportement observable.
//
// Mon ablation M-b ne prouvait pas ce que je lui faisais dire : elle prouve que
// la l. 109 mord sur MA FIXTURE — qui pose `expected: 4`, donc 3 < 4 — et non
// que la production emprunte cette branche. La production ne l'emprunte pas.
//
// CE QUI RÉFUTE RÉELLEMENT L'APPARTENANCE est un dilemme sur les deux seules
// règles de comptage possibles, si `holders` était l'un des trois :
//
//   BRAS A — le décrément le compte. `holders` éteint en permanence (mesuré
//            des deux côtés le 2026-09-09) donne 2/3, donc `degraded: true` sur
//            TOUTE réponse SOL. Refusé explicitement par route.ts:348-351.
//   BRAS C — le décrément ne le compte pas. `expectedMeasured` affirme alors
//            TROIS attendus aboutis dont l'un est admis absent — contre sa
//            propre définition, « Ceux des attendus qui ont abouti »
//            (canonicalDecision.ts:52). La valeur ment.
//
// Les deux bras sont refusés, donc `holders` n'est pas l'un des trois. C'est
// une réfutation DÉFINITIONNELLE, et elle est plus forte que l'affirmation
// d'impossibilité qu'elle remplace, parce qu'elle est vérifiable : le bras C
// s'exhibe, section C3.
//
// Même famille que l'avertissement de P4 : une garde décrite plus fort qu'elle
// n'est. Un lecteur qui croirait tenir ici un `degraded: true` observable
// serait déçu au premier test réel — C3 le lui montre au lieu de le lui cacher.

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

// ═══ C · LE DILEMME D'APPARTENANCE ════════════════════════════════════════

describe("C · « holders DANS expected » se réfute par un dilemme, pas par une morsure", () => {
  /**
   * Les mutants ne touchent ni un seuil ni un compte de WARN : ils déplacent
   * UNE ligne d'un côté à l'autre du dénominateur. Mais ils ne mordent pas
   * tous, et c'est le point — C1 est le BRAS A du dilemme, C3 est le BRAS C,
   * et C3 ne mord sur RIEN d'observable. Voir la rectification en tête.
   */

  it("C1 · BRAS A — holders membre ET compté au décrément : `degraded` bascule", () => {
    const mutant: FaitsDeMesure = {
      expected: 4,
      expectedMeasured: 3,
      missing: [HOLDERS_EN_PANNE],
    };
    expect(estDegrade(PROD_HOLDERS_ETEINT)).toBe(false);
    expect(estDegrade(mutant)).toBe(true);
    expect(contratSatisfait(mutant)).toBe(false);
  });

  it("C2 · le dénominateur gonflé mord — mais sur l'arithmétique, PAS sur l'appartenance", () => {
    /**
     * Fixture d'origine de l'ancien « MUTANT-2 », conservée avec sa vraie
     * portée. `expected: 4` fait évaluer 3 < 4 à la l. 109 : ce qui mord est
     * le dénominateur GONFLÉ, pas le fait que `holders` soit membre. C'est
     * précisément ce que mon ablation M-b mesurait, et rien de plus.
     */
    const gonfle: FaitsDeMesure = {
      expected: 4,
      expectedMeasured: 3,
      missing: [HOLDERS_HORS_CONTRAT],
    };
    expect(estDegrade(gonfle)).toBe(true);
    expect(estDegrade(PROD_HOLDERS_ETEINT)).toBe(false);
  });

  it("C3 · BRAS C — l'état B de T1 est INDISTINGUABLE de la production", () => {
    /**
     * ⚠ CE TEST N'EST PAS UNE GARDE. Il exhibe une LIMITE, et il est ici pour
     * qu'aucun lecteur ne croie tenir un `degraded: true` observable.
     *
     * ÉTAT B — `expected: 3`, `holders` PARMI les trois, décrément gaté sur
     * FAILURE. Aucun observable ne le sépare de la production : mêmes nombres,
     * même `missing`, même verdict, même `degraded`. La l. 109 n'est pas
     * empruntée. Si l'appartenance de `holders` devait se trancher par le
     * comportement seul, elle serait INDÉCIDABLE.
     */
    const etatB: FaitsDeMesure = { expected: 3, expectedMeasured: 3, missing: [HOLDERS_HORS_CONTRAT] };

    expect(estDegrade(etatB)).toBe(estDegrade(PROD_HOLDERS_ETEINT));
    expect(contratSatisfait(etatB)).toBe(contratSatisfait(PROD_HOLDERS_ETEINT));
    expect(etatB).toEqual(PROD_HOLDERS_ETEINT);

    /**
     * Ce qui tue le bras C n'est donc pas un comportement, c'est la DÉFINITION
     * du champ : « Ceux des attendus qui ont abouti » (canonicalDecision.ts:52).
     * Sous l'état B, cette valeur vaut 3 alors que l'un des trois est nommé
     * absent dans `missing`. La valeur ment sur elle-même — et le mensonge est
     * exhibable, lui.
     */
    const nommesAbsents = etatB.missing.map((m) => m.engine);
    expect(nommesAbsents).toContain("holders");
    expect(etatB.expectedMeasured).toBe(3);
    // Trois aboutis affirmés, et l'un des trois est dans la liste des absents.
    // C'est la contradiction, et elle est arithmétique, pas comportementale.
    expect(etatB.expectedMeasured + nommesAbsents.length).toBeGreaterThan(etatB.expected);
  });

  it("C4 · le bras A traverse la décision canonique entière, pas seulement le prédicat", () => {
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
