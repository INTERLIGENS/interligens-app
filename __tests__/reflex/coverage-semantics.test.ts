// ─── BUILD 11.1 — SÉMANTIQUE DE COUVERTURE ────────────────────────────────
//
// ██  UNKNOWN est réservé aux causes RÉELLEMENT inconnues.                 ██
// ██  degraded ne s'allume que si un ATTENDU manque.                       ██
//
// Une entrée nue exposait `coverage 4/8` et `degraded: true` alors que la
// cause des quatre absences est parfaitement connue, et connue à l'endroit
// même où elle était écrasée :
//
//   recidivism    la propriété est définie sur un HANDLE   NOT_APPLICABLE
//   offchain      un mint nu n'a pas de substrat off-chain NOT_APPLICABLE
//   coordination  contrat V1 profil-centrique              NOT_REQUESTED_BY_CONTRACT
//   narrative     fetcher différé, jamais alimenté         NOT_REQUESTED_BY_CONTRACT
//
// Aucun des quatre n'est cassé. Et une dégradation NOMINALE rend le signal de
// dégradation inutile : tant que `true` est le régime normal, il n'alerte plus.
//
// Trois notions étaient confondues en une : l'inventaire GLOBAL, les moteurs
// ATTENDUS pour cette requête, et les attendus EFFECTIVEMENT MESURÉS.

import { describe, it, expect } from "vitest";
import { decide } from "@/lib/reflex/verdict";
import {
  REFLEX_ENGINES,
  contractAbsenceReason,
  expectedEnginesFor,
} from "@/lib/reflex/engineContract";
import {
  MEASUREMENT_STATES,
  PUBLICATION_STATES,
} from "@/lib/publication/absenceVocabulary";
import type {
  ReflexEngineOutput,
  ReflexInputType,
  ReflexSignalSource,
} from "@/lib/reflex/types";

const propre = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine,
  ran: true,
  ms: 5,
  signals: [],
});

/** Un moteur non sollicité, avec la cause que le contrat lui donne. */
const horsContrat = (
  engine: ReflexSignalSource,
  inputType: ReflexInputType,
): ReflexEngineOutput => {
  const reason = contractAbsenceReason(engine, inputType);
  return { engine, ran: false, ms: 0, signals: [], ...(reason ? { reason } : {}) };
};

/** Un moteur ATTENDU qui est tombé. Cause connue, et c'est un manque. */
const enPanne = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine,
  ran: false,
  ms: 5000,
  signals: [],
  error: "provider timeout",
});

/** Un moteur muet, sans cause. L'ignorance réelle. */
const muet = (engine: ReflexSignalSource): ReflexEngineOutput => ({
  engine,
  ran: false,
  ms: 0,
  signals: [],
});

/** Le régime d'une entrée nue : les attendus tournent, les autres non. */
const entreeNue = (type: ReflexInputType = "SOLANA_TOKEN"): ReflexEngineOutput[] =>
  REFLEX_ENGINES.map((e) =>
    contractAbsenceReason(e, type) === null ? propre(e) : horsContrat(e, type),
  );

/**
 * TÉMOIN INDÉPENDANT — l'ancienne sémantique, réécrite ici.
 *
 * Règle ratifiée n°1 : un témoin ne doit rien importer du code qu'il juge,
 * sinon il ne peut pas décrire un comportement que ce code ne porte plus.
 */
const ancienneSemantique = (engines: readonly ReflexEngineOutput[]) => ({
  total: engines.length,
  measured: engines.filter((e) => e.ran).length,
  degraded: engines.some((e) => !e.ran),
});

// ═══ 1 — LA CAUSE SURVIT JUSQU'À LA SORTIE ═══════════════════════════════

describe("MUTANT — NOT_APPLICABLE / NOT_REQUESTED_BY_CONTRACT ne s'écrasent plus en UNKNOWN", () => {
  it("les quatre causes de l'entrée nue arrivent intactes", () => {
    const r = decide(entreeNue());
    const causes = Object.fromEntries(r.coverage.notExpected.map((m) => [m.engine, m.reason]));
    expect(causes).toEqual({
      recidivism: "NOT_APPLICABLE",
      offchain: "NOT_APPLICABLE",
      coordination: "NOT_REQUESTED_BY_CONTRACT",
      narrative: "NOT_REQUESTED_BY_CONTRACT",
    });
  });

  it("aucune de ces quatre n'est rendue UNKNOWN", () => {
    const r = decide(entreeNue());
    expect(r.coverage.notExpected.map((m) => m.reason)).not.toContain("UNKNOWN");
    expect(r.coverage.missing).toEqual([]);
  });

  it("MUTANT — un UNKNOWN LÉGITIME n'est pas transformé en cause inventée", () => {
    // La sur-correction symétrique : un moteur muet, sans garde de type ni
    // cause connue, doit rester UNKNOWN. Lui coller une cause précise serait
    // fabriquer une explication.
    const r = decide([...entreeNue().filter((e) => e.engine !== "knownBad"), muet("knownBad")]);
    expect(r.coverage.missing.map((m) => m.reason)).toEqual(["NOT_MEASURED"]);
    expect(r.coverage.missing.map((m) => m.engine)).toEqual(["knownBad"]);
  });

  it("les causes appartiennent à l'axe MESURE, jamais à l'axe PUBLICATION", () => {
    const r = decide(entreeNue());
    for (const m of [...r.coverage.notExpected, ...r.coverage.missing]) {
      expect(MEASUREMENT_STATES).toContain(m.reason);
      expect(PUBLICATION_STATES).not.toContain(m.reason as never);
    }
  });
});

// ═══ 2 — LA DÉGRADATION REDEVIENT UN SIGNAL ══════════════════════════════

describe("MUTANT — degraded ne s'allume que si un ATTENDU manque", () => {
  it("l'entrée nue est le régime NORMAL : degraded = false", () => {
    const r = decide(entreeNue());
    // Le témoin confirme l'ancien comportement, que ce test remplace.
    expect(ancienneSemantique(entreeNue()).degraded).toBe(true);
    expect(r.degraded).toBe(false);
  });

  it("MUTANT DE SUR-CORRECTION — un ATTENDU réellement en panne dégrade TOUJOURS", () => {
    // Le signal doit rester capable d'alerter. Une dégradation qui ne
    // s'allume jamais ne vaut pas mieux qu'une qui est toujours allumée.
    const avecPanne = [
      ...entreeNue().filter((e) => e.engine !== "tigerscore"),
      enPanne("tigerscore"),
    ];
    const r = decide(avecPanne);
    expect(r.degraded).toBe(true);
    expect(r.coverage.missing.map((m) => m.engine)).toEqual(["tigerscore"]);
    expect(r.coverage.missing[0].reason).toBe("FAILURE");
    expect(r.coverage.missing[0].detail).toBe("provider timeout");
  });

  it("un moteur HORS CONTRAT en panne ne dégrade pas — sa cause est connue", () => {
    // `narrative` n'est demandé sur aucun chemin : son silence est le contrat.
    const r = decide(entreeNue());
    expect(r.coverage.notExpected.map((m) => m.engine)).toContain("narrative");
    expect(r.degraded).toBe(false);
  });

  it("chaque moteur ATTENDU manquant, un à un, allume la dégradation", () => {
    for (const e of expectedEnginesFor("SOLANA_TOKEN")) {
      const casse = [...entreeNue().filter((x) => x.engine !== e), enPanne(e)];
      expect(decide(casse).degraded, `${e} en panne doit dégrader`).toBe(true);
    }
  });
});

// ═══ 3 — LES TROIS NOTIONS, SÉPARÉES ═════════════════════════════════════

describe("MUTANT — les trois notions ne se reconfondent pas", () => {
  it("entrée nue : global 8, attendus 4, attendus mesurés 4", () => {
    const c = decide(entreeNue()).coverage;
    expect(c.total).toBe(8);
    expect(c.expected).toBe(4);
    expect(c.expectedMeasured).toBe(4);
    // Et les trois ne sont PAS le même nombre — c'est tout le point.
    expect(c.total).not.toBe(c.expected);
  });

  it("les quatre attendus d'une entrée nue sont nommément ceux-là", () => {
    expect([...expectedEnginesFor("SOLANA_TOKEN")].sort()).toEqual(
      ["casefileMatch", "intelligenceOverlay", "knownBad", "tigerscore"].sort(),
    );
  });

  it("un handle attend plus de moteurs qu'un mint — le contrat varie", () => {
    expect(expectedEnginesFor("X_HANDLE").length).toBeGreaterThan(
      expectedEnginesFor("SOLANA_TOKEN").length,
    );
    expect(expectedEnginesFor("X_HANDLE")).toContain("recidivism");
    expect(expectedEnginesFor("X_HANDLE")).toContain("coordination");
  });

  it("MUTANT — narrative n'entre au dénominateur ATTENDU d'AUCUN type", () => {
    // Il reste dans l'inventaire global : il existe. Mais aucun chemin ne peut
    // le nourrir, donc l'attendre serait compter une absence structurelle.
    const TYPES: ReflexInputType[] = [
      "SOLANA_TOKEN", "EVM_TOKEN", "WALLET", "URL", "X_HANDLE", "TICKER", "UNKNOWN",
    ];
    for (const t of TYPES) {
      expect(REFLEX_ENGINES).toContain("narrative");
      expect(expectedEnginesFor(t), `type ${t}`).not.toContain("narrative");
    }
  });

  it("l'inventaire global reste de 8, quel que soit le contrat", () => {
    expect(REFLEX_ENGINES).toHaveLength(8);
    for (const t of ["SOLANA_TOKEN", "X_HANDLE", "URL"] as ReflexInputType[]) {
      const engines = REFLEX_ENGINES.map((e) =>
        contractAbsenceReason(e, t) === null ? propre(e) : horsContrat(e, t),
      );
      expect(decide(engines).coverage.total).toBe(8);
    }
  });
});

// ═══ 4 — CE QUI N'A PAS BOUGÉ ════════════════════════════════════════════

describe("le reste de BUILD 11 est intact", () => {
  it("0 mesuré produit toujours INSUFFICIENT_COVERAGE", () => {
    // Même sur une entrée nue : si les quatre ATTENDUS tombent aussi, il ne
    // reste aucune mesure, et le verdict rassurant reste interdit.
    const rien = REFLEX_ENGINES.map((e) =>
      contractAbsenceReason(e, "SOLANA_TOKEN") === null ? enPanne(e) : horsContrat(e, "SOLANA_TOKEN"),
    );
    const r = decide(rien);
    expect(r.verdict).toBe("INSUFFICIENT_COVERAGE");
    expect(r.confidenceScore).toBeNull();
    expect(r.degraded).toBe(true);
  });

  it("aucun seuil n'est introduit : 1 à 4 attendus mesurés gardent le verdict", () => {
    const attendus = expectedEnginesFor("SOLANA_TOKEN");
    for (let n = 1; n <= attendus.length; n++) {
      const engines = REFLEX_ENGINES.map((e) => {
        if (contractAbsenceReason(e, "SOLANA_TOKEN") !== null) return horsContrat(e, "SOLANA_TOKEN");
        return attendus.indexOf(e) < n ? propre(e) : enPanne(e);
      });
      expect(decide(engines).verdict).toBe("NO_CRITICAL_SIGNAL");
    }
  });

  it("STALE n'est toujours jamais affirmé", () => {
    expect(JSON.stringify(decide(entreeNue()))).not.toContain("STALE");
  });
});

// ═══ 5 — LES DEUX POINTS D'APPLICATION, ET CE QU'ILS PROUVENT ════════════
//
// La règle est appliquée à DEUX endroits : l'orchestrateur, quand l'analyse
// est calculée, et la relecture, quand elle est rejouée depuis une ligne.
//
// Ce n'est pas une duplication de logique — les deux appellent la MÊME
// fonction — mais c'est bien une redondance, et je la nomme : `runReflex`
// rendant toujours l'objet reconstruit, retirer l'attachement de
// l'orchestrateur est aujourd'hui INOBSERVABLE de bout en bout. Le mutant
// correspondant ne mord donc pas par le comportement.
//
// Il est gardé quand même : `decide()` est une fonction PURE et publique, et
// elle doit être correcte pour un appelant qui ne passerait pas par la
// persistance. La preuve ci-dessous est de SOURCE, et c'est dit.

describe("la règle est appliquée aux deux points, depuis une autorité unique", () => {
  it("MUTANT — l'orchestrateur attache la cause avant de décider", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/reflex/orchestrator.ts", "utf8");
    expect(src).toContain("contractAbsenceReason");
    expect(src).toContain(".map(attacherCause)");
  });

  it("MUTANT — la relecture recalcule la cause, elle ne la devine pas", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/reflex/persistence.ts", "utf8");
    expect(src).toContain("contractAbsenceReason(engine, typeEntree)");
  });

  it("la table « quel moteur, quelle cause » n'est écrite qu'une fois", async () => {
    // Ce qu'on protège est la RÈGLE — quel moteur reçoit quelle cause pour
    // quel type d'entrée — pas le simple fait de nommer un état.
    //
    // `verdict.ts` cite les deux états hors contrat pour les CLASSER : c'est
    // un usage, pas une copie de la règle. Ma première version de ce test
    // l'interdisait, et se trompait de cible.
    const fs = await import("node:fs");
    const table = fs.readFileSync("src/lib/reflex/engineContract.ts", "utf8");
    expect(table).toContain('case "narrative"');
    expect(table).toContain('case "coordination"');

    // Aucun adaptateur ne reproduit la table : cinq copies seraient cinq
    // occasions de désynchroniser.
    for (const f of [
      "src/lib/reflex/adapters/coordination.ts",
      "src/lib/reflex/recidivism.ts",
      "src/lib/reflex/adapters/offchain.ts",
    ]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).not.toContain("NOT_REQUESTED_BY_CONTRACT");
      expect(src).not.toContain("contractAbsenceReason");
    }
  });
});
