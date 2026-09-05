#!/usr/bin/env node
// --- BUILD 7 / S2 — VÉRIFICATION DE MUTATION, REPRODUCTIBLE ---------------
//
// ██ CE QUE CE SCRIPT PROUVE ██
//
// Que chaque garde de `src/lib/similarity/invariants.ts` est PORTANTE : il la
// neutralise, une par une, relance `mutation.test.ts`, et vérifie que
// EXACTEMENT le bloc MUTANT correspondant devient rouge — ni plus, ni moins.
//
// Sans lui, « les invariants sont testés » resterait une affirmation : une
// suite verte ne distingue pas une garde qui refuse d'une garde qu'on aurait
// pu supprimer sans que rien ne bouge. C'est exactement le défaut que S6 avait
// dû reprendre sur Data Nature — les règles y tenaient PAR OMISSION.
//
// ─── LA NEUTRALISATION ────────────────────────────────────────────────────
//
// `throw new XError(...)` devient `SKIP(new XError(...))` : les arguments sont
// toujours évalués, l'objet toujours construit, et rien n'est levé. On ne
// supprime donc pas du code — on retire uniquement le REFUS, ce qui est la
// seule chose que le test doit mesurer.
//
// Aucun réseau, aucune base, aucune écriture hors du fichier ciblé — restauré
// dans un `finally`, y compris en cas d'interruption du runner.
//
// Usage : node scripts/similarity/mutation-check.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "src/lib/similarity/invariants.ts";
const TEST = "src/lib/similarity/__tests__/mutation.test.ts";
const HELPER = "\nconst SKIP = (e: Error): void => { void e; };\n";
const ANCHOR = "export interface ComparisonSources {";

/** Une garde par invariant. L'ordre est celui des INV-1..INV-9. */
const GUARDS = [
  ["INV-1", "StateCollapseError", "MUTANT 1"],
  ["INV-2", "AbsenceBecameFindingError", "MUTANT 2"],
  ["INV-3", "EmptyObservationError", "MUTANT 3"],
  ["INV-4", "CensoredNegativeError", "MUTANT 4"],
  ["INV-5", "ExperimentalLaunderedError", "MUTANT 5"],
  ["INV-6", "NatureUpRankError", "MUTANT 6"],
  ["INV-7", "UnattributableComparisonError", "MUTANT 7"],
  ["INV-8", "ForbiddenConclusionError", "MUTANT 8"],
  ["INV-9", "MethodMismatchNotFlaggedError", "MUTANT 9"],
];

/** Remplace `throw new X(` par `SKIP(new X(`, en refermant la parenthèse au
 *  bon endroit — un simple remplacement de chaîne casserait l'équilibrage. */
function neutralize(source, errorClass) {
  const needle = `throw new ${errorClass}(`;
  let out = "";
  let i = 0;
  for (;;) {
    const j = source.indexOf(needle, i);
    if (j < 0) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, j) + `SKIP(new ${errorClass}(`;
    const open = j + needle.length - 1;
    let depth = 0;
    let p = open;
    for (; p < source.length; p++) {
      if (source[p] === "(") depth++;
      else if (source[p] === ")" && --depth === 0) break;
    }
    out += source.slice(open + 1, p + 1) + ")";
    i = p + 1;
  }
  return out.replace(ANCHOR, HELPER + ANCHOR);
}

function runTests() {
  try {
    return execFileSync("npx", ["vitest", "run", TEST], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

const original = readFileSync(SRC, "utf8");
let failures = 0;

try {
  for (const [inv, errorClass, expectedBlock] of GUARDS) {
    const mutated = neutralize(original, errorClass);
    if (mutated === original) {
      console.log(`❌ ${inv} — aucun \`throw new ${errorClass}\` trouvé : la garde a disparu.`);
      failures++;
      continue;
    }
    writeFileSync(SRC, mutated);
    const output = runTests();
    const blocks = new Set(
      [...output.matchAll(/FAIL[^\n]*?>\s*(MUTANT \d+)/g)].map((m) => m[1]),
    );
    const ok = blocks.size === 1 && blocks.has(expectedBlock);
    console.log(
      `${ok ? "✅" : "❌"} ${inv} · ${errorClass} → ` +
        (blocks.size === 0
          ? "AUCUN test rouge — la garde ne portait rien."
          : `rouge : ${[...blocks].sort().join(", ")} (attendu : ${expectedBlock})`),
    );
    if (!ok) failures++;
  }
} finally {
  writeFileSync(SRC, original);
}

if (failures > 0) {
  console.error(`\n🛑 ${failures} garde(s) non portante(s) ou mal ciblée(s).`);
  process.exit(1);
}
console.log("\n✅ Les 9 gardes sont portantes, et chacune ne couvre que son bloc.");
