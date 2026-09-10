// ─── BUILD 12 · S10 — BALAYAGE : LA COUVERTURE DU HARNAIS EST MESURÉE ─────
//
// ██  « Coverage of the proof harness is itself a measured property. »     ██
// ██  Le nombre de mutants n'est pas le KPI. Ce qui compte est la          ██
// ██  correspondance CRITÈRE ↔ TÉMOIN ↔ MUTANT ↔ CAUSE D'ÉCHEC.            ██
//
// Ce fichier est le RÉSULTAT d'un balayage des quatre corpus S6-S9, sur trois
// questions, et il rend ce résultat exécutable pour qu'il ne se dégrade pas.
//
//   Q1  quels critères sont satisfaits par CONCORDANCE plutôt que par mesure ?
//   Q2  quels critères tueraient la PRODUCTION ACTUELLE ?
//   Q3  quels critères dépendent d'une POPULATION NULLE pour passer ?
//
// Les correctifs sont dans les fichiers concernés ; ici on garde le résultat
// et on empêche sa réouverture. Aucune écriture prod, aucun chemin gelé.
//
// ─── UNE PROPRIÉTÉ QUE PERSONNE N'AVAIT POSÉE COMME OBJECTIF ─────────────
//
// ██  CE CORPUS REMARQUE QU'ON L'A VIDÉ.                                   ██
//
// Constaté le 2026-09-10, par accident et de la pire façon : une boucle de
// mutation restaurait par `git checkout -- __tests__/prebuy/`, dans un
// répertoire qui portait huit correctifs NON COMMITÉS. Le premier mutant les
// a tous effacés.
//
// Ce sont les tests de PRÉSENCE DES GARDES de ce fichier — S10/q1 et S10/q1b —
// qui ont rougi dès le second mutant, et ce rouge est ce qui a fait regarder.
// Le balayage a détecté sa propre destruction.
//
// Ce n'est donc pas un accident heureux, c'est la conséquence directe de la
// forme choisie : un corpus qui asserte l'EXISTENCE de ses propres gardes,
// et pas seulement leur résultat, signale son affaiblissement — qu'il vienne
// d'une suppression délibérée, d'un `.skip`, d'un refactor distrait ou d'un
// `git checkout` de trop. La règle qui en découle, adoptée le même jour :
// COMMITER AVANT TOUTE BOUCLE DE RESTAURATION DESTRUCTIVE — une boucle qui
// restaure par `checkout` traite tout le non-commité comme jetable, ce qui
// est vrai de ses propres mutations et faux du travail qui l'entoure.
//
// Corollaire à tenir : ne jamais retirer un test de présence de garde sous
// prétexte qu'il « ne teste rien de métier ». C'est lui qui tient les autres.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const T = (n: string) => readFileSync(`__tests__/prebuy/${n}`, "utf8");
const S6 = "s6-autorite-contrat-expected.test.ts";
const S7 = "s7-criteres-reassurance-lignee-couverture.test.ts";
const S8 = "s8-200-menteur-et-autorite-non-exercee.test.ts";
const S9 = "s9-hard-gates-population-lignee.test.ts";
const CORPUS = [S6, S7, S8, S9] as const;

/** Source SANS commentaires : une sonde de LECTURE ne doit pas lire les citations. */
const codeSeulDe = (n: string): string =>
  T(n)
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// ═════════════════════════════════════════════════════════════════════════
// Q1 · SATISFAITS PAR CONCORDANCE, OU PAR UN VIDE
// ═════════════════════════════════════════════════════════════════════════
//
// Deux sous-familles, et la seconde était la vraie exposition.
//
// (a) ACCORD ENTRE DEUX CHEMINS. Une seule occurrence : S7/R3
//     `chemins-divergents`. Elle ÉTAIT vacuous — deux chemins qui aplatissent
//     tout sur NONE s'accordent parfaitement. Fermée par R5 `etats-aplatis`.
//     Le test « le critère distingue-t-il "les deux mesurent et concordent"
//     de "les deux se taisent" ? » est désormais satisfait, et il est prouvé
//     par un test dédié : sous population nulle, l'axe R se réduit à R5.
//
//     La sonde d'alignement de la GATE 2 n'en est pas une : si l'ancre du
//     producteur ne correspond plus, elle déclare « divergentes » au lieu de
//     conclure à l'accord. Fail-safe, donc pas de concordance possible.
//
// (b) SATISFAITS PAR UNE COLLECTION VIDE. Quatre trouvailles, toutes fermées :
//
//       S9  `PARTENAIRES` vide → `fabriquantes.length > 0` faux → défaut
//           « fermé » → GATE 1 VERTE POUR TOUJOURS. La plus grave : une gate
//           qu'il suffit de vider. Fermée deux fois — assertion de longueur,
//           ET fail-safe dans `defautGate1`.
//       S8  `CONSOMMATEURS` vide → la BORNE DE CLASSE passe avec un site.
//       S8  `GOUVERNEES` vide → `derivent` vaut [] → le constat U ET le témoin
//           `it.fails` passent tous les deux. Le témoin de non-dérivation se
//           serait éteint sans un mot.
//       S7  `SITES.filter(...).toEqual([])` et `SITES.every(...)` sont TOUS
//           DEUX satisfaits par un tableau vide.
//
//     Les autres collections sont AUTO-PROTÉGÉES, et c'est mesuré et non
//     supposé : vider `ETATS_Q`, `ETATS`, `CAS` ou `COMPOSANTS` fait survivre
//     les mutants ou jeter la batterie, donc rougir.

describe("S10/q1 — aucune assertion de périmètre n'est satisfaite par un vide", () => {
  /**
   * ⚠ CES SONDES LISENT `codeSeulDe`, PAS LA SOURCE BRUTE — corrigé le
   * 2026-09-10, après un FAUX VERT dans cette garde même.
   *
   * `{ fichier: S8, garde: "expect(CONSOMMATEURS).toHaveLength(3)" }` a
   * continué de passer APRÈS que cette assertion eut été remplacée dans S8 par
   * la couverture d'univers — parce que la rectification écrite en tête de S8
   * CITE l'ancienne ligne dans un commentaire. La garde chargée d'empêcher les
   * gardes de disparaître validait donc sa propre nécrologie.
   *
   * C'est la quatrième occurrence de l'ancre qui matche une citation, et la
   * seule où elle produit un FAUX VERT plutôt qu'un faux rouge. Elle est la
   * plus dangereuse pour cette raison.
   */
  const GARDES: Array<{ fichier: string; garde: string }> = [
    { fichier: S9, garde: "expect(PARTENAIRES).toHaveLength(3)" },
    { fichier: S9, garde: "liste des surfaces partenaires VIDE — sonde désarmée" },
    { fichier: S8, garde: "expect([...CONSOMMATEURS].sort()).toEqual(CONSOMMATEURS_GOUVERNES)" },
    { fichier: S8, garde: "expect(GOUVERNEES).toHaveLength(5)" },
    { fichier: S7, garde: "expect(SITES.length).toBe(8)" },
    { fichier: S7, garde: "expect(PARTENAIRES).toHaveLength(3)" },
  ];

  for (const g of GARDES) {
    it(`${g.fichier} porte encore : ${g.garde}`, () => {
      expect(codeSeulDe(g.fichier), "présent en COMMENTAIRE ne compte pas").toContain(g.garde);
    });
  }

  it("la GATE 1 est fail-safe : liste vide ⇒ défaut OUVERT, jamais fermé", () => {
    // La ceinture, en plus des bretelles. Une gate ne se désarme pas parce
    // qu'on a vidé ce qu'elle inspecte.
    expect(codeSeulDe(S9)).toContain("if (PARTENAIRES.length === 0)");
    expect(codeSeulDe(S9)).toContain("ouvert: true");
  });

  it("L'UNIVERS GOUVERNÉ est COUVERT, pas énuméré — les deux surfaces", () => {
    // « THE GOVERNED SUBJECT UNIVERSE IS ACTUALLY COVERED. » Une liste écrite
    // à la main ne prouve pas la couverture : elle prouve qu'on a écrit une
    // liste. Les deux univers sont désormais DÉCOUVERTS sur le disque.
    expect(codeSeulDe(S9)).toContain("PARTENAIRES_DECOUVERTS");
    expect(codeSeulDe(S9)).toContain("expect([...PARTENAIRES].sort()).toEqual([...PARTENAIRES_DECOUVERTS])");
    expect(codeSeulDe(S8)).toContain("CONSOMMATEURS_DECOUVERTS");
    expect(codeSeulDe(S8)).toContain("CONSOMMATEURS_HORS_GOUVERNANCE");
  });

  it("et le rétrécissement de l'univers est une RÈGLE, pas une liste", () => {
    // Deux des six consommateurs du graphe sont exclus : ce sont des pages de
    // démo. L'exclusion passe par un prédicat vérifiable et les exclus sont
    // nommés — retirer des sujets en silence est la façon la plus simple de
    // faire passer une borne de classe.
    expect(codeSeulDe(S8)).toContain("const estRouteApi = (f: string) =>");
  });
});

describe("S10/q1b — chaque batterie a sa garde anti-vacuité, dans les DEUX sens", () => {
  /**
   * La règle ratifiée : tout critère nommé doit être tué par au moins un
   * mutant, ET aucun critère émis ne doit échapper à la liste déclarée. La
   * seconde moitié est celle qui manquait — un critère qui existe sans être
   * déclaré est aussi dangereux qu'un critère déclaré sans être tué.
   *
   * Ce test vérifie que les QUATRE batteries la portent. La batterie Q était
   * la seule sans garde jusqu'au balayage.
   */
  const BATTERIES = [
    { fichier: S7, batterie: "batterieQ", liste: "CRITERES_Q" },
    { fichier: S7, batterie: "batterieR", liste: "CRITERES_R" },
    { fichier: S8, batterie: "batterieT", liste: "CRITERES_T" },
    { fichier: S8, batterie: "batterieU", liste: "CRITERES_U" },
  ];

  it("les quatre batteries existent, et aucune n'a été retirée du balayage", () => {
    expect(BATTERIES).toHaveLength(4);
    for (const b of BATTERIES) {
      expect(codeSeulDe(b.fichier), `${b.batterie} a disparu`).toContain(`function ${b.batterie}`);
    }
  });

  for (const b of BATTERIES) {
    it(`${b.batterie} — garde présente, et dans les deux sens`, () => {
      const src = codeSeulDe(b.fichier);
      expect(src, `${b.liste} n'est pas déclarée`).toContain(`const ${b.liste} = [`);
      // Sens 1 : tout critère déclaré est tué.
      expect(src).toContain(`${b.liste}.filter((c) => !tues.has(c))`);
      // Sens 2 : tout critère émis est déclaré.
      expect(src).toContain(`[...tues].filter((c) => !${b.liste}.includes(c))`);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// Q2 · CRITÈRES QUI TUERAIENT LA PRODUCTION ACTUELLE
// ═════════════════════════════════════════════════════════════════════════
//
// Le test : un mutant étiqueté SUR-CORRECTION, donc comme un sur-ajustement
// HYPOTHÉTIQUE, décrit-il un comportement SERVI ? Si oui ce n'est pas un
// mutant, c'est un CONSTAT, et il change de forme.
//
// DEUX TROUVAILLES, toutes deux requalifiées :
//
//   R2  « SUR-CORRECTION — REFERENCED promu en CONFIRMED, une lignée
//       fabriquée ». La promotion est EN PRODUCTION : sur un cas à nœuds
//       flaggés sans lien, le canonique rend CONFIRMED là où le producteur
//       rend REFERENCED. Requalifié en « LE DÉFAUT ACTUEL, D2 » (a419cc9).
//
//   R5  « SUR-CORRECTION — les deux chemins s'accordent en aplatissant tout
//       sur NONE ». C'est l'état SERVI aujourd'hui : GraphCase = 0, donc
//       `getScamLineage` ne trouve jamais de cas et rend NONE, et le graphe
//       rend `source: 'no_data'`, donc NONE. Requalifié en CONSTAT.
//
// LES AUTRES SUR-CORRECTIONS ONT ÉTÉ VÉRIFIÉES UNE PAR UNE, et aucune n'est
// servie : refus permanent de conclure (Q), valeur mesurée non servie (Q),
// lignée fabriquée sur panne (T), mesure réelle déclassée (T), dégradation
// permanente (T), plus rien n'est canonique (U), déclaration nécessaire (U).

describe("S10/q2 — aucun mutant n'accuse un comportement servi", () => {
  it("R2 reste requalifié en DÉFAUT ACTUEL, pas en sur-correction", () => {
    const src = T(S7);
    expect(src).toContain("LE DÉFAUT ACTUEL, D2 — flaggé sans lien : REFERENCED contre CONFIRMED");
    // Et l'ancienne étiquette ne doit pas revenir.
    expect(src).not.toContain("SUR-CORRECTION — REFERENCED promu en CONFIRMED");
  });

  it("R5 reste requalifié en CONSTAT de l'état servi", () => {
    const src = T(S7);
    expect(src).toContain("CONSTAT — l'état SERVI aujourd'hui : population nulle");
    expect(src).not.toContain("SUR-CORRECTION — les deux chemins s'accordent");
  });

  it("les deux requalifications portent leur date et leur raison", () => {
    const src = T(S7);
    expect(src).toContain("REQUALIFIÉ LE 2026-09-10, BALAYAGE ANTI-CONCORDANCE");
    expect(src).toContain("RECTIFICATION DATÉE DU 2026-09-10");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Q3 · DÉPENDANCE À UNE POPULATION NULLE
// ═════════════════════════════════════════════════════════════════════════
//
// RÉSULTAT MESURÉ : aucun critère de S6-S9 ne lit la base. Tous sont lexicaux
// ou des fonctions pures. Aucun ne peut donc changer de couleur parce qu'une
// ligne apparaît dans GraphCase — sauf les gates de S9, qui sont conçues pour
// exactement ça et sont les gardes latentes VOULUES.
//
// MAIS LA RÉPONSE UTILE N'EST PAS « AUCUN ». Elle est l'inverse : c'est
// précisément parce qu'aucun critère ne lit la base que l'axe R n'est prouvé
// que sur un MODÈLE des deux classifieurs. Le jour où la population arrive,
// RIEN dans ce corpus n'exerce les vraies fonctions sur de vraies données.
//
// ─── TROU DE PREUVE DÉCLARÉ, famille S9/g0 ──────────────────────────────
//
//   CE QUI EST PROUVÉ : que les tables `TABLE_PRODUCTEUR` et `TABLE_CANONIQUE`
//   divergent sur D1, D2, D3 — et ces tables sont ancrées lexicalement sur les
//   deux sources, donc leur fidélité est gardée.
//
//   CE QUI NE L'EST PAS : que `getScamLineage` et le handler du graphe
//   divergent sur un vrai GraphCase. Les deux frappent la base ; ni l'un ni
//   l'autre n'est exécutable depuis la suite.
//
//   CE QU'IL FAUDRAIT : un test d'intégration sur une base de test seedée avec
//   les trois cas — liens sans flag, flag sans lien, casse différente — au
//   moment où la population de lignée est activée. C'est la contrepartie
//   naturelle des gates : elles interdisent de seeder avant correction, ce
//   test-là vérifie la correction sur des données réelles.

describe("S10/q3 — la dépendance à la population, mesurée et déclarée", () => {
  it("aucun corpus S6-S9 ne lit la base", () => {
    /**
     * La sonde vise l'IMPORT et l'APPEL, pas l'occurrence de la chaîne.
     * Première écriture : `not.toMatch(/prisma\.\w+\.findFirst/)`, qui rougissait
     * sur S7 — lequel CITE `prisma.graphCase.findFirst` entre guillemets, comme
     * ancre lexicale du chemin canonique. L'ancre matchait sa propre citation.
     * C'est la forme 2 de la série, une fois de plus, et sur l'outil du balayage.
     */
    for (const f of CORPUS) {
      expect(T(f), `${f} importe prisma`).not.toContain('from "@/lib/prisma"');
      expect(T(f), `${f} appelle prisma`).not.toMatch(/await\s+prisma\./);
    }
  });

  it("la seule dépendance à la population est INJECTÉE, et elle est dans les gates", () => {
    /**
     * ⚠ LA SONDE VISE LA LECTURE, PAS LA MENTION. Première écriture :
     * `not.toContain("INTERLIGENS_GRAPH_POPULATION")` sur la source BRUTE —
     * qui rougissait dès qu'un autre fichier CITAIT la variable dans un
     * commentaire, ce qu'a fait S8 en documentant la condition d'activation.
     * Une ancre qui matche une citation, quatrième fois dans ce travail : ici
     * elle accusait un fichier correct au lieu d'en absoudre un fautif.
     *
     * Ce qui compte est qu'aucun corpus hors gates ne LISE une population.
     */
    const lit = (f: string) =>
      /process\.env\s*\[?\s*["']?INTERLIGENS_GRAPH_POPULATION/.test(codeSeulDe(f)) ||
      /lirePopulation\s*\(/.test(codeSeulDe(f));
    expect(lit(S9), "les gates doivent lire la population").toBe(true);
    for (const f of [S6, S7, S8]) {
      expect(lit(f), `${f} LIT une population`).toBe(false);
    }
  });

  it("le trou de preuve de l'axe R est déclaré dans ce fichier", () => {
    // Un trou déclaré est une propriété ; un trou tu est une illusion de
    // couverture. Cette assertion existe pour que la déclaration ne parte pas
    // au premier nettoyage de commentaires.
    expect(T("s10-balayage-couverture-du-harnais.test.ts")).toContain(
      "TROU DE PREUVE DÉCLARÉ, famille S9/g0",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LA SÉRIE DES CINQ FORMES, TENUE À JOUR
// ═════════════════════════════════════════════════════════════════════════

describe("S10/serie — les cinq formes d'un contrôle qui ne contrôle rien", () => {
  /**
   * Toutes trouvées en trois jours, toutes déclarées avant les dégâts. Elles
   * sont listées ici parce qu'un corpus qui les a subies doit les nommer :
   *
   *   1. UN MUTANT QUI NE MUTE RIEN
   *   2. UN OUTILLAGE DONT L'ANCRE NE MATCHE PAS
   *   3. UN CONTRÔLE QUI NE PEUT PAS ÉCHOUER
   *   4. UN CRITÈRE VACUOUS — T3, avant que la conversion entre au périmètre
   *   5. UN CONTRÔLE DONT ON N'A PAS VÉRIFIÉ QU'IL S'EST EXÉCUTÉ
   *
   * La sixième est arrivée pendant ce balayage même : la commande d'audit
   * passait quatre chemins en un seul argument et ne lisait RIEN. Sortie vide,
   * donc attrapée — c'est la forme 2, sur l'outil qui cherchait la forme 2.
   *
   * Et une septième, qui est la conclusion de ce fichier :
   *   7. UN CRITÈRE SATISFAIT PAR CONCORDANCE — deux chemins qui se taisent
   *      s'accordent parfaitement. Invisible tant que la population est nulle.
   */
  it("les gardes qui ferment les formes 3, 4 et 7 sont toutes en place", () => {
    // Forme 3 — un contrôle qui ne peut pas échouer : ABSENTE ≠ zéro.
    expect(T(S9)).toContain('return { source: "ABSENTE" }');
    // Forme 4 — critère vacuous : les gardes anti-vacuité, quatre batteries.
    expect(T(S7)).toContain("GARDE ANTI-VACUITÉ");
    expect(T(S8)).toContain("GARDE ANTI-VACUITÉ");
    // Forme 7 — concordance : R5, et sa démonstration sous population nulle.
    expect(T(S7)).toContain("R5 etats-aplatis");
    expect(T(S7)).toContain("SOUS POPULATION NULLE, tout l'axe R se réduit à R5");
  });
});
