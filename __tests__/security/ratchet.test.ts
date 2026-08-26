// ─────────────────────────────────────────────────────────────────────────────
// CI Ratchet — le filet doit se déclencher, et ne pas se déclencher à tort.
//
// Deux familles :
//   1. la comparaison de baselines, en pur (aucun git, aucun ESLint) ;
//   2. FP-1, prouvé en exécutant VRAIMENT ESLint — parce que « le drapeau est
//      dans le script npm » n'est pas une preuve de comportement. La leçon B3 :
//      un grep sur du source n'est pas un test.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compare, total } from "../../scripts/ratchet-check.mjs";

const c = (n: number) => ({ count: n });

describe("ratchet — comparaison de baselines", () => {
  it("baseline identique → vert", () => {
    const m = { "a.ts": { "no-any": c(3) }, "b.ts": { "no-unused": c(1) } };
    expect(compare(m, structuredClone(m))).toEqual([]);
    expect(total(m)).toBe(4);
  });

  it("la dette qui BAISSE passe — c'est tout l'objet du cliquet", () => {
    const base = { "a.ts": { "no-any": c(3) } };
    const head = { "a.ts": { "no-any": c(1) } };
    expect(compare(base, head)).toEqual([]);
  });

  it("dette entièrement effacée → vert", () => {
    expect(compare({ "a.ts": { "no-any": c(3) } }, {})).toEqual([]);
  });

  it("TOTAL en hausse → rouge", () => {
    const base = { "a.ts": { "no-any": c(3) } };
    const head = { "a.ts": { "no-any": c(4) } };
    const f = compare(base, head);
    expect(f.length).toBeGreaterThan(0);
    expect(f.join(" ")).toContain("TOTAL en hausse : 3 -> 4");
  });

  it("UNE seule erreur ajoutée suffit à casser le ratchet", () => {
    const base = { "a.ts": { "no-any": c(693) } };
    const head = { "a.ts": { "no-any": c(694) } };
    expect(compare(base, head).length).toBeGreaterThan(0);
  });

  it("dette DÉPLACÉE à total constant → rouge (la règle 1 seule ne verrait rien)", () => {
    const base = { "a.ts": { "no-any": c(3) }, "b.ts": { "no-any": c(1) } };
    const head = { "a.ts": { "no-any": c(1) }, "b.ts": { "no-any": c(3) } };
    expect(total(base)).toBe(total(head)); // le total ne bouge pas
    const f = compare(base, head);
    expect(f.join(" ")).toContain("b.ts :: no-any : 1 -> 3");
  });

  it("couple NEUF alors que le total BAISSE → rouge", () => {
    const base = { "a.ts": { "no-any": c(10) } };
    const head = { "a.ts": { "no-any": c(2) }, "neuf.ts": { "no-any": c(1) } };
    expect(total(head)).toBeLessThan(total(base)); // le total baisse
    const f = compare(base, head);
    expect(f.join(" ")).toContain("neuf.ts :: no-any : couple NEUF");
  });

  it("RÈGLE neuve sur un fichier connu → rouge", () => {
    const base = { "a.ts": { "no-any": c(3) } };
    const head = { "a.ts": { "no-any": c(3), "prefer-const": c(1) } };
    expect(compare(head === head ? base : base, head).join(" ")).toContain("prefer-const");
  });

  it("RENOMMAGE d'un fichier chargé de dette → vert, pas un faux positif", () => {
    const base = { "vieux.ts": { "no-any": c(5) } };
    const head = { "neuf.ts": { "no-any": c(5) } };
    const renames = new Map([["vieux.ts", "neuf.ts"]]);
    expect(compare(base, head, renames)).toEqual([]);
    // Sans la carte de renommage, le même changement serait vu comme neuf.
    expect(compare(base, head).length).toBeGreaterThan(0);
  });

  it("renommage AVEC hausse → rouge quand même", () => {
    const base = { "vieux.ts": { "no-any": c(5) } };
    const head = { "neuf.ts": { "no-any": c(6) } };
    const renames = new Map([["vieux.ts", "neuf.ts"]]);
    const f = compare(base, head, renames);
    expect(f.join(" ")).toContain("neuf.ts :: no-any : 5 -> 6");
  });

  it("base vide → toute dette est neuve", () => {
    expect(compare({}, { "a.ts": { "no-any": c(1) } }).length).toBeGreaterThan(0);
  });
});

describe("ratchet — FP-1 : corriger de la dette ne doit pas rendre la CI rouge", () => {
  // Prouvé en exécutant ESLint, pas en lisant un script.
  const dir = mkdtempSync(join(tmpdir(), "ratchet-fp1-"));
  const cible = "src/lib/intelligence/normalize.ts";

  /** Une baseline qui promet plus de violations que le fichier n'en produit :
   *  c'est exactement l'état d'un dépôt où l'on VIENT de corriger de la dette. */
  function baselineTropGenereuse() {
    const p = join(dir, "sup.json");
    writeFileSync(p, JSON.stringify({ [cible]: { "@typescript-eslint/no-explicit-any": { count: 99 } } }));
    return p;
  }

  function eslint(args: string[]): number {
    try {
      execFileSync("npx", ["eslint", ...args], { stdio: "pipe", encoding: "utf8" });
      return 0;
    } catch (e: unknown) {
      return (e as { status?: number }).status ?? -1;
    }
  }

  it("SANS --pass-on-unpruned-suppressions, ESLint sort en 2", () => {
    const code = eslint(["--suppressions-location", baselineTropGenereuse(), cible]);
    expect(code).toBe(2);
  });

  it("AVEC --pass-on-unpruned-suppressions, ESLint sort en 0", () => {
    const code = eslint([
      "--suppressions-location",
      baselineTropGenereuse(),
      "--pass-on-unpruned-suppressions",
      cible,
    ]);
    expect(code).toBe(0);
  });
});
