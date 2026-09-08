// ─── BUILD 11 · REFLEX V2 · S4 — MUTANTS SÉMANTIQUES ET PREUVE ADVERSE ─────
//
// ██  Prouver que la batterie MORD. Pas qu'une implémentation passe.       ██
//
// S1 écrit le contrat voulu. S4 attaque LA BATTERIE elle-même : pour chaque
// propriété gouvernée, on fabrique une implémentation qui la viole, et on
// exige qu'au moins un critère la tue. Un mutant qui survit est une preuve
// manquante, et on le dit.
//
// ─── Pourquoi des implémentations, et pas des patches de source ───────────
//
// S2 n'existe pas encore : T1 l'écrit pendant que ceci tourne. Muter un
// fichier qui n'est pas écrit est impossible ; muter le fichier ACTUEL ne
// prouverait rien, puisqu'il viole déjà douze critères. On mute donc au
// niveau du CONTRAT — chaque mutant est une implémentation plausible et
// fausse. La batterie est le livrable ; l'implémentation reste à T1.
//
// ─── Le témoin de satisfiabilité ──────────────────────────────────────────
//
// Une batterie que rien ne peut passer ne vaut rien. `TEMOIN` est là pour
// démontrer qu'elle est satisfiable — c'est un TÉMOIN, PAS UNE PROPOSITION
// DE DESIGN. T1 est libre d'implémenter tout autrement : seule la batterie
// fait foi.
//
// ─── L'interdit respecté ici ──────────────────────────────────────────────
//
// AUCUN seuil de couverture n'est présupposé. La batterie n'affirme que ce
// qui est gouverné : 0 moteur mesuré ne peut pas produire un verdict
// rassurant. Où se situe la limite entre 1/8 et 8/8 n'est PAS gouverné, donc
// n'est ni testé ni impliqué. Voir « STOP METHODOLOGY » en fin de fichier.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { decide } from "@/lib/reflex/verdict";
import { ACTION_WORDING } from "@/lib/reflex/constants";
import type {
  ReflexEngineOutput,
  ReflexSignal,
  ReflexSignalSource,
  ReflexVerdict,
} from "@/lib/reflex/types";

// ═══ LE CONTRAT — DEUX AXES QUI NE SE MÉLANGENT PAS ══════════════════════

/** Axe MESURE. Décrit ce qui a pu être observé, jamais ce qu'on publie. */
const MESURE_ABSENCE = [
  "NOT_MEASURED",    // mesurable, pas mesuré
  "NOT_MEASURABLE",  // ne peut pas l'être avec le contexte disponible
  "FAILURE",         // tenté et échoué
  "STALE",           // mesuré mais hors politique — seulement si démontrable
  "UNKNOWN",
  "NOT_APPLICABLE",
] as const;
type MesureAbsence = (typeof MESURE_ABSENCE)[number];

/** Axe PUBLICATION. Ces jetons ne décrivent AUCUN état de mesure. */
const PUBLICATION_ETATS = ["WITHHELD", "NOT_PUBLISHED"] as const;

interface Manquant {
  engine: ReflexSignalSource;
  reason: MesureAbsence;
  detail?: string;
}
interface Couverture {
  total: number;
  measured: number;
  missing: Manquant[];
}
interface Sortie {
  verdict: ReflexVerdict | "MEASUREMENT_INCOMPLETE";
  verdictReasonEn: string[];
  actionEn: string;
  coverage: Couverture;
}
type Impl = (engines: ReflexEngineOutput[]) => Sortie;

// ═══ FABRIQUES ═══════════════════════════════════════════════════════════

const LES_HUIT: ReflexSignalSource[] = [
  "tigerscore", "offchain", "coordination", "knownBad",
  "intelligenceOverlay", "recidivism", "casefileMatch", "narrative",
];

const propre = (engine: ReflexSignalSource): ReflexEngineOutput =>
  ({ engine, ran: true, ms: 12, signals: [] });

const enPanne = (engine: ReflexSignalSource, error = "provider timeout"): ReflexEngineOutput =>
  ({ engine, ran: false, ms: 5000, signals: [], error });

const nonSollicite = (engine: ReflexSignalSource): ReflexEngineOutput =>
  ({ engine, ran: false, ms: 0, signals: [] });

const avecStop = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine, ran: true, ms: 20,
  signals: [{
    source: engine, code: `${engine}.critical`, severity: "CRITICAL",
    confidence: 0.95, stopTrigger: true, reasonEn: "critical", reasonFr: "critique",
  } as ReflexSignal],
});

const TOUS_PROPRES = () => LES_HUIT.map(propre);
const TOUS_EN_PANNE = () => LES_HUIT.map((e) => enPanne(e));
const TOUS_NON_SOLLICITES = () => LES_HUIT.map(nonSollicite);
const MIXTE = () => [
  ...LES_HUIT.slice(0, 5).map(propre),
  ...LES_HUIT.slice(5).map((e) => enPanne(e)),
];

// ═══ LE TÉMOIN — satisfiabilité, pas design ══════════════════════════════

const TEMOIN: Impl = (engines) => {
  const missing: Manquant[] = engines
    .filter((e) => !e.ran)
    .map((e) => ({
      engine: e.engine,
      // « tenté et échoué » ≠ « jamais sollicité ». La distinction existe
      // déjà à la source : un catch pose `error`, NOOP_ENGINE ne le pose pas.
      reason: e.error ? "FAILURE" : "NOT_MEASURED",
      detail: e.error,
    }));
  const coverage: Couverture = {
    total: engines.length,
    measured: engines.filter((e) => e.ran).length,
    missing,
  };
  const base = decide(engines);
  // Seule règle gouvernée : zéro mesure ne peut pas rassurer.
  const verdict: Sortie["verdict"] =
    coverage.measured === 0 && base.verdict === "NO_CRITICAL_SIGNAL"
      ? "MEASUREMENT_INCOMPLETE"
      : base.verdict;
  return {
    verdict,
    verdictReasonEn:
      verdict === "MEASUREMENT_INCOMPLETE"
        ? missing.map((m) => `${m.engine}: ${m.reason}`)
        : base.verdictReasonEn,
    actionEn: verdict === "MEASUREMENT_INCOMPLETE" ? "" : base.actionEn,
    coverage,
  };
};

// ═══ LA BATTERIE — ce que toute implémentation doit satisfaire ═══════════
//
// Renvoie la liste des critères VIOLÉS. Vide = l'implémentation passe.

function batterie(impl: Impl): string[] {
  const viole: string[] = [];
  const dit = (ok: boolean, critere: string) => { if (!ok) viole.push(critere); };

  // ── Famille A — ABSENCE → SAFE ────────────────────────────────────────
  const panne = impl(TOUS_EN_PANNE());
  dit(panne.verdict !== "NO_CRITICAL_SIGNAL", "A1 0-mesure-rassurante");

  const propres = impl(TOUS_PROPRES());
  dit(
    JSON.stringify(panne.coverage) !== JSON.stringify(propres.coverage),
    "A2 panne-indistinguable-de-propre",
  );

  dit(
    panne.coverage.missing.every((m) => m.detail !== undefined),
    "A3 error-jete-avant-le-consommateur",
  );

  const mixte = impl(MIXTE());
  dit(mixte.coverage.measured !== mixte.coverage.total, "A4 partielle-rendue-complete");
  dit(mixte.coverage.missing.length > 0, "A4b manquants-effaces");

  dit(
    !Object.values(panne).some((v) => v === 0 || v === "0"),
    "A5 zero-encodant-rien-mesure",
  );

  // ── Famille B — DIVERGENCE VERDICT / EXPLICATION ──────────────────────
  const stop = impl([...TOUS_PROPRES().slice(1), avecStop("knownBad")]);
  // Le STOP doit survivre à une couverture COMPLÈTE *et* à une couverture
  // trouée. La première sonde seule laissait passer le mutant B1 — un
  // mutant qui ne mord pas est une preuve manquante, pas un mutant à
  // retirer. Ceci ne fixe AUCUN seuil : un signal critique fondé ne peut
  // pas être effacé par la panne d'un moteur SANS RAPPORT, quel que soit
  // le nombre de moteurs manquants.
  const stopTroue = impl([
    avecStop("knownBad"),
    ...LES_HUIT.slice(1, 4).map(propre),
    ...LES_HUIT.slice(4).map((e) => enPanne(e)),
  ]);
  dit(stop.verdict === "STOP" && stopTroue.verdict === "STOP", "B1 verdict-legitime-supprime");
  dit(
    stop.verdict !== "STOP" || stop.actionEn === ACTION_WORDING.STOP.en,
    "B2 action-divergente-du-verdict",
  );
  dit(
    stop.verdict === "STOP" ? stop.verdictReasonEn.length > 0 : true,
    "B3 verdict-sans-explication",
  );
  dit(
    panne.verdict === "NO_CRITICAL_SIGNAL" || panne.verdictReasonEn.length > 0,
    "B4 degradation-sans-explication",
  );

  // ── Famille C — SUR-CORRECTIONS ───────────────────────────────────────
  dit(
    propres.coverage.missing.length === 0 &&
      propres.coverage.measured === propres.coverage.total,
    "C1 complete-rendue-partielle",
  );
  dit(propres.verdict === "NO_CRITICAL_SIGNAL", "C2 verdict-legitime-supprime-sur-mesure-propre");

  const tousEtats = [
    ...panne.coverage.missing,
    ...mixte.coverage.missing,
    ...impl(TOUS_NON_SOLLICITES()).coverage.missing,
  ];
  dit(
    tousEtats.every((m) => (MESURE_ABSENCE as readonly string[]).includes(m.reason)),
    "C3 etat-hors-vocabulaire",
  );
  dit(
    tousEtats.every((m) => !(PUBLICATION_ETATS as readonly string[]).includes(m.reason)),
    "C4 etat-de-publication-sur-l-axe-mesure",
  );
  dit(
    !tousEtats.some((m) => m.reason === "STALE"),
    "C5 STALE-affirme-sans-preuve",
  );

  return viole;
}

// ═══ 1 · SATISFIABILITÉ ══════════════════════════════════════════════════

describe("S4/1 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", () => {
    // Sans ceci, une batterie qui tue tout serait indistinguable d'une
    // batterie exigeante. C'est le contrôle qui rend les mutants lisibles.
    expect(batterie(TEMOIN)).toEqual([]);
  });
});

// ═══ 2 · MUTANTS — chacun DOIT être tué ══════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Impl }

const MUTANTS: Mutant[] = [
  // ── Famille A : absence → réassurance ───────────────────────────────
  {
    nom: "A1 — 0/8 moteurs réussis produit quand même le verdict rassurant",
    critere: "A1 0-mesure-rassurante",
    impl: (e) => ({ ...TEMOIN(e), verdict: decide(e).verdict }),
  },
  {
    nom: "A2 — panne et mesure propre rendues indistinguables",
    critere: "A2 panne-indistinguable-de-propre",
    impl: (e) => {
      const t = TEMOIN(e);
      // La mutation classique : compter les moteurs sans dire lesquels
      // manquent ni pourquoi. C'est ce que fait `engineContribution`
      // aujourd'hui en rendant `null` dans les deux cas.
      return { ...t, coverage: { total: e.length, measured: e.length, missing: [] } };
    },
  },
  {
    nom: "A3 — `error` jeté avant le consommateur (le manifeste actuel)",
    critere: "A3 error-jete-avant-le-consommateur",
    impl: (e) => {
      const t = TEMOIN(e);
      return {
        ...t,
        coverage: {
          ...t.coverage,
          missing: t.coverage.missing.map(({ engine, reason }) => ({ engine, reason })),
        },
      };
    },
  },
  {
    nom: "A4 — couverture partielle rendue comme complète",
    critere: "A4 partielle-rendue-complete",
    impl: (e) => {
      const t = TEMOIN(e);
      return { ...t, coverage: { ...t.coverage, measured: t.coverage.total } };
    },
  },
  {
    nom: "A5 — le score 0 réintroduit pour encoder « rien mesuré »",
    critere: "A5 zero-encodant-rien-mesure",
    impl: (e) => {
      const t = TEMOIN(e);
      return { ...t, ...(t.coverage.measured === 0 ? { confidenceScore: 0 } : {}) } as Sortie;
    },
  },

  // ── Famille B : divergence verdict / explication ────────────────────
  {
    nom: "B1 — un STOP légitime est écrasé par la dégradation",
    critere: "B1 verdict-legitime-supprime",
    impl: (e) => {
      const t = TEMOIN(e);
      // Sur-prudence inversée : dès qu'un moteur manque, on abandonne le
      // verdict — y compris un STOP parfaitement fondé.
      return t.coverage.missing.length > 0
        ? { ...t, verdict: "MEASUREMENT_INCOMPLETE", actionEn: "" }
        : t;
    },
  },
  {
    nom: "B2 — l'action cesse d'être indexée par le verdict",
    critere: "B2 action-divergente-du-verdict",
    impl: (e) => {
      const t = TEMOIN(e);
      // Aujourd'hui `ACTION_WORDING[verdict]` rend la divergence
      // IMPOSSIBLE. Ce mutant fabrique la seconde autorité qui la rendrait
      // possible — pour que la propriété soit PROUVÉE, pas seulement
      // constatée.
      return { ...t, actionEn: t.verdict === "STOP" ? ACTION_WORDING.WAIT.en : t.actionEn };
    },
  },
  {
    nom: "B3 — un verdict est rendu sans aucune explication",
    critere: "B3 verdict-sans-explication",
    impl: (e) => ({ ...TEMOIN(e), verdictReasonEn: [] }),
  },
  {
    nom: "B4 — la dégradation est rendue sans dire ce qui manque",
    critere: "B4 degradation-sans-explication",
    impl: (e) => {
      const t = TEMOIN(e);
      return t.verdict === "MEASUREMENT_INCOMPLETE" ? { ...t, verdictReasonEn: [] } : t;
    },
  },

  // ── Famille C : sur-corrections ─────────────────────────────────────
  {
    nom: "C1 — une couverture COMPLÈTE rendue partielle par excès de prudence",
    critere: "C1 complete-rendue-partielle",
    impl: (e) => {
      const t = TEMOIN(e);
      // « Dans le doute, déclarons incomplet. » Le doute devient permanent,
      // le signal de dégradation perd tout pouvoir discriminant.
      return {
        ...t,
        coverage: {
          ...t.coverage,
          measured: Math.max(0, t.coverage.measured - 1),
          missing: [...t.coverage.missing, { engine: "narrative", reason: "UNKNOWN" }],
        },
      };
    },
  },
  {
    nom: "C2 — le verdict rassurant supprimé même sur mesure propre complète",
    critere: "C2 verdict-legitime-supprime-sur-mesure-propre",
    impl: (e) => ({ ...TEMOIN(e), verdict: "MEASUREMENT_INCOMPLETE" }),
  },
  {
    nom: "C3 — un état inventé hors du vocabulaire ratifié",
    critere: "C3 etat-hors-vocabulaire",
    impl: (e) => {
      const t = TEMOIN(e);
      return {
        ...t,
        coverage: {
          ...t.coverage,
          missing: t.coverage.missing.map((m) => ({ ...m, reason: "NO_DATA" as MesureAbsence })),
        },
      };
    },
  },
  {
    nom: "C4 — un état de PUBLICATION posé sur l'axe MESURE (WITHHELD au lieu de NOT_MEASURED)",
    critere: "C4 etat-de-publication-sur-l-axe-mesure",
    impl: (e) => {
      const t = TEMOIN(e);
      // La confusion exacte que GPT interdit : « on ne l'affiche pas »
      // employé pour dire « on ne l'a pas mesuré ». Le premier est une
      // décision, le second une lacune. Les confondre efface la décision
      // ET la lacune.
      return {
        ...t,
        coverage: {
          ...t.coverage,
          missing: t.coverage.missing.map((m) => ({ ...m, reason: "WITHHELD" as MesureAbsence })),
        },
      };
    },
  },
  {
    nom: "C5 — STALE affirmé alors qu'aucun instant d'observation n'existe",
    critere: "C5 STALE-affirme-sans-preuve",
    impl: (e) => {
      const t = TEMOIN(e);
      // Arbitrage T : sans instant d'observation valide à la frontière
      // d'adaptateur, la capacité de fraîcheur vaut NOT_MEASURABLE. Rien
      // n'est jamais qualifié STALE sans preuve.
      return {
        ...t,
        coverage: {
          ...t.coverage,
          missing: t.coverage.missing.map((m) => ({ ...m, reason: "STALE" as MesureAbsence })),
        },
      };
    },
  },
];

describe("S4/2 — chaque mutant est tué, et par le critère attendu", () => {
  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const violes = batterie(m.impl);
      // Tué : la batterie ne le laisse pas passer.
      expect(violes, `mutant SURVIVANT = preuve manquante — ${m.nom}`).not.toEqual([]);
      // Tué par le BON critère : un mutant tué par accident, via un critère
      // sans rapport, ne prouve pas la propriété qu'il visait.
      expect(violes, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("les 14 mutants sont tous déclarés — aucun retrait silencieux", () => {
    expect(MUTANTS).toHaveLength(14);
    expect(new Set(MUTANTS.map((m) => m.critere)).size).toBe(14);
  });
});

// ═══ 3 · LA PROPRIÉTÉ D'AUJOURD'HUI, PROUVÉE PLUTÔT QUE CONSTATÉE ════════

describe("S4/3 — verdict et action sortent de la même autorité", () => {
  it("`ACTION_WORDING` est indexée par le verdict, dans le source", () => {
    const src = readFileSync("src/lib/reflex/verdict.ts", "utf8");
    expect(src).toContain("ACTION_WORDING[verdict].en");
    expect(src).toContain("ACTION_WORDING[verdict].fr");
  });

  it("aucune seconde autorité ne réécrit l'action ailleurs", () => {
    // Si une surface composait son propre libellé d'action, elle pourrait
    // diverger du verdict sans qu'aucun test ne le voie.
    //
    // Première rédaction : `not.toMatch(/actionEn\s*=\s*(?!ACTION_WORDING)/)`.
    // Elle rougissait sur du code CORRECT : `\s*` peut matcher zéro
    // caractère, la lookahead voyait donc l'espace avant `ACTION_WORDING`
    // et réussissait toujours. Un test faux ment dans les deux sens — on
    // extrait les affectations et on lit leur membre droit.
    const src = readFileSync("src/lib/reflex/verdict.ts", "utf8");
    const affectations = [...src.matchAll(/\baction(?:En|Fr)\s*=\s*([^;\n]+)/g)]
      .map((m) => m[1].trim());
    expect(affectations.length, "aucune affectation trouvée — motif à revoir")
      .toBeGreaterThan(0);
    for (const rhs of affectations) {
      expect(rhs, "action composée hors de ACTION_WORDING").toMatch(/^ACTION_WORDING\[/);
    }
  });

  it("les quatre verdicts portent chacun leur action, sans trou", () => {
    for (const v of ["STOP", "WAIT", "VERIFY", "NO_CRITICAL_SIGNAL"] as const) {
      expect(ACTION_WORDING[v], v).toBeDefined();
      expect(typeof ACTION_WORDING[v].en, v).toBe("string");
      expect(typeof ACTION_WORDING[v].fr, v).toBe("string");
    }
  });
});

// ═══ 4 · STOP METHODOLOGY — ce que cette batterie NE TESTE PAS ═══════════
//
// Un seul critère de couverture est gouverné : `measured === 0` ne peut pas
// produire un verdict rassurant. Il est testé (A1).
//
// NE SONT NI TESTÉS NI IMPLIQUÉS, faute d'être gouvernés :
//
//   · le verdict correct pour 1/8, 4/8 ou 7/8 moteurs mesurés ;
//   · l'activation de `GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD = 0.5`, qui est
//     morte dans le source. Son existence n'est PAS une ratification : la
//     rendre vivante fixerait une limite que personne n'a arbitrée.
//
// Tout mutant qui ne pourrait être jugé qu'en fixant cette limite est
// volontairement ABSENT de la liste. Écrire ce mutant reviendrait à choisir
// le seuil, donc à prendre une décision de méthodologie — c'est un
// STOP METHODOLOGY, pas un nombre à choisir.
