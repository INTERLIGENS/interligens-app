// ─── S1 · PHASE A — LA PRIMITIVE D'AUTORITÉ DE PUBLICATION ─────────────────
//
// Elle est fail-closed, et ce test ÉNUMÈRE ce qu'elle refuse : une valeur
// muette qui ne serait pas listée ici pourrait un jour être « tolérée » sans
// que rien ne rougisse.

import { describe, it, expect } from "vitest";
import {
  decidePublication,
  keepPublishable,
  PUBLISHED_STATUS,
  PUBLISHED_ONLY_WHERE,
  REFUSAL_CAUSES,
  type RefusalCause,
} from "@/lib/casefile/publicationAuthority";

describe("S1 — la seule valeur qui publie", () => {
  it("un dossier `published` est PUBLISHABLE, et le dossier rendu est la ligne lue", () => {
    const row = { ref: "X", publishStatus: PUBLISHED_STATUS, title: "t" };
    const d = decidePublication(row);
    expect(d.decision).toBe("PUBLISHABLE");
    if (d.decision !== "PUBLISHABLE") throw new Error("inatteignable");
    expect(d.dossier).toBe(row);
    expect(d.dossier.publishStatus).toBe(PUBLISHED_STATUS);
  });

  it("le filtre Prisma est DÉRIVÉ de la constante, pas réécrit", () => {
    expect(PUBLISHED_ONLY_WHERE).toEqual({ publishStatus: PUBLISHED_STATUS });
  });
});

/** Les valeurs muettes, chacune avec la cause qu'elle DOIT produire. */
const REFUSEES: ReadonlyArray<readonly [string, unknown, RefusalCause]> = [
  ["ligne null", null, "ABSENT_ROW"],
  ["ligne undefined", undefined, "ABSENT_ROW"],
  ["champ absent", {}, "ABSENT_STATUS"],
  ["champ undefined", { publishStatus: undefined }, "ABSENT_STATUS"],
  ["champ null", { publishStatus: null }, "ABSENT_STATUS"],
  ["nombre", { publishStatus: 1 }, "NOT_A_STRING"],
  ["booléen true", { publishStatus: true }, "NOT_A_STRING"],
  ["objet", { publishStatus: { value: "published" } }, "NOT_A_STRING"],
  ["tableau", { publishStatus: ["published"] }, "NOT_A_STRING"],
  ["chaîne vide", { publishStatus: "" }, "EMPTY"],
  ["espaces seuls", { publishStatus: "   " }, "EMPTY"],
  ["tabulation", { publishStatus: "\t" }, "EMPTY"],
  ["majuscules", { publishStatus: "PUBLISHED" }, "LOOKALIKE"],
  ["capitale", { publishStatus: "Published" }, "LOOKALIKE"],
  ["espaces autour", { publishStatus: " published " }, "LOOKALIKE"],
  ["retour ligne", { publishStatus: "published\n" }, "LOOKALIKE"],
  ["draft", { publishStatus: "draft" }, "NOT_PUBLISHED"],
  ["restricted", { publishStatus: "restricted" }, "NOT_PUBLISHED"],
  ["archived", { publishStatus: "archived" }, "NOT_PUBLISHED"],
  ["pending", { publishStatus: "pending" }, "NOT_PUBLISHED"],
  ["publish (tronqué)", { publishStatus: "publish" }, "NOT_PUBLISHED"],
  ["publishable (voisin)", { publishStatus: "publishable" }, "NOT_PUBLISHED"],
  ["true en chaîne", { publishStatus: "true" }, "NOT_PUBLISHED"],
  ["inconnu", { publishStatus: "zzz" }, "NOT_PUBLISHED"],
];

describe("S1 — fail-closed : chaque valeur muette est refusée, et nommée", () => {
  for (const [nom, row, cause] of REFUSEES) {
    it(`${nom} → REFUSED / ${cause}`, () => {
      const d = decidePublication(row as never);
      expect(d.decision).toBe("REFUSED");
      if (d.decision !== "REFUSED") throw new Error("inatteignable");
      expect(d.cause).toBe(cause);
      expect(REFUSAL_CAUSES).toContain(d.cause);
    });
  }

  it("toute cause du vocabulaire est atteinte par au moins une valeur muette", () => {
    const atteintes = new Set(REFUSEES.map(([, , c]) => c));
    for (const c of REFUSAL_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });
});

describe("S1 — la forme liste ne réécrit pas la règle", () => {
  it("keepPublishable ne garde que ce que decidePublication publie, dans l'ordre", () => {
    const rows = [
      { ref: "a", publishStatus: "draft" },
      { ref: "b", publishStatus: PUBLISHED_STATUS },
      { ref: "c", publishStatus: "PUBLISHED" },
      { ref: "d" },
      { ref: "e", publishStatus: PUBLISHED_STATUS },
    ];
    expect(keepPublishable(rows).map((r) => r.ref)).toEqual(["b", "e"]);
  });

  it("une liste vide rend une liste vide, pas une erreur", () => {
    expect(keepPublishable([])).toEqual([]);
  });
});
