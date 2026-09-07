// ─── D12 — PREUVE DE DÉTERMINISME ──────────────────────────────────────────
//
//   node scripts/intelligence/flake-check.mjs [runs]
//
// Deux preuves, et il faut les DEUX. Un test qui passe 50 fois peut passer 50
// fois pour la mauvaise raison — parce qu'il n'assertit plus rien.
//
//   1. STABILITÉ  — N exécutions d'affilée, zéro variation.
//   2. MUTATION   — on réintroduit la lecture d'horloge, et le test DOIT rougir.
//
// Le mutant est le défaut historique, à la lettre : `at()` relisait le temps à
// chaque appel, donc deux fixtures « du même instant » tombaient sur deux
// millisecondes différentes dès que la machine était chargée. Sous charge, le
// mutant échoue vite ; au repos, il peut survivre plusieurs tentatives — c'est
// exactement ce qui rendait le défaut invisible en local et visible en CI.
// On lui laisse donc plusieurs essais, et il suffit qu'UN rougisse.

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST = "src/lib/intelligence/__tests__/contradictionDetector.test.ts";
const RUNS = Number(process.argv[2] ?? 50);
const MUTANT_TRIES = 12;

const ENV = {
  ...process.env,
  DATABASE_URL: "postgresql://ci:ci@db.invalid:5432/none?sslmode=disable",
  ADMIN_TOKEN: "ci-not-a-secret",
  VAULT_AUDIT_SALT: "ci-not-a-secret",
  ADMIN_BASIC_USER: "ci",
  ADMIN_BASIC_PASS: "ci-not-a-secret",
};

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function runSuite() {
  try {
    execSync(`npx vitest run ${TEST}`, { env: ENV, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

let failures = 0;

// ── 1. Stabilité ───────────────────────────────────────────────────────────
console.log(`# D12 — déterminisme de ${TEST}\n`);
console.log(`## 1. STABILITÉ — ${RUNS} exécutions d'affilée`);

let verts = 0;
for (let i = 1; i <= RUNS; i++) {
  if (runSuite()) verts++;
  else console.error(`  ❌ run ${i} ROUGE`);
  if (i % 10 === 0) process.stdout.write(`  ${i}/${RUNS}…\n`);
}
if (verts === RUNS) {
  console.log(`  ✅ ${verts}/${RUNS} verts, aucune variation.\n`);
} else {
  console.error(`  ❌ ${RUNS - verts} run(s) rouge(s) sur ${RUNS}.\n`);
  failures++;
}

// ── 2. Mutation ────────────────────────────────────────────────────────────
console.log("## 2. MUTATION — réintroduction de la lecture d'horloge");

const original = readFileSync(TEST, "utf8");
const shaBefore = sha(TEST);
const backup = join(tmpdir(), `d12-flake-${Date.now()}.ts`);
copyFileSync(TEST, backup);

const FROM = `const BASE_MS = Date.UTC(2026, 0, 15, 12, 0, 0, 0);

/** Un instant déterministe, à \`minsAgo\` minutes avant la base figée. */
function at(minsAgo: number): Date {
  return new Date(BASE_MS - minsAgo * 60_000);
}`;
const TO = `/** MUTANT — le défaut historique : l'horloge relue à chaque appel. */
function at(minsAgo: number): Date {
  return new Date(Date.now() - minsAgo * 60_000);
}`;

try {
  if (!original.includes(FROM)) {
    console.error("  ❌ motif introuvable — mutant périmé, la preuve ne vaut rien.");
    failures++;
  } else {
    writeFileSync(TEST, original.replace(FROM, TO));
    let tue = false;
    for (let i = 1; i <= MUTANT_TRIES && !tue; i++) {
      if (!runSuite()) {
        tue = true;
        console.log(`  ✅ mutant TUÉ à la tentative ${i}/${MUTANT_TRIES}.`);
      }
    }
    if (!tue) {
      console.error(
        `  ❌ MUTANT SURVIVANT après ${MUTANT_TRIES} tentatives : le test ne détecte pas\n` +
          "     la lecture d'horloge. La stabilité ci-dessus ne prouve alors rien.",
      );
      failures++;
    }
  }
} finally {
  writeFileSync(TEST, original);
  if (sha(TEST) !== shaBefore) {
    console.error(`  ❌ RESTAURATION INCOMPLÈTE de ${TEST}.`);
    failures++;
  }
  try {
    unlinkSync(backup);
  } catch {
    /* le fichier temporaire a déjà disparu — sans conséquence */
  }
}

console.log(
  failures === 0
    ? "\n✅ Déterministe, et prouvé tel : stable sur la durée, rouge sur le défaut."
    : `\n❌ ${failures} échec(s).`,
);
process.exit(failures === 0 ? 0 : 1);
