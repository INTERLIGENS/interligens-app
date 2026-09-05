#!/usr/bin/env node
// --- BUILD 7 / @v2 — VÉRIFICATION DE MUTATION, REPRODUCTIBLE --------------
//
// Même mécanique que `mutation-check.mjs` (@v1), appliquée aux CINQ gardes que
// @v2 ajoute. Il neutralise chacune — `throw new XError(…)` devient
// `SKIP(new XError(…))`, les arguments sont toujours évalués, seul le REFUS
// disparaît — relance `mutation-v2.test.ts`, et vérifie qu'exactement le bloc
// MUTANT correspondant devient rouge.
//
// Les neuf gardes de @v1 ne sont PAS revérifiées ici : ce sont les mêmes
// fonctions, importées, et `mutation-check.mjs` en fait déjà la preuve.
//
// Usage : node scripts/similarity/mutation-check-v2.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "src/lib/similarity/v2/invariants.ts";
const TEST = "src/lib/similarity/v2/__tests__/mutation-v2.test.ts";
const HELPER = "\nconst SKIP = (e) => { void e; };\n";
const ANCHOR = "export interface ComparisonSourcesV2 {";

const GUARDS = [
  ["INV-10", "InadmissibleDowngradedError", "MUTANT 10"],
  ["INV-11a", "MajorityVoteError", "MUTANT 11a"],
  ["INV-11b", "ScopeLaunderedError", "MUTANT 11b"],
  ["INV-12", "FabricatedInstantError", "MUTANT 12"],
  ["INV-13", "UnattributedIdentityError", "MUTANT 13"],
];

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
      console.log(`❌ ${inv} — aucun \`throw new ${errorClass}\` : la garde a disparu.`);
      failures++;
      continue;
    }
    writeFileSync(SRC, mutated);
    const output = runTests();
    const blocks = new Set(
      [...output.matchAll(/FAIL[^\n]*?>\s*(MUTANT [0-9]+[ab]?)/g)].map((m) => m[1]),
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
  console.error(`\n🛑 ${failures} garde(s) @v2 non portante(s) ou mal ciblée(s).`);
  process.exit(1);
}
console.log("\n✅ Les 5 gardes de @v2 sont portantes, et chacune ne couvre que son bloc.");
