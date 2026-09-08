// ─── BUILD 11 · REFLEX V2 · S1 — CORPUS DE FALSIFICATION ───────────────────
//
// ██  Ces tests ne bénissent pas le comportement actuel. Ils l'attaquent.  ██
//
// Consigne ratifiée : « Les tests doivent EXPOSER les défauts, pas bénir le
// comportement legacy. » Un test qui passe sur le code actuel ne prouve rien
// si le code actuel EST le défaut.
//
// Ce fichier écrit donc le contrat VOULU, pas le contrat observé. Les tests
// marqués ROUGE ATTENDU échouent aujourd'hui, et c'est le livrable : chacun
// nomme un endroit précis où « UNKNOWN / STALE / FAILURE / NOT_MEASURABLE »
// devient silencieusement de la RÉASSURANCE.
//
// Aucun seuil n'est réglé ici, aucune méthodologie inventée. On teste la
// SÉPARATION entre « mesuré et propre » et « pas mesuré » — rien d'autre.
//
// Les sept situations du cadrage :
//   1 signal critique · 2 mesure propre complète · 3 couverture partielle
//   4 échec provider · 5 stale · 6 non mesurable · 7 signaux contradictoires

import { describe, it, expect } from "vitest";
import { decide } from "@/lib/reflex/verdict";
import { computeGlobalConfidence } from "@/lib/reflex/confidence";
import { GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD } from "@/lib/reflex/constants";
import type {
  ReflexEngineOutput,
  ReflexSignal,
  ReflexSignalSource,
} from "@/lib/reflex/types";

// ─── Fabriques ────────────────────────────────────────────────────────────

/** Un moteur qui a RÉELLEMENT tourné et n'a rien trouvé. Constat propre. */
const propre = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine,
  ran: true,
  ms: 12,
  signals: [],
});

/** Un moteur qui a échoué. L'absence de signal n'est PAS un constat. */
const enPanne = (engine: ReflexSignalSource, error = "provider timeout"): ReflexEngineOutput => ({
  engine,
  ran: false,
  ms: 5000,
  signals: [],
  error,
});

/** Un moteur jamais sollicité, faute de données d'entrée. */
const nonSollicite = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine,
  ran: false,
  ms: 0,
  signals: [],
});

const avecSignal = (
  engine: ReflexSignalSource,
  s: Partial<ReflexSignal> & Pick<ReflexSignal, "code" | "severity" | "confidence">,
): ReflexEngineOutput => ({
  engine,
  ran: true,
  ms: 20,
  signals: [{ source: engine, ...s } as ReflexSignal],
});

const LES_HUIT: ReflexSignalSource[] = [
  "tigerscore", "offchain", "coordination", "knownBad",
  "intelligenceOverlay", "recidivism", "casefileMatch", "narrative",
];

const tousPropres = () => LES_HUIT.map(propre);
const tousEnPanne = () => LES_HUIT.map((e) => enPanne(e));

/**
 * La couverture, telle qu'un consommateur devrait pouvoir la lire.
 * Elle N'EXISTE PAS dans `ReflexVerdictResult` — c'est précisément l'objet
 * des tests ci-dessous. On la calcule ici pour pouvoir l'exiger.
 */
const couverture = (engines: ReflexEngineOutput[]) => ({
  total: engines.length,
  mesures: engines.filter((e) => e.ran).length,
  manquants: engines.filter((e) => !e.ran).map((e) => e.engine),
});

// ═══ 1 · SIGNAL CRITIQUE ═════════════════════════════════════════════════
// Référence de non-régression : ce que REFLEX fait déjà bien.

describe("S1/1 — signal critique", () => {
  it("un stopTrigger produit STOP", () => {
    const r = decide([
      ...tousPropres().filter((e) => e.engine !== "knownBad"),
      avecSignal("knownBad", {
        code: "knownBad.sanctioned",
        severity: "CRITICAL",
        confidence: 0.95,
        stopTrigger: true,
        reasonEn: "Address appears on a sanctions list.",
        reasonFr: "Adresse présente sur une liste de sanctions.",
      }),
    ]);
    expect(r.verdict).toBe("STOP");
    expect(r.verdictReasonEn.length).toBeGreaterThan(0);
  });

  it("le verdict et son explication viennent de la MÊME autorité", () => {
    // `decide()` produit verdict, raisons ET action. Une seconde autorité
    // qui reformulerait l'action ailleurs pourrait diverger du verdict.
    const r = decide([
      avecSignal("knownBad", {
        code: "knownBad.sanctioned", severity: "CRITICAL",
        confidence: 0.95, stopTrigger: true,
        reasonEn: "x", reasonFr: "y",
      }),
    ]);
    expect(r.actionEn).toContain("Do not");
    expect(r.actionFr).toContain("Ne pas");
  });
});

// ═══ 2 · MESURE PROPRE COMPLÈTE ══════════════════════════════════════════
// Le SEUL cas où NO_CRITICAL_SIGNAL est honnête.

describe("S1/2 — mesure propre et complète", () => {
  it("huit moteurs ont tourné, aucun signal → NO_CRITICAL_SIGNAL", () => {
    const r = decide(tousPropres());
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
  });

  it("le disclaimer est servi, et il ne promet rien", () => {
    const r = decide(tousPropres());
    expect(r.verdictReasonEn.join(" ")).toContain("not a safety guarantee");
  });
});

// ═══ 3 · COUVERTURE PARTIELLE ════════════════════════════════════════════

describe("S1/3 — couverture partielle", () => {
  const partielle = [
    ...LES_HUIT.slice(0, 4).map(propre),
    ...LES_HUIT.slice(4).map((e) => enPanne(e)),
  ];

  it("ROUGE ATTENDU — une couverture à 4/8 ne rend pas le MÊME verdict qu'une couverture à 8/8", () => {
    // Quatre moteurs sur huit n'ont pas pu se prononcer. Le produit rend
    // pourtant le verdict rassurant, mot pour mot identique au cas où tout
    // a été mesuré. C'est l'invariant central, violé.
    const complet = decide(tousPropres());
    const incomplet = decide(partielle);
    expect(incomplet.verdict).not.toBe(complet.verdict);
  });

  it("ROUGE ATTENDU — le résultat porte la couverture de mesure", () => {
    // Le consommateur n'a AUCUN moyen de savoir ce qui n'a pas été mesuré :
    // `ReflexVerdictResult` ne porte ni `coverage`, ni `enginesMeasured`,
    // ni la liste des moteurs manquants.
    const r = decide(partielle) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(
      expect.arrayContaining(["coverage"]),
    );
  });

  it("le fait mesurable existe pourtant en amont — il est simplement jeté", () => {
    // Preuve que le défaut est au POINT DE CONSOMMATION, pas à la source :
    // l'état est parfaitement disponible sur les entrées de `decide()`.
    expect(couverture(partielle)).toEqual({
      total: 8,
      mesures: 4,
      manquants: ["intelligenceOverlay", "recidivism", "casefileMatch", "narrative"],
    });
  });
});

// ═══ 4 · ÉCHEC PROVIDER TOTAL ════════════════════════════════════════════

describe("S1/4 — échec provider", () => {
  it("ROUGE ATTENDU — zéro moteur mesuré ne peut pas produire un verdict rassurant", () => {
    // Huit moteurs en panne. Rien n'a été observé. Le produit répond
    // NO_CRITICAL_SIGNAL — « aucun signal critique trouvé » — alors que
    // rien n'a été cherché avec succès. C'est la coercition absence →
    // réassurance, à la sortie produit, devant un acheteur retail.
    const r = decide(tousEnPanne());
    expect(r.verdict).not.toBe("NO_CRITICAL_SIGNAL");
  });

  it("ROUGE ATTENDU — le seuil de confiance déclaré pour NO_CRITICAL_SIGNAL est APPLIQUÉ", () => {
    // `GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD = 0.5` est documenté dans
    // constants.ts comme « minimum global confidence required to emit ».
    // Il est importé par verdict.ts et n'y est JAMAIS lu : une garantie
    // déclarée sans implémentation.
    const r = decide(tousEnPanne());
    if (r.verdict === "NO_CRITICAL_SIGNAL") {
      expect(r.confidenceScore).toBeGreaterThanOrEqual(
        GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD,
      );
    }
  });

  it("ROUGE ATTENDU — un score de 0 n'est pas une confiance, c'est une sentinelle", () => {
    // `computeGlobalConfidence` rend { score: 0 } quand AUCUN moteur n'a
    // contribué. Zéro est indistinguable d'une confiance réellement
    // mesurée à zéro. La dégradation doit voyager À CÔTÉ du nombre.
    const c = computeGlobalConfidence(tousEnPanne()) as unknown as Record<string, unknown>;
    expect(Object.keys(c)).toEqual(expect.arrayContaining(["state"]));
  });

  it("ROUGE ATTENDU — panne et propreté ne produisent pas la même confiance", () => {
    // Huit pannes et huit constats propres rendent tous deux
    // { score: 0, label: "LOW" }. Les deux situations sont opposées.
    expect(computeGlobalConfidence(tousEnPanne()))
      .not.toEqual(computeGlobalConfidence(tousPropres()));
  });

  it("ROUGE ATTENDU — `error` survit jusqu'au consommateur", () => {
    // Les adaptateurs POSENT correctement `error` dans leur catch. Le
    // manifeste le laisse tomber (projectEngine ne garde que `ran`), et
    // le verdict ne l'a jamais vu. La cause de la panne est perdue.
    const r = decide(tousEnPanne()) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(expect.arrayContaining(["degraded"]));
  });
});

// ═══ 5 · STALE ═══════════════════════════════════════════════════════════

describe("S1/5 — donnée périmée", () => {
  it("ROUGE ATTENDU — la fraîcheur est exprimable sur une sortie de moteur", () => {
    // Constat S0 : `grep -riE 'stale|freshness' src/lib/reflex/` rend ZÉRO.
    // Aucun champ de `ReflexEngineOutput` ne porte l'instant d'observation.
    // On ne peut pas écrire le cas « mesuré il y a six jours » — il n'est
    // pas représentable. C'est un défaut de MODÈLE, pas de rédaction.
    const sorti: ReflexEngineOutput = propre("tigerscore");
    expect(Object.keys(sorti)).toEqual(expect.arrayContaining(["observedAt"]));
  });

  it("ROUGE ATTENDU — une mesure périmée ne vaut pas une mesure fraîche", () => {
    // Le test que l'on VOUDRAIT écrire. Faute de champ, les deux entrées
    // sont littéralement le même objet : le produit ne peut pas les
    // distinguer, donc il sert la périmée comme une observation actuelle.
    const frais = { ...propre("tigerscore") };
    const perime = { ...propre("tigerscore") };
    expect(decide([perime])).not.toEqual(decide([frais]));
  });
});

// ═══ 6 · NON MESURABLE ═══════════════════════════════════════════════════

describe("S1/6 — non mesurable", () => {
  it("ROUGE ATTENDU — « non sollicité » se distingue de « en panne »", () => {
    // NOOP_ENGINE (orchestrator.ts) rend `ran:false` SANS `error` quand
    // l'enrichissement manque. Un provider tombé rend `ran:false` AVEC
    // `error`. Le verdict ne lit ni l'un ni l'autre : les deux sont
    // absorbés dans le même silence.
    const jamaisSollicite = decide(LES_HUIT.map(nonSollicite));
    const tombe = decide(tousEnPanne());
    expect(jamaisSollicite).not.toEqual(tombe);
  });

  it("ROUGE ATTENDU — le vocabulaire d'absence ratifié est employé", () => {
    // NOT_APPLICABLE · NOT_MEASURED · WITHHELD · NOT PUBLISHED sont déjà
    // ratifiés ailleurs dans le produit. REFLEX n'en emploie aucun : il
    // n'a aucun mot pour dire l'absence, donc il ne la dit pas.
    const r = decide(LES_HUIT.map(nonSollicite));
    const texte = [...r.verdictReasonEn, r.actionEn].join(" ");
    expect(texte).toMatch(/NOT_MEASURED|NOT_APPLICABLE|not measured/i);
  });
});

// ═══ 7 · SIGNAUX CONTRADICTOIRES ═════════════════════════════════════════

describe("S1/7 — signaux contradictoires", () => {
  const contradictoire = [
    avecSignal("knownBad", {
      code: "knownBad.sanctioned", severity: "CRITICAL",
      confidence: 0.95, stopTrigger: true, reasonEn: "a", reasonFr: "b",
    }),
    avecSignal("intelligenceOverlay", {
      code: "intelligenceOverlay.clearedByAnalyst", severity: "WEAK",
      confidence: 0.9, reasonEn: "c", reasonFr: "d",
    }),
  ];

  it("la contradiction se résout du côté prudent — STOP l'emporte", () => {
    // Ce comportement-là est CORRECT et doit être verrouillé avant toute
    // refonte : premier match gagnant, et STOP est premier.
    expect(decide(contradictoire).verdict).toBe("STOP");
  });

  it("ROUGE ATTENDU — la contradiction est SIGNALÉE, pas seulement résolue", () => {
    // Résoudre prudemment ne suffit pas : le lecteur doit savoir que deux
    // moteurs se contredisent. Rien dans la sortie ne le dit, et le second
    // signal disparaît sans trace du côté utilisateur.
    const r = decide(contradictoire) as unknown as Record<string, unknown>;
    expect(Object.keys(r)).toEqual(expect.arrayContaining(["conflicts"]));
  });
});
