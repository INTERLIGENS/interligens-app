// ─────────────────────────────────────────────────────────────────────────────
// FICHIER JETABLE — DÉMONSTRATION DU BLOCAGE AU MERGE (CC-OFFLINE-146).
//
// Il n'a aucune vocation à être mergé. Il existe pour produire, en conditions
// réelles, l'échec d'un required status check : ce test échoue → `Tests` échoue
// → `Quality Gates` échoue → `All Security Gates Passed` échoue → le merge doit
// être REFUSÉ par le ruleset protect-main.
//
// La branche et la PR qui le portent sont supprimées immédiatement après la
// démonstration. Rien de tout ceci n'atteint main.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

describe("DÉMO — échec volontaire d'un required check", () => {
  it("échoue exprès, pour prouver que le merge est bloqué", () => {
    expect(1).toBe(2);
  });
});
